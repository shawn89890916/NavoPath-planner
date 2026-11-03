import { readFile, writeFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
const files = {};
for (const path of [manifest.main, manifest.styles, 'LICENSE'].filter(Boolean)) files[path] = { encoding: 'utf8', data: await readFile(new URL(path, import.meta.url), 'utf8') };
for (const path of new Set([manifest.preview, ...Object.values(manifest.previews || {})].filter(Boolean))) files[path] = { encoding: 'base64', data: (await readFile(new URL(path, import.meta.url))).toString('base64') };
await writeFile(new URL(`${manifest.id}.navopackage.json`, import.meta.url), JSON.stringify({ manifest, files }, null, 2) + '\n');
