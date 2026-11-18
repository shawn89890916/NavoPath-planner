import bundledIds from "../../electron/official-extension-ids.json";
import catalog from "../../public/extensions/catalog.json";
import { readExtensionResponse } from "./packages";
import type { CatalogEntry } from "./types";

export const officialCatalog = catalog as { version: number; name: string; packages: Omit<CatalogEntry, "sourceId">[] };
const bundledEntries = new Map(
  officialCatalog.packages
    .filter(({ manifest }) => bundledIds.includes(manifest.id))
    .map(entry => [entry.manifest.id, { ...entry, sourceId: "official" }]),
);

export function getBundledExtension(id: string) {
  return bundledEntries.get(id);
}

export async function readBundledExtension(id: string): Promise<Uint8Array | undefined> {
  if (!bundledEntries.has(id)) return;
  if (window.desktopApi?.isDesktop?.()) return window.desktopApi.extensions?.readOfficialPackage(id);
  const path = `${import.meta.env.BASE_URL}extensions/packages/${id}.navopackage.json`;
  return readExtensionResponse(await fetch(path, { credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20_000) }));
}
