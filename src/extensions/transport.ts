import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "extension-packages";
const TABLE = "navopath_extension_values";
const MAX_BYTES = 20 * 1024 * 1024;
let client: SupabaseClient | null = null;
const subscriptions = new Set<() => void>();

// Use the owning planner client, including its desktop session storage and
// same-origin cloud proxy. No independent auth session is created here.
export function configureExtensionTransport(value: SupabaseClient | null) {
  if (client !== value) for (const dispose of subscriptions) dispose();
  client = value;
}
function configuredClient() {
  if (!client) throw new Error("Extension cloud storage is unavailable");
  return client;
}
async function authenticatedClient(expectedUserId?: string) {
  const current = configuredClient();
  const { data, error } = await current.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to use extension cloud storage");
  if (current !== client) throw new Error("Extension cloud session changed");
  if (expectedUserId !== undefined && data.user.id !== expectedUserId) throw new Error("Extension cloud account changed");
  return { current, userId: data.user.id };
}
async function packageBytes(data: unknown): Promise<Uint8Array> {
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  throw new Error("Extension download did not return package bytes");
}
function validateHash(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid extension package hash");
}
function validateStorageKey(owner: string, key: string) {
  if (!owner || owner.length > 200 || !key || key.length > 500 || /[\x00-\x1f]/.test(owner + key)) throw new Error("Invalid extension storage key");
}
async function verifyPackage(hash: string, bytes: Uint8Array) {
  validateHash(hash);
  if (bytes.byteLength > MAX_BYTES) throw new Error("Extension package exceeds 20 MB");
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== hash) throw new Error("Extension package hash mismatch");
}
export async function fetchExtensionBytes(url: string): Promise<Uint8Array> {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.username || target.password || (target.port && target.port !== "443")) throw new Error("A public HTTPS URL is required");
  if (window.desktopApi?.extensions) return new Uint8Array(await window.desktopApi.extensions.fetch(url));
  const { current } = await authenticatedClient();
  const { data, error } = await current.functions.invoke("extension-download", { body: { url } });
  if (error) throw new Error("Extension download is unavailable. Check your connection and the extension download service.");
  const bytes = await packageBytes(data);
  if (bytes.byteLength > MAX_BYTES) throw new Error("Extension package exceeds 20 MB");
  return bytes;
}
export async function putPrivatePackage(hash: string, bytes: Uint8Array, expectedUserId?: string): Promise<void> {
  await verifyPackage(hash, bytes);
  const { current, userId } = await authenticatedClient(expectedUserId);
  const { error } = await current.storage.from(BUCKET).upload(`${userId}/${hash}.navopackage`, new Uint8Array(bytes).buffer, { contentType: "application/octet-stream", upsert: false });
  if (!error) return;
  // Hash names are immutable. A retry may find a previous successful upload.
  if (String(error.statusCode) === "409" || /already exists|duplicate/i.test(error.message)) {
    const existing = await getPrivatePackage(hash, userId);
    if (existing) return;
  }
  throw new Error(`Extension package sync failed: ${error.message}`);
}
export async function getPrivatePackage(hash: string, expectedUserId?: string): Promise<Uint8Array | null> {
  validateHash(hash);
  const { current, userId } = await authenticatedClient(expectedUserId);
  const { data, error } = await current.storage.from(BUCKET).download(`${userId}/${hash}.navopackage`);
  if (error) {
    if (String(error.statusCode) === "404" || error.message === "Object not found") return null;
    throw new Error(`Extension package restore failed: ${error.message}`);
  }
  const bytes = await packageBytes(data);
  await verifyPackage(hash, bytes);
  await authenticatedClient(userId);
  return bytes;
}
export async function getExtensionValue(owner: string, key: string, expectedUserId?: string): Promise<unknown | null> {
  validateStorageKey(owner, key);
  const { current, userId } = await authenticatedClient(expectedUserId);
  const { data, error } = await current.from(TABLE).select("value").eq("user_id", userId).eq("extension_key", owner).eq("key", key).maybeSingle();
  if (error) throw new Error(`Extension storage read failed: ${error.message}`);
  await authenticatedClient(userId);
  return data?.value ?? null;
}
export async function setExtensionValue(owner: string, key: string, value: unknown, expectedUserId?: string): Promise<void> {
  validateStorageKey(owner, key);
  if (value === null) return removeExtensionValue(owner, key, expectedUserId);
  const serialized = JSON.stringify(value);
  if (serialized === undefined || new TextEncoder().encode(serialized).byteLength > 1024 * 1024) throw new Error("Extension value must be JSON smaller than 1 MB");
  const { current, userId } = await authenticatedClient(expectedUserId);
  const { error } = await current.from(TABLE).upsert({ user_id: userId, extension_key: owner, key, value: JSON.parse(serialized) }, { onConflict: "user_id,extension_key,key" });
  if (error) throw new Error(`Extension storage sync failed: ${error.message}`);
}
export async function removeExtensionValue(owner: string, key: string, expectedUserId?: string): Promise<void> {
  validateStorageKey(owner, key);
  const { current, userId } = await authenticatedClient(expectedUserId);
  const { error } = await current.from(TABLE).delete().eq("user_id", userId).eq("extension_key", owner).eq("key", key);
  if (error) throw new Error(`Extension storage delete failed: ${error.message}`);
}
export async function purgePrivatePackages(): Promise<void> {
  const { current, userId } = await authenticatedClient();
  // Storage API deletion also removes underlying blobs. Delete each first page
  // before listing again so pagination cannot skip objects during cleanup.
  while (true) {
    const { data, error } = await current.storage.from(BUCKET).list(userId, { limit: 100 });
    // Account deletion still works for accounts created before extension storage
    // is deployed. All other failures must surface so blobs are not orphaned.
    if (error && /bucket not found/i.test(error.message)) return;
    if (error) throw new Error(`Extension package cleanup failed: ${error.message}`);
    if (!data.length) return;
    const { error: deleteError } = await current.storage.from(BUCKET).remove(data.map((item) => `${userId}/${item.name}`));
    if (deleteError) throw new Error(`Extension package cleanup failed: ${deleteError.message}`);
  }
}

