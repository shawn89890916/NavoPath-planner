import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { isForbiddenNetworkAddress, validateCalendarUrl } from "../external-calendar/security.ts";

export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
export function validateExtensionUrl(value: string) {
  if (typeof value !== "string" || value.length > 8192) throw new Error("Invalid extension URL");
  const url = validateCalendarUrl(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || /(?:^|\.)(?:test|invalid)$/.test(host)) throw new Error("A public HTTPS URL is required");
  url.hash = "";
  return url;
}
export function isForbiddenExtensionAddress(address: string) {
  if (isForbiddenNetworkAddress(address)) return true;
  if (isIP(address) === 4) return address.startsWith("192.0.");
  return isIP(address) !== 6 || !/^[23][0-9a-f]{3}:/i.test(address)
    || /^(?:2001:db8:|2001:0:|2002:)/i.test(address);
}
type Address = { address: string; family: number };
type DownloadDependencies = {
  resolve: (host: string) => Promise<Address[]>;
  request?: typeof httpsRequest;
};
export async function downloadExtension(value: string, deps: DownloadDependencies): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    let url = validateExtensionUrl(value);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = await Promise.race([
        deps.resolve(url.hostname),
        new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("Extension download timed out")), { once: true })),
      ]);
      if (!addresses.length || addresses.some(({ address }) => isForbiddenExtensionAddress(address))) throw new Error("Private extension destinations are blocked");
      const selected = addresses[0];
      const result = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const req = (deps.request || httpsRequest)(url, {
          signal: controller.signal,
          method: "GET",
          // Never forward the caller's JWT, cookies or other headers to sources.
          headers: { Accept: "application/octet-stream, application/zip, application/json", "Accept-Encoding": "identity" },
          // Keep the original hostname for SNI/certificate verification while
          // pinning the TCP destination to a validated public DNS answer.
          lookup: (_host, options, callback: any) => options?.all
            ? callback(null, [selected]) : callback(null, selected.address, selected.family),
        }, resolve);
        req.on("error", reject);
        req.end();
      });
      const status = result.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        result.destroy();
        if (!result.headers.location || redirects === 3) throw new Error("Extension redirect limit exceeded");
        url = validateExtensionUrl(new URL(result.headers.location, url).href);
        continue;
      }
      if (status < 200 || status >= 300) { result.destroy(); throw new Error(`Extension download failed (${status})`); }
      if (Number(result.headers["content-length"]) > MAX_PACKAGE_BYTES) { result.destroy(); throw new Error("Extension package exceeds 20 MB"); }
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of result) {
        size += chunk.byteLength;
        if (size > MAX_PACKAGE_BYTES) { result.destroy(); throw new Error("Extension package exceeds 20 MB"); }
        chunks.push(new Uint8Array(chunk));
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return bytes;
    }
    throw new Error("Extension redirect limit exceeded");
  } finally { clearTimeout(timer); }
}
