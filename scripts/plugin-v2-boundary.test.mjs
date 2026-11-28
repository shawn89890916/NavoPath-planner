import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { checkV2Source, checkV2Boundary } from "./check-plugin-v2-boundary.mjs";
const root = resolve("plugin"), sdk = resolve("sdk"), filename = resolve(root, "main.ts");
const check = source => checkV2Source(source, filename, root, [sdk]);
test("v2 source boundary permits package code and public types", () => {
  assert.deepEqual(check('import type { PluginContextV2 } from "@navopath/plugin-api"; import { helper } from "./helper";'), []);
  assert.deepEqual(check('import type { PluginContextV2 } from "../sdk/v2";'), []);
});
test("v2 source boundary rejects runtime SDK imports, host imports and known legacy escapes", () => {
  for (const source of [
    'import type { Task } from "../src/types";',
    'export { thing } from "../src/private";',
    'type X = import("../src/private").X;',
    'import("../src/private");',
    'require("../src/private");',
    'import { PluginContextV2 } from "@navopath/plugin-api";',
    'import(target);',
    'ctx.app.internal;',
    'window["desktopApi"];',
  ]) assert.ok(check(source).length, source);
});
test("v2 example and all registered v2 package sources obey the static boundary", async () => {
  await checkV2Boundary();
});
