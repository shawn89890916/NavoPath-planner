import assert from "node:assert/strict";
import test from "node:test";
import { pinnedHttpRequest, type Connection } from "./pinned-http.ts";

function fixture(response: string, fragment = 7) {
  const bytes = new TextEncoder().encode(response);
  let offset = 0, closed = 0, written = "";
  const connection: Connection = {
    async read(buffer) {
      if (offset === bytes.length) return null;
      const count = Math.min(fragment, buffer.length, bytes.length - offset);
      buffer.set(bytes.subarray(offset, offset + count)); offset += count; return count;
    },
    async write(buffer) { written += new TextDecoder().decode(buffer); return buffer.length; },
    close() { closed++; },
  };
  return { connection, closed: () => closed, written: () => written, network: {
    async connect(ip: string) { assert.equal(ip, "8.8.8.8"); return connection; },
    async startTls(conn: Connection, hostname: string) { assert.equal(conn, connection); assert.equal(hostname, "example.com"); return connection; },
  } };
}
async function body(response: AsyncIterable<Uint8Array>) {
  const chunks = [];
  for await (const chunk of response) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}
test("native Edge transport pins TCP while preserving TLS identity and HTTP Host", async () => {
  const f = fixture("HTTP/1.1 200 OK\r\nContent-Length: 7\r\n\r\npackage");
  const result = await pinnedHttpRequest(new URL("https://example.com/package?q=1"), "8.8.8.8", new AbortController().signal, f.network);
  assert.equal(result.statusCode, 200); assert.equal(await body(result), "package");
  assert.match(f.written(), /^GET \/package\?q=1 HTTP\/1.1\r\nHost: example.com\r\n/);
  assert.doesNotMatch(f.written(), /Authorization|Cookie/i); assert.equal(f.closed(), 1);
});
test("native Edge transport reads fragmented chunks and interim responses", async () => {
  const f = fixture("HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n3;extension=yes\r\npac\r\n4\r\nkage\r\n0\r\n\r\n", 1);
  const result = await pinnedHttpRequest(new URL("https://example.com/x"), "8.8.8.8", new AbortController().signal, f.network);
  assert.equal(await body(result), "package"); assert.equal(f.closed(), 1);
});
test("native Edge transport rejects ambiguous framing, oversized headers and truncation", async () => {
  for (const wire of [
    "HTTP/1.1 200 OK\r\nContent-Length: 7\r\nContent-Length: 8\r\n\r\npackage",
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nContent-Length: 0\r\n\r\n",
    "HTTP/1.1 200 OK\r\nContent-Length: 8\r\n\r\npackage",
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2000000\r\n",
    "HTTP/1.1 200 OK\r\nX-Long: " + "x".repeat(8200),
  ]) {
    const f = fixture(wire, 16384);
    await assert.rejects(async () => body(await pinnedHttpRequest(new URL("https://example.com/x"), "8.8.8.8", new AbortController().signal, f.network)));
    assert.equal(f.closed(), 1);
  }
});
test("native Edge transport aborts a pending TCP connection and closes it if it arrives late", async () => {
  const controller = new AbortController();
  let finish!: (connection: Connection) => void;
  const f = fixture("");
  const pending = pinnedHttpRequest(new URL("https://example.com/x"), "8.8.8.8", controller.signal, { ...f.network, connect: () => new Promise(resolve => { finish = resolve; }) });
  controller.abort(); await assert.rejects(pending, /timed out/);
  finish(f.connection); await Promise.resolve(); assert.equal(f.closed(), 1);
});
