// Rebuild only when updating the GeoNames derived city-name index.
import { writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

const response = await fetch('https://download.geonames.org/export/dump/cities15000.zip', { signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`GeoNames download failed: ${response.status}`);
const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
const rows = strFromU8(archive['cities15000.txt']).trim().split('\n').map(line => line.split('\t'))
  .filter(row => Number(row[14]) >= 500000).sort((a, b) => Number(b[14]) - Number(a[14]));
const aliases = {};
for (const row of rows) for (const name of row[3].split(',')) {
  if (!/^[\p{Script=Han}·・]{2,20}$/u.test(name)) continue;
  // GeoNames lists New York's Chinese aliases in traditional script.
  const names = new Set([name, name.replace(/[市县區区]$/u, ''), name.replaceAll('紐', '纽').replaceAll('約', '约').replace(/[市县區区]$/u, '')]);
  for (const alias of names) {
    const entries = aliases[alias] ||= [];
    if (entries.length < 3 && !entries.some(entry => entry.id === Number(row[0]))) entries.push({ id: Number(row[0]), name: row[1], country: row[8] });
  }
}
await writeFile(new URL('../community-plugins/weather/city-aliases.json', import.meta.url), JSON.stringify(aliases) + '\n');
console.log(`Updated ${Object.keys(aliases).length} Chinese city aliases. Update the provenance retrieval date after reviewing the diff.`);
