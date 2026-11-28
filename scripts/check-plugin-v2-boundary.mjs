// Source boundary for protocol 2 only. Static hygiene, not a sandbox.
import { readdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function inside(base, path) {
  const rel = relative(base, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep));
}
export function checkV2Source(source, filename, pluginRoot, sdkRoots = []) {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const errors = [];
  const reject = (node, reason) => {
    const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
    errors.push(`${filename}:${line}: ${reason}`);
  };
  const checkImport = (node, specifier, typeOnly) => {
    if (!specifier || !ts.isStringLiteralLike(specifier)) { reject(node, "Nonliteral import"); return; }
    const value = specifier.text;
    if (value === "@navopath/plugin-api" || value === "@navopath/plugin-api/v2") {
      if (!typeOnly) reject(node, "SDK is type-only");
      return;
    }
    if (!value.startsWith(".")) { reject(node, "Use package-local modules or the public type SDK"); return; }
    const target = resolve(dirname(filename), value);
    if (sdkRoots.some(base => inside(base, target))) {
      if (!typeOnly) reject(node, "SDK is type-only");
      return;
    }
    if (!inside(pluginRoot, target)) reject(node, "Plugin imports must stay inside its package");
  };
  const walk = node => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) checkImport(node, node.moduleSpecifier, ts.isImportDeclaration(node)
        ? node.importClause?.isTypeOnly === true
        : node.isTypeOnly);
    } else if (ts.isImportTypeNode(node)) {
      const spec = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
      checkImport(node, spec, true);
    } else if (ts.isImportEqualsDeclaration(node)) {
      reject(node, "Use ESM imports");
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      checkImport(node, node.arguments[0], false);
    } else if ((ts.isPropertyAccessExpression(node) && ["app", "internal", "desktopApi", "plannerApi"].includes(node.name.text)) ||
      (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) &&
      ["app", "internal", "desktopApi", "plannerApi"].includes(node.argumentExpression.text))) {
      // Deliberately narrow, avoids allowing known legacy host escape hatches.
      reject(node, "Legacy host internals are not part of protocol 2");
    }
    ts.forEachChild(node, walk);
  };
  walk(tree);
  return errors;
}
async function checkDirectory(dir, pluginRoot, sdkRoots = []) {
  const errors = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) { errors.push(`${path}: symlinks are not allowed in v2 packages`); continue; }
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist", "api"].includes(entry.name)) continue;
      errors.push(...await checkDirectory(path, pluginRoot, sdkRoots));
    } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      errors.push(...checkV2Source(await readFile(path, "utf8"), path, pluginRoot, sdkRoots));
    }
  }
  return errors;
}
export async function checkV2Boundary() {
  const errors = [];
  const examples = resolve(root, "integrations/navopath-plugin-template/examples");
  const sdk = resolve(root, "integrations/navopath-plugin-template/api");
  errors.push(...await checkDirectory(examples, examples, [sdk]));
  const community = resolve(root, "community-plugins");
  for (const entry of await readdir(community, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = resolve(community, entry.name);
    const manifest = JSON.parse(await readFile(resolve(dir, "manifest.json"), "utf8"));
    if (manifest.apiVersion !== 2) continue;
    errors.push(...await checkDirectory(dir, dir, [resolve(root, "integrations/navopath-plugin-api")]));
  }
  const previews = resolve(root, "plugin-previews");
  for (const entry of await readdir(previews, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = resolve(previews, entry.name);
    errors.push(...await checkDirectory(dir, dir, [resolve(root, "integrations/navopath-plugin-api")]));
  }
  if (errors.length) throw new Error(errors.join("\n"));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkV2Boundary();
  console.log("Protocol 2 source boundaries passed.");
}
