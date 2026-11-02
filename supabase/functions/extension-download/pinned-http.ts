// A bounded HTTP/1.1 transport for Edge Runtime. Its node:https shim ignores
// TLS servername overrides, so use a validated TCP address and native TLS SNI.
export interface Connection {
  read(buffer: Uint8Array): Promise<number | null>;
  write(buffer: Uint8Array): Promise<number>;
  close(): void;
}
export interface PinnedNetwork {
  connect(address: string): Promise<Connection>;
  startTls(connection: Connection, hostname: string): Promise<Connection>;
}
export interface PinnedResponse extends AsyncIterable<Uint8Array> {
  statusCode: number;
  headers: Record<string, string>;
  destroy(): void;
}
class Reader {
  private buffer = new Uint8Array(0);
  private connection: Connection;
  constructor(connection: Connection) { this.connection = connection; }
  async take(max: number): Promise<Uint8Array | null> {
    if (!this.buffer.length) {
      const next = new Uint8Array(16384);
      const count = await this.connection.read(next);
      if (count === null) return null;
      if (count <= 0) throw new Error("Invalid extension response stream");
      this.buffer = next.subarray(0, count);
    }
    const result = this.buffer.subarray(0, max);
    this.buffer = this.buffer.subarray(result.length);
    return result;
  }
  async line(limit: number): Promise<string> {
    const bytes: number[] = [];
    while (bytes.length <= limit) {
      const next = await this.take(1);
      if (!next) throw new Error("Truncated extension response");
      bytes.push(next[0]);
      if (bytes.length >= 2 && bytes.at(-2) === 13 && bytes.at(-1) === 10) {
        return new TextDecoder().decode(new Uint8Array(bytes.slice(0, -2)));
      }
    }
    throw new Error("Extension response headers exceed limit");
  }
}
export async function pinnedHttpRequest(url: URL, address: string, signal: AbortSignal, network: PinnedNetwork): Promise<PinnedResponse> {
  let connection: Connection | undefined;
  let closed = false;
  let rejectConnection: ((error: Error) => void) | undefined;
  const onAbort = () => { destroy(); rejectConnection?.(new Error("Extension download timed out")); };
  const destroy = () => {
    if (closed) return;
    closed = true;
    signal.removeEventListener("abort", onAbort);
    try { connection?.close(); } catch { /* already closed by TLS */ }
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal.aborted) throw new Error("Extension download timed out");
    connection = await new Promise<Connection>((resolve, reject) => {
      rejectConnection = reject;
      network.connect(address).then((value) => {
        if (closed) { value.close(); reject(new Error("Extension download timed out")); }
        else resolve(value);
      }, reject);
    });
    if (closed || signal.aborted) { connection.close(); throw new Error("Extension download timed out"); }
    connection = await network.startTls(connection, url.hostname);
    if (closed || signal.aborted) { connection.close(); throw new Error("Extension download timed out"); }
    const request = new TextEncoder().encode(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.host}\r\nAccept: application/octet-stream, application/zip, application/json\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`);
    for (let offset = 0; offset < request.length;) {
      const count = await connection.write(request.subarray(offset));
      if (count <= 0) throw new Error("Extension request write failed");
      offset += count;
    }
    const reader = new Reader(connection);
    let headerBytes = 0;
    let statusCode = 0;
    let headers: Record<string, string> = Object.create(null);
    for (let interim = 0; interim < 5; interim++) {
      const status = await reader.line(8192);
      headerBytes += status.length + 2;
      const match = /^HTTP\/1\.[01] ([0-9]{3})(?: |$)/.exec(status);
      if (!match) throw new Error("Invalid extension HTTP status");
      statusCode = Number(match[1]);
      headers = Object.create(null);
      while (true) {
        const line = await reader.line(8192);
        headerBytes += line.length + 2;
        if (headerBytes > 65536) throw new Error("Extension response headers exceed limit");
        if (!line) break;
        const field = /^([!#$%&'*+.^_`|~0-9a-z-]+):[\t ]*(.*)$/i.exec(line);
        if (!field) throw new Error("Invalid extension HTTP header");
        const key = field[1].toLowerCase();
        if (key in headers && ["content-length", "transfer-encoding", "location"].includes(key)) throw new Error("Ambiguous extension HTTP headers");
        headers[key] = field[2].trim();
      }
      if (statusCode >= 200) break;
    }
    if (statusCode < 200 || statusCode === 101) throw new Error("Unsupported extension HTTP response");
    const transfer = headers["transfer-encoding"]?.toLowerCase();
    const length = headers["content-length"];
    if (transfer && (transfer !== "chunked" || length !== undefined)) throw new Error("Unsupported extension transfer framing");
    if (length !== undefined && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new Error("Invalid extension content length");
    if (headers["content-encoding"] && headers["content-encoding"].toLowerCase() !== "identity") throw new Error("Compressed extension downloads are unsupported");
    async function* body() {
      try {
        if (transfer === "chunked") {
          let total = 0;
          while (true) {
            const line = await reader.line(8192);
            if (!/^[0-9a-f]+(?:;[^\r\n]*)?$/i.test(line)) throw new Error("Invalid extension chunk size");
            const size = parseInt(line.split(";", 1)[0], 16);
            total += size;
            if (!Number.isSafeInteger(total) || total > 20 * 1024 * 1024) throw new Error("Extension package exceeds 20 MB");
            if (!size) return;
            for (let remaining = size; remaining > 0;) {
              const chunk = await reader.take(remaining);
              if (!chunk) throw new Error("Truncated extension response");
              remaining -= chunk.length;
              yield chunk;
            }
            if (await reader.line(2) !== "") throw new Error("Invalid extension chunk terminator");
          }
        }
        let remaining = length === undefined ? Infinity : Number(length);
        while (remaining > 0) {
          const chunk = await reader.take(remaining);
          if (!chunk) {
            if (remaining !== Infinity) throw new Error("Truncated extension response");
            return;
          }
          remaining -= chunk.length;
          yield chunk;
        }
      } finally { destroy(); }
    }
    return Object.assign(body(), { statusCode, headers, destroy });
  } catch (error) { destroy(); throw error; }
}
