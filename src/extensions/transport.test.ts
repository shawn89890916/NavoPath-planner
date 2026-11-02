import { afterEach, describe, expect, it, vi } from "vitest";
import { configureExtensionTransport, getExtensionValue, getPrivatePackage, purgePrivatePackages, putPrivatePackage, removeExtensionValue, setExtensionValue, subscribeExtensionValues } from "./transport";

function fixture() {
  let user: { id: string } | null = { id: "alice" };
  let onAuth: (() => void) | undefined;
  const changes: Array<(change: any) => void> = [];
  const query: any = {};
  for (const method of ["select", "eq", "upsert"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: { value: 42 }, error: null }));
  query.then = (resolve: (result: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
  const bucket = {
    upload: vi.fn(async (_path: string, _body: unknown, _options: unknown) => ({ error: null })),
    download: vi.fn(async (_path: string) => ({ data: new Blob(["package"]), error: null })),
    list: vi.fn(async () => ({ data: [], error: null as any })),
    remove: vi.fn(async () => ({ error: null })),
  };
  const client: any = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      onAuthStateChange: vi.fn((listener) => { onAuth = listener; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    },
    from: vi.fn(() => query), storage: { from: vi.fn(() => bucket) },
    channel: vi.fn(() => { const channel = { on: vi.fn((_event, _filter, listener) => { changes.push(listener); return channel; }), subscribe: vi.fn(() => channel) }; return channel; }),
    removeChannel: vi.fn(async () => {}),
  };
  return { client, bucket, query, changes, setUser: (id: string | null) => { user = id ? { id } : null; onAuth?.(); } };
}
afterEach(() => configureExtensionTransport(null));

describe("extension cloud transport", () => {
  it("uses account paths and rejects packages whose bytes do not match their hash", async () => {
    const f = fixture(); configureExtensionTransport(f.client);
    const bytes = new TextEncoder().encode("package");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    await putPrivatePackage(hash, bytes);
    expect(f.bucket.upload.mock.calls[0][0]).toBe(`alice/${hash}.navopackage`);
    await expect(putPrivatePackage("a".repeat(64), bytes)).rejects.toThrow("hash mismatch");
    expect(f.bucket.upload).toHaveBeenCalledTimes(1);
    f.setUser("bob");
    await getPrivatePackage(hash);
    expect(f.bucket.download).toHaveBeenCalledWith(`bob/${hash}.navopackage`);
  });

  it("restricts KV queries to the authenticated account and rejects signed-out access", async () => {
    const f = fixture(); configureExtensionTransport(f.client);
    expect(await getExtensionValue("plugin:a", "value")).toBe(42);
    expect(f.query.eq).toHaveBeenCalledWith("user_id", "alice");
    await setExtensionValue("plugin:a", "value", { x: 1 });
    expect(f.query.upsert).toHaveBeenCalledWith({ user_id: "alice", extension_key: "plugin:a", key: "value", value: { x: 1 } }, expect.anything());
    f.setUser(null);
    await expect(getExtensionValue("plugin:a", "value")).rejects.toThrow("Sign in");
  });

  it("rejects captured-account operations before accessing another account", async () => {
    const f = fixture(); configureExtensionTransport(f.client);
    const bytes = new TextEncoder().encode("package");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    f.setUser("bob");
    await expect(putPrivatePackage(hash, bytes, "alice")).rejects.toThrow("account changed");
    await expect(getPrivatePackage(hash, "alice")).rejects.toThrow("account changed");
    await expect(getExtensionValue("p", "key", "alice")).rejects.toThrow("account changed");
    await expect(setExtensionValue("p", "key", 1, "alice")).rejects.toThrow("account changed");
    await expect(removeExtensionValue("p", "key", "alice")).rejects.toThrow("account changed");
    expect(f.client.from).not.toHaveBeenCalled();
    expect(f.client.storage.from).not.toHaveBeenCalled();
  });

  it("does not return private reads after the authenticated account changes in flight", async () => {
    const f = fixture(); configureExtensionTransport(f.client);
    f.query.maybeSingle.mockImplementationOnce(async () => {
      f.setUser("bob");
      return { data: { value: "alice-private" }, error: null };
    });
    await expect(getExtensionValue("p", "key", "alice")).rejects.toThrow("account changed");
  });

  it("filters realtime events by account and detaches when the owning client changes", async () => {
    const f = fixture(); configureExtensionTransport(f.client);
    const listener = vi.fn(); const dispose = subscribeExtensionValues(listener);
    await vi.waitFor(() => expect(f.client.channel).toHaveBeenCalledTimes(1));
    f.changes[0]({ eventType: "UPDATE", new: { user_id: "bob", extension_key: "p", key: "k", value: "private" } });
    expect(listener).not.toHaveBeenCalled();
    f.changes[0]({ eventType: "UPDATE", new: { user_id: "alice", extension_key: "p", key: "k", value: 2 } });
    expect(listener).toHaveBeenCalledWith("p", "k", 2);
    f.setUser("bob");
    await vi.waitFor(() => expect(f.client.channel).toHaveBeenCalledTimes(2));
    f.changes[0]({ eventType: "UPDATE", new: { user_id: "alice", extension_key: "p", key: "k", value: 3 } });
    expect(listener).toHaveBeenCalledTimes(1);
    configureExtensionTransport(null);
    expect(f.client.removeChannel).toHaveBeenCalledTimes(2);
    f.changes[1]({ eventType: "UPDATE", new: { user_id: "bob", extension_key: "p", key: "k", value: 3 } });
    expect(listener).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("allows account deletion before bucket rollout and surfaces other cleanup failures", async () => {
    const f = fixture(); configureExtensionTransport(f.client);
    f.bucket.list.mockResolvedValueOnce({ data: [], error: { message: "Bucket not found" } });
    await expect(purgePrivatePackages()).resolves.toBeUndefined();
    f.bucket.list.mockResolvedValueOnce({ data: [], error: { message: "Network failure" } });
    await expect(purgePrivatePackages()).rejects.toThrow("Network failure");
  });
});
