import type { ExtensionTaskGroup } from "./types";
export interface TaskGroupSelection { group: ExtensionTaskGroup; ids: readonly string[] }
export async function resolveTaskGroups(groups: readonly ExtensionTaskGroup[], ids: readonly string[], timeoutMs = 1500): Promise<TaskGroupSelection[]> {
  const eligible = new Set(ids);
  // Stable ownership is independent of activation order or response timing.
  const sorted = [...groups].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const results = await Promise.all(sorted.map(async group => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<readonly string[]>(resolve => { timer = setTimeout(() => resolve([]), timeoutMs); });
      const requested = await Promise.race([Promise.resolve().then(() => group.resolve([...ids])), deadline]);
      return { group, ids: requested };
    } catch { return { group, ids: [] }; }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }));
  return results.map(({ group, ids: requested }) => {
    const selected: string[] = [];
    if (Array.isArray(requested)) {
      const wanted = new Set(requested);
      for (const id of ids) if (eligible.has(id) && wanted.has(id)) {
        eligible.delete(id); selected.push(id);
      }
    }
    return { group, ids: selected };
  });
}