export function subscribeExtensionValues(listener: (owner: string, key: string, value: unknown) => void): () => void {
  const current = client;
  if (!current) return () => {};
  let cancelled = false;
  let channel: ReturnType<SupabaseClient["channel"]> | null = null;
  let userId: string | null = null;
  let generation = 0;
  async function bind() {
    const binding = ++generation;
    const { data } = await current!.auth.getUser();
    if (cancelled || current !== client || binding !== generation) return;
    const nextId = data.user?.id || null;
    if (channel) { void current!.removeChannel(channel); channel = null; }
    userId = nextId;
    if (!userId) return;
    channel = current!.channel(`extension-values-${userId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${userId}` }, (change) => {
        if (cancelled || current !== client || binding !== generation) return;
        const row = (change.eventType === "DELETE" ? change.old : change.new) as Record<string, unknown>;
        if (row.user_id !== userId || typeof row.extension_key !== "string" || typeof row.key !== "string") return;
        listener(row.extension_key, row.key, change.eventType === "DELETE" ? null : row.value);
      }).subscribe();
  }
  // Defer out of the Supabase auth callback so getUser cannot contend with its lock.
  const { data: authListener } = current.auth.onAuthStateChange(() => {
    generation += 1;
    queueMicrotask(() => { void bind().catch(() => {}); });
  });
  void bind().catch(() => {});
  const dispose = () => {
    if (cancelled) return;
    cancelled = true;
    authListener.subscription.unsubscribe();
    if (channel) void current.removeChannel(channel);
    subscriptions.delete(dispose);
  };
  subscriptions.add(dispose);
  return dispose;
}
