import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { validateManifest, publicHttps } from '../src/extensions/packages.ts';
import { fetchExtensionPackage } from '../electron/extension-download.cjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://raw.githubusercontent.com/shawn89890916/NavoPath-planner/main/public/extensions';
const check = process.argv.includes('--check');
const catalog = { version: 1, name: 'NavoPath Community', packages: [] };
const output = resolve(root, 'public/extensions/packages');
await mkdir(output, { recursive: true });
const previews = resolve(root, 'public/extensions/previews');
await mkdir(previews, { recursive: true });
const icons = resolve(root, 'public/extensions/icons');
await mkdir(icons, { recursive: true });
async function emit(path, data) {
  if (check) {
    const existing = await readFile(path, 'utf8').catch(() => '');
    if (existing !== data) throw new Error(`Generated extension file is stale: ${relative(root, path)}`);
  } else await writeFile(path, data);
}
async function emitBinary(path, data) {
  if (check) {
    const existing = await readFile(path).catch(() => Buffer.alloc(0));
    if (!existing.equals(data)) throw new Error(`Generated extension preview is stale: ${relative(root, path)}`);
  } else await writeFile(path, data);
}
for (const folder of (await readdir(resolve(root, 'community-plugins'))).sort()) {
  if (folder === 'registry.json') continue;
  const dir = resolve(root, 'community-plugins', folder);
  const manifest = validateManifest(JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8')));
  const files = {};
  if (manifest.kind === 'plugin') {
    const result = await build({ entryPoints: [resolve(dir, 'main.ts')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none', write: false });
    files[manifest.main] = { encoding: 'utf8', data: result.outputFiles[0].text };
  }
  if (manifest.styles) files[manifest.styles] = { encoding: 'utf8', data: (await readFile(resolve(dir, manifest.styles), 'utf8')).replaceAll('\r\n', '\n') };
  if (manifest.icon) files[manifest.icon] = { encoding: 'utf8', data: (await readFile(resolve(dir, manifest.icon), 'utf8')).replaceAll('\r\n', '\n') };
  let previewUrl, previewUrls;
  const previewEntries = [...(manifest.preview ? [['default', manifest.preview]] : []), ...Object.entries(manifest.previews || {})];
  for (const [mode, path] of previewEntries) {
    const image = await readFile(resolve(dir, path));
    files[path] = { encoding: 'base64', data: image.toString('base64') };
    const extension = path.split('.').pop().toLowerCase();
    const previewFile = `${manifest.id}${mode === 'default' ? '' : `-${mode}`}.${extension}`;
    await emitBinary(resolve(previews, previewFile), image);
    const url = `${base}/previews/${previewFile}`;
    if (mode === 'default') previewUrl = url;
    else (previewUrls ||= {})[mode] = url;
  }
  files['LICENSE'] = { encoding: 'utf8', data: (await readFile(resolve(dir, 'LICENSE'), 'utf8')).replaceAll('\r\n', '\n') };
  const data = `${JSON.stringify({ manifest, files }, null, 2)}\n`;
  const filename = `${manifest.id}.navopackage.json`;
  await emit(resolve(output, filename), data);
  let iconUrl;
  if (manifest.icon) {
    const icon = (await readFile(resolve(dir, manifest.icon), 'utf8')).replaceAll('\r\n', '\n');
    const iconFile = `${manifest.id}.svg`;
    await emit(resolve(icons, iconFile), icon);
    iconUrl = `${base}/icons/${iconFile}`;
  }
  catalog.packages.push({ manifest, downloadUrl: `${base}/packages/${filename}`, sha256: createHash('sha256').update(data).digest('hex'), ...(previewUrl ? { previewUrl } : {}), ...(previewUrls ? { previewUrls } : {}), ...(iconUrl ? { iconUrl } : {}) });
}
const bundledEntries = [...catalog.packages];
const registry = JSON.parse(await readFile(resolve(root, 'community-plugins/registry.json'), 'utf8'));
if (!Array.isArray(registry)) throw new Error('Community registry must be an array');
const knownIds = new Set(catalog.packages.map(entry => entry.manifest.id));
for (const entry of registry) {
  const manifest = validateManifest(entry.manifest);
  if (knownIds.has(manifest.id) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Duplicate community id or invalid SHA-256');
  knownIds.add(manifest.id);
  const downloadUrl = publicHttps(entry.downloadUrl);
  if (entry.downloads !== undefined && (!Number.isSafeInteger(entry.downloads) || entry.downloads < 0)) throw new Error(`Invalid download count: ${manifest.id}`);
  if (entry.publishedAt !== undefined && (typeof entry.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(entry.publishedAt) || !Number.isFinite(Date.parse(entry.publishedAt)))) throw new Error(`Invalid publish date: ${manifest.id}`);
  const iconUrl = entry.iconUrl ? publicHttps(entry.iconUrl) : undefined;
  if (manifest.icon && !iconUrl) throw new Error(`Community plugin icon needs iconUrl: ${manifest.id}`);
  if (check) {
    const bytes = await fetchExtensionPackage(downloadUrl);
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Release hash mismatch: ${manifest.id}`);
    const { readPackage } = await import('../src/extensions/packages.ts');
    const pkg = await readPackage(new Uint8Array(bytes));
    if (JSON.stringify(pkg.manifest) !== JSON.stringify(manifest)) throw new Error(`Release manifest mismatch: ${manifest.id}`);
  }
  catalog.packages.push({manifest,downloadUrl,sha256:entry.sha256,...(entry.previewUrl ? {previewUrl:publicHttps(entry.previewUrl)} : {}),...(entry.previewUrls ? {previewUrls:{light:publicHttps(entry.previewUrls.light),dark:publicHttps(entry.previewUrls.dark)}} : {}),...(iconUrl ? {iconUrl} : {}),...(entry.downloads !== undefined ? {downloads:entry.downloads} : {}),...(entry.publishedAt ? {publishedAt:entry.publishedAt} : {})});
}
await emit(resolve(root, 'public/extensions/catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
// JSON imports are lazy behind the service's offline official package fallback.
const imports = bundledEntries.map(({ manifest }, index) => `import text${index} from "../../public/extensions/packages/${manifest.id}.navopackage.json?raw";`).join('\n');
await emit(resolve(root, 'src/extensions/officialPackages.ts'), `${imports}\nimport catalog from "../../public/extensions/catalog.json";\nimport type { ExtensionPackage } from "./types";\nexport const officialCatalog = catalog;\nexport const officialPackageTexts: Record<string, string> = { ${bundledEntries.map(({ manifest }, index) => `${JSON.stringify(manifest.id)}: text${index}`).join(', ')} };\nexport const officialPackages: Record<string, ExtensionPackage> = Object.fromEntries(Object.entries(officialPackageTexts).map(([id,text])=>[id,JSON.parse(text) as ExtensionPackage]));\n`);
console.log(`${check ? 'Validated' : 'Built'} ${catalog.packages.length} extension packages and catalog SHA-256 values.`);
// Ship a standalone type-only SDK and self-contained references with each
// copyable template. They are generated from the actual host contracts.
const apiTypes = (await readFile(resolve(root, 'src/extensions/types.ts'), 'utf8')).replaceAll('\r\n','\n').replaceAll('"../types"', '"./models"').replaceAll('"./timers"', '"./timer"').replaceAll('"./model"', '"./extensions"');
const modelTypes = (await readFile(resolve(root, 'src/types.ts'), 'utf8')).replaceAll('\r\n','\n').replaceAll('"./extensions/model"', '"./extensions"');
const timerTypes = (await readFile(resolve(root, 'src/extensions/timers.ts'), 'utf8')).replaceAll('\r\n','\n').split('const modes =')[0].replaceAll('"../types"', '"./models"');
const apiDoc = await readFile(resolve(root, 'docs/plugin-development.md'), 'utf8');
for (const folder of ['navopath-plugin-api', 'navopath-plugin-template', 'navopath-theme-template']) {
  const directory = resolve(root, 'integrations', folder, folder === 'navopath-plugin-api' ? '' : 'api');
  await mkdir(directory, { recursive: true });
  await emit(resolve(directory, 'index.d.ts'), apiTypes + '\nexport type * from "./models";\nexport type * from "./timer";\n');
  await emit(resolve(directory, 'models.d.ts'), modelTypes);
  await emit(resolve(directory, 'extensions.d.ts'), (await readFile(resolve(root, 'src/extensions/model.ts'), 'utf8')).replaceAll('\r\n','\n'));
  await emit(resolve(directory, 'timer.d.ts'), timerTypes.trimEnd() + '\n');
  if (folder !== 'navopath-plugin-api') await emit(resolve(directory, '../API.md'), apiDoc);
}
await emit(resolve(root, 'integrations/navopath-plugin-api/package.json'), JSON.stringify({name:'@navopath/plugin-api',version:'2.0.0',type:'module',types:'index.d.ts',license:'MIT',files:['*.d.ts']},null,2)+'\n');
