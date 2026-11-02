import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { downloadExtension, isForbiddenExtensionAddress, validateExtensionUrl } from "./download.ts";

test("cloud download rejects public-looking names resolving to private or mapped addresses", async () => {
  for (const value of ["http://example.com/x", "https://127.0.0.1/x", "https://localhost/x", "https://user:pass@example.com/x"]) assert.throws(() => validateExtensionUrl(value));
  for (const address of ["169.254.169.254", "10.0.0.2", "fd00::1", "::ffff:7f00:1", "2001:db8::1"]) assert.equal(isForbiddenExtensionAddress(address), true);
  await assert.rejects(downloadExtension("https://example.com/x", { resolve: async () => [{ address: "127.0.0.1", family: 4 }], request: (() => assert.fail("Private request")) as any }), /Private/);
});

test("cloud download pins DNS, strips caller credentials and validates redirects", async () => {
  let calls = 0;
  const request = (_url: unknown, options: any, callback: any) => {
    assert.equal(options.headers.Authorization, undefined);
    options.lookup("example.com", {}, (_error: unknown, ip: string) => assert.equal(ip, "8.8.8.8"));
    const req = new EventEmitter() as any;
    req.end = () => {
      const result = Readable.from([Buffer.from("package")]) as any;
      result.statusCode = ++calls === 1 ? 302 : 200;
      result.headers = calls === 1 ? { location: "https://127.0.0.1/private" } : {};
      queueMicrotask(() => callback(result));
    };
    return req;
  };
  await assert.rejects(downloadExtension("https://example.com/x", { resolve: async () => [{ address: "8.8.8.8", family: 4 }], request: request as any }), /IP-address/);
  assert.equal(calls, 1);
  assert.equal(new TextDecoder().decode(await downloadExtension("https://example.com/x", { resolve: async () => [{ address: "8.8.8.8", family: 4 }], request: request as any })), "package");
});
