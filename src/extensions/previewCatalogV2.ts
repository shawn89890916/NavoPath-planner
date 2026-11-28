import { isRecord, validateManifest } from "./packages";
import type { CatalogEntry } from "./types";

/** Independent, official, content-addressed preview catalog. Not a sandbox. */
export const PREVIEW_CATALOG_URL = "https://navopath.com/extensions-preview/catalog-v2.json";
export function readV2PreviewCatalog(raw:unknown):CatalogEntry[]{
  if(!isRecord(raw)||raw.version!==2||!Array.isArray(raw.packages)||raw.packages.length>100)throw Error("Invalid protocol 2 catalog");
  const ids=new Set<string>();
  return raw.packages.map(entry=>{
    if(!isRecord(entry)||typeof entry.sha256!=="string"||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error("Invalid protocol 2 package hash");
    const manifest=validateManifest(entry.manifest);
    if(manifest.apiVersion!==2||ids.has(manifest.id))throw Error("Invalid or duplicate protocol 2 package");
    ids.add(manifest.id);
    const downloadUrl=new URL("packages-v2/"+manifest.id+"-"+manifest.version+"-"+entry.sha256+".navopackage.json",PREVIEW_CATALOG_URL).href;
    if(entry.downloadUrl!==downloadUrl)throw Error("Protocol 2 package must use its official immutable URL");
    return {manifest,sha256:entry.sha256,downloadUrl,sourceId:"official"};
  });
}
