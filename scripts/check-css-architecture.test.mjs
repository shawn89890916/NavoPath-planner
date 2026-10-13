import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCssArchitecture } from "./check-css-architecture.mjs";

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), "navopath-css-check-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "index.html"), "");
  for (const [name, source] of Object.entries(files)) writeFileSync(join(root, "src", name), source);
  return checkCssArchitecture(root);
}

test("counts parsed important flags, including spaced and uppercase forms", (t) => {
  const result = fixture(t, { "app.css": ".live { color: red !important; font: inherit ! important; opacity: 1 !IMPORTANT; }", "main.tsx": 'const className = "live";' });
  assert.equal(result.reports[0].importantCount, 3);
  assert.deepEqual(result.errors, []);
});

test("enforces the combined application limit across canonical stylesheets", (t) => {
  const rule = (prefix, count) => Array.from({ length: count }, (_, i) => `.${prefix}${i}[data-state] { color: red !important; }`).join("\n");
  const result = fixture(t, { "app.css": rule("app", 13), "ui-primitives.css": rule("ui", 12) });
  assert.ok(result.errors.some((error) => error.includes("25 !important")));
});

test("test text cannot make an unused selector look live", (t) => {
  const result = fixture(t, { "app.css": ".orphan { color: red; }", "style.test.ts": 'expect(css).toContain("orphan");' });
  assert.ok(result.errors.some((error) => error.includes("no JSX/TSX callsite for orphan")));
});

test("parses component styles as well as canonical styles", (t) => {
  assert.throws(() => fixture(t, { "component.css": ".broken {" }), /Unclosed block/);
});

test("rejects duplicate selectors in one cascade context", (t) => {
  const result = fixture(t, { "app.css": ".live { color: red; } .live { color: blue; }", "main.tsx": 'const className = "live";' });
  assert.ok(result.errors.some((error) => error.includes("duplicates .live")));
});
