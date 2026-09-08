type Page = { items: unknown[]; total: number; offset: number; nextOffset?: number | null };

function encode(results: Array<Record<string, unknown>>, keep: number): string {
  const output = results.map((result) => {
    const page = result.data && typeof result.data === "object" && !Array.isArray(result.data) && Array.isArray((result.data as Page).items) ? result.data as Page : null;
    if (!page) return result;
    const items = page.items.slice(0, keep);
    return { ...result, data: { ...page, items, nextOffset: page.offset + items.length < page.total ? page.offset + items.length : null } };
  });
  return JSON.stringify(output);
}

export function serializeToolResults(results: Array<Record<string, unknown>>, max = 40_000): string {
  const first = encode(results, 80);
  if (first.length <= max) return first;
  for (let keep = 60; keep >= 1; keep -= 1) {
    const candidate = encode(results, keep);
    if (candidate.length <= max) return candidate;
  }
  return JSON.stringify(results.map((result) => ({ ...result, data: { error: "Result item is too large; narrow the query before continuing." } })));
}
