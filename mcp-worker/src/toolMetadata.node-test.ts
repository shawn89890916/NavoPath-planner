// @ts-nocheck -- Worker compilation omits Node typings, as do the other Node test files.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Inspect every registration without starting a Cloudflare Durable Object.
const source = ts.createSourceFile("index.ts", readFileSync(new URL("./index.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const tools = new Map<string, Record<string, boolean>>();
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "registerTool") {
    const [name, config] = node.arguments;
    assert.ok(ts.isStringLiteral(name) && ts.isObjectLiteralExpression(config));
    const annotation = config.properties.find((item) => ts.isPropertyAssignment(item) && item.name.getText(source) === "annotations");
    assert.ok(annotation && ts.isPropertyAssignment(annotation) && ts.isObjectLiteralExpression(annotation.initializer), `${name.text}: missing annotations`);
    const values: Record<string, boolean> = {};
    for (const item of annotation.initializer.properties) {
      assert.ok(ts.isPropertyAssignment(item));
      assert.ok(item.initializer.kind === ts.SyntaxKind.TrueKeyword || item.initializer.kind === ts.SyntaxKind.FalseKeyword);
      values[item.name.getText(source)] = item.initializer.kind === ts.SyntaxKind.TrueKeyword;
    }
    tools.set(name.text, values);
  }
  ts.forEachChild(node, visit);
}
visit(source);

test("all advertised tools declare explicit boolean safety hints", () => {
  assert.ok(tools.size >= 27);
  for (const [name, hints] of tools) {
    for (const key of ["readOnlyHint", "destructiveHint", "openWorldHint"]) assert.equal(typeof hints[key], "boolean", `${name}.${key}`);
    if (hints.readOnlyHint) assert.equal(hints.destructiveHint, false, name);
  }
});

test("private reads and irreversible workspace mutations have appropriate approval hints", () => {
  for (const name of ["list_projects", "list_tasks", "list_calendar", "get_task", "list_engagement", "get_settings"]) {
    assert.equal(tools.get(name)?.readOnlyHint, true, name);
    assert.equal(tools.get(name)?.openWorldHint, false, name);
  }
  for (const name of ["delete_task", "sync_merge_snapshot", "update_task", "update_settings"]) {
    assert.equal(tools.get(name)?.readOnlyHint, false, name);
    assert.equal(tools.get(name)?.destructiveHint, true, name);
  }
  assert.equal(tools.get("batch_update_tasks")?.readOnlyHint, false, "committing mode must not inherit preview permissions");
});

test("background workflows declare their potential external effects", () => {
  for (const name of ["ingest_workspace_event", "configure_cloud_assistant"]) {
    assert.equal(tools.get(name)?.openWorldHint, true, name);
    assert.equal(tools.get(name)?.readOnlyHint, false, name);
  }
});
