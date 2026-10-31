export type ManifestEntry = {
  hash: string;
  mtime: number;
  size: number;
};

export type BridgeManifest = Record<string, ManifestEntry>;

export type DetectedChange = {
  path: string;
  changeType: "created" | "modified" | "deleted";
  previous?: ManifestEntry;
  current?: ManifestEntry;
};

export type WorkspaceFragment = { path: string; excerpt: string; content_hash: string };

export function workspaceChangeMetadata(change: DetectedChange) {
  return { path: change.path, change_type: change.changeType, content_hash: `sha256:${change.current?.hash || change.previous?.hash || "deleted"}` };
}

function jsonBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

// Reserve room for excerpts and envelope fields inside the API's 64 KB body limit.
export function batchWorkspaceChanges(changes: DetectedChange[]) {
  const batches: DetectedChange[][] = [];
  let batch: DetectedChange[] = [];
  for (const change of changes) {
    if (jsonBytes([workspaceChangeMetadata(change)]) > 36_000) throw new Error("Workspace file path is too long to upload");
    const next = [...batch, change];
    if (next.length > 100 || jsonBytes(next.map(workspaceChangeMetadata)) > 36_000) {
      batches.push(batch);
      batch = [change];
    } else batch = next;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function boundedWorkspaceFragments(fragments: WorkspaceFragment[], maxBytes = 22_000) {
  const bounded: WorkspaceFragment[] = [];
  for (const fragment of fragments.slice(0, 20)) {
    if (jsonBytes([...bounded, fragment]) <= maxBytes) {
      bounded.push(fragment);
      continue;
    }
    // Count serialized UTF-8, including JSON escapes; preserve Unicode code points.
    const characters = Array.from(fragment.excerpt);
    let low = 0;
    let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const candidate = { ...fragment, excerpt: characters.slice(0, middle).join("") };
      if (jsonBytes([...bounded, candidate]) <= maxBytes) low = middle;
      else high = middle - 1;
    }
    if (low) bounded.push({ ...fragment, excerpt: characters.slice(0, low).join("") });
  }
  return bounded;
}

const SCHEDULE_LINE = /(?:\b(?:due|deadline|submit|submission|exam|test|interview|schedule|todo)\b|截止|提交|考试|模考|面试|申请|日期|时间|待办|计划|ddl|\b20\d{2}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?|\b\d{1,2}:\d{2}\b|- \[ \])/i;

export function normalizeVaultPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function normalizeWatchedRoots(roots: string | string[]) {
  const values = Array.isArray(roots) ? roots : [roots];
  return [...new Set(values.map(normalizeVaultPath).filter(Boolean))];
}

export function isValidDeviceToken(value: string) {
  return /^nvp_[a-f0-9]{64}$/i.test(value);
}

export function isPathWatched(path: string, watchedRoots: string | string[]) {
  const normalizedPath = normalizeVaultPath(path);
  return normalizeWatchedRoots(watchedRoots).some((root) => normalizedPath === root || normalizedPath.startsWith(`${root}/`));
}

export function detectManifestChanges(previous: BridgeManifest, current: BridgeManifest): DetectedChange[] {
  const paths = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes: DetectedChange[] = [];
  for (const path of [...paths].sort()) {
    const before = previous[path];
    const after = current[path];
    if (!after && before) changes.push({ path, changeType: "deleted", previous: before });
    else if (after && !before) changes.push({ path, changeType: "created", current: after });
    if (after && before && (after.hash !== before.hash || after.size !== before.size)) {
      changes.push({ path, changeType: "modified", previous: before, current: after });
    }
  }
  return changes;
}

export function schedulingExcerpt(content: string, maxChars = 3600) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const selected: string[] = [];
  if (lines[0]?.trim() === "---") {
    const closing = lines.slice(1, 80).findIndex((line) => line.trim() === "---");
    if (closing >= 0) selected.push(...lines.slice(0, closing + 2));
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && SCHEDULE_LINE.test(trimmed) && !selected.includes(line)) selected.push(line);
    if (selected.join("\n").length >= maxChars) break;
  }
  const excerpt = selected.length ? selected.join("\n") : normalized.slice(0, Math.min(800, maxChars));
  return excerpt.slice(0, maxChars).trim();
}

export async function sha256Hex(value: string | ArrayBuffer) {
  const input = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function eventDedupeKey(changes: DetectedChange[]) {
  const canonical = changes
    .map((change) => `${change.changeType}:${normalizeVaultPath(change.path)}:${change.current?.hash || change.previous?.hash || "none"}:${change.current?.mtime || change.previous?.mtime || 0}`)
    .sort()
    .join("\n");
  return `obsidian-${await sha256Hex(canonical)}`;
}
