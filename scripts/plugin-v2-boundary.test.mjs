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

import { buildPluginPreview, buildPreviewCatalog } from "./build-plugin-preview.mjs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readPackage } from "../src/extensions/packages.ts";
test("Reading v2 builds independently of the host", async () => {
  const a=await buildPluginPreview("reading"),b=await buildPluginPreview("reading");
  assert.equal(a.sha256,b.sha256);
  const pkg=await readPackage(new TextEncoder().encode(a.data));
  assert.equal(pkg.manifest.apiVersion,2);
  assert.equal(pkg.manifest.id,"reading");
});

test("protocol 2 release artifacts use a separate catalog and immutable hashed paths",async()=>{
  const first=await buildPreviewCatalog("https://navopath.com/extensions-preview/",["reading"]);
  const second=await buildPreviewCatalog("https://navopath.com/extensions-preview/",["reading"]);
  assert.deepEqual(first,second);
  assert.equal(first.catalog.version,2);
  const entry=first.catalog.packages[0],artifact=first.artifacts[0];
  assert.equal(entry.manifest.apiVersion,2);
  assert.equal(entry.sha256,createHash("sha256").update(artifact.data).digest("hex"));
  assert.equal(entry.downloadUrl,"https://navopath.com/extensions-preview/"+artifact.filename);
  assert.ok(artifact.filename.includes(entry.sha256));
  const live=JSON.parse(await readFile(new URL("../public/extensions/catalog.json",import.meta.url),"utf8"));
  assert.equal(live.version,1);
  assert.ok(live.packages.every(item=>item.manifest.apiVersion===1));
  assert.equal(live.packages.find(item=>item.manifest.id==="reading").manifest.apiVersion,1);
});
