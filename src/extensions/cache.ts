// Packages and pending writes are partitioned by account, never by plugin id alone.
const fallback = new Map<string, unknown>();
let dbPromise: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  return dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("navopath-extensions", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("records");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = undefined; reject(request.error); };
  });
}
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") return (fallback.get(key) as T) ?? null;
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").get(key);
    request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error);
  });
}
export async function cachePut(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") { fallback.set(key, structuredClone(value)); return; }
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"); tx.objectStore("records").put(value, key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
export async function cacheDelete(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") { fallback.delete(key); return; }
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"); tx.objectStore("records").delete(key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
export async function cacheEntries<T>(prefix: string): Promise<Array<[string, T]>> {
  if (typeof indexedDB === "undefined") return [...fallback].filter(([key]) => key.startsWith(prefix)) as Array<[string, T]>;
  const db = await database();
  return new Promise((resolve, reject) => {
    const result: Array<[string, T]> = [];
    const request = db.transaction("records").objectStore("records").openCursor(IDBKeyRange.bound(prefix, prefix + "\uffff"));
    request.onsuccess = () => { const cursor = request.result; if (cursor) { result.push([String(cursor.key), cursor.value]); cursor.continue(); } else resolve(result); };
    request.onerror = () => reject(request.error);
  });
}
