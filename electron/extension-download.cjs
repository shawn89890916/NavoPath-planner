const dns = require("node:dns/promises");
const https = require("node:https");
const net = require("node:net");

const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
function forbiddenAddress(value) {
  const address = value.toLowerCase();
  if (net.isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19));
  }
  // Only globally routable unicast IPv6. Reject mapped/tunneled forms too.
  return net.isIP(address) !== 6 || !/^[23][0-9a-f]{3}:/.test(address)
    || address.startsWith("2001:db8:") || address.startsWith("2001:0:") || address.startsWith("2002:");
}
function validateDownloadUrl(value) {
  if (typeof value !== "string" || value.length > 8192) throw new Error("Invalid extension URL");
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password
    || net.isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".")
    || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) throw new Error("A public HTTPS URL is required");
  url.hash = "";
  return url;
}
async function fetchExtensionPackage(value, deps = {}) {
  const resolve = deps.lookup || dns.lookup;
  const request = deps.request || https.request;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    let url = validateDownloadUrl(value);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = await Promise.race([
        resolve(url.hostname, { all: true, verbatim: true }),
        new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("Extension download timed out")), { once: true })),
      ]);
      if (!addresses.length || addresses.some(({ address }) => forbiddenAddress(address))) throw new Error("Private extension destinations are blocked");
      const selected = addresses[0];
      const response = await new Promise((resolveResponse, reject) => {
        const req = request(url, {
          method: "GET", signal: controller.signal,
          headers: { Accept: "application/octet-stream, application/zip, application/json", "Accept-Encoding": "identity" },
          // Pin the validated address through TLS connection establishment to prevent DNS rebinding.
          lookup: (_host, options, callback) => options?.all
            ? callback(null, [selected]) : callback(null, selected.address, selected.family),
        }, resolveResponse);
        req.on("error", reject);
        req.end();
      });
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.destroy();
        if (!response.headers.location || redirects === 3) throw new Error("Extension redirect limit exceeded");
        url = validateDownloadUrl(new URL(response.headers.location, url).href);
        continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) { response.destroy(); throw new Error(`Extension download failed (${response.statusCode})`); }
      if (Number(response.headers["content-length"]) > MAX_PACKAGE_BYTES) { response.destroy(); throw new Error("Extension package exceeds 20 MB"); }
      let size = 0;
      const chunks = [];
      for await (const chunk of response) {
        size += chunk.length;
        if (size > MAX_PACKAGE_BYTES) { response.destroy(); throw new Error("Extension package exceeds 20 MB"); }
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, size);
    }
    throw new Error("Extension redirect limit exceeded");
  } finally { clearTimeout(timer); }
}
module.exports = { MAX_PACKAGE_BYTES, forbiddenAddress, validateDownloadUrl, fetchExtensionPackage };
