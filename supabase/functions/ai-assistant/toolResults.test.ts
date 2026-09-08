import test from "node:test";
import assert from "node:assert/strict";
import { serializeToolResults } from "./toolResults.ts";

test("serializes paged results with next offset based on retained items", () => {
  const all = Array.from({ length: 450 }, (_, index) => ({ id: `task-${index}`, title: `Task ${index}` }));
  const page = JSON.parse(serializeToolResults([{ id: "page", name: "list_tasks", data: { items: all.slice(80, 280), total: 450, offset: 80 } }]));
  assert.equal(page[0].data.items.length, 80);
  assert.equal(page[0].data.nextOffset, 160);
  assert.ok(JSON.stringify(page).length <= 40_000);
  const seen: string[] = [];
  for (let offset = 0; offset < 450;) {
    const encoded = JSON.parse(serializeToolResults([{ id: "page", data: { items: all.slice(offset, offset + 200), total: 450, offset } }]));
    seen.push(...encoded[0].data.items.map((item: { id: string }) => item.id));
    offset = encoded[0].data.nextOffset ?? 450;
  }
  assert.deepEqual(seen, all.map((item) => item.id));
});

test("shrinks long page records without losing pagination metadata", () => {
  const items = Array.from({ length: 80 }, (_, index) => ({ id: `task-${index}`, title: `Task ${index}`, notes: "x".repeat(800) }));
  const parsed = JSON.parse(serializeToolResults([{ id: "long", data: { items, total: 200, offset: 40 } }]));
  assert.ok(JSON.stringify(parsed).length <= 40_000);
  assert.equal(parsed[0].data.nextOffset, 40 + parsed[0].data.items.length);
  assert.ok(parsed[0].data.items.length < 80);
});
