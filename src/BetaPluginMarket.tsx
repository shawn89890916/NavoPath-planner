import { useEffect, useState } from "react";
import { ExtensionSettings } from "./extensions/ExtensionSettings";
import { OFFICIAL_SOURCE } from "./extensions/packages";
import type { CatalogEntry } from "./extensions/types";
import { siteHref } from "./productSite";
import type { Language } from "./types";

export default function BetaPluginMarket({ lang }: { lang: Language }) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const zh = lang === "zh";

  useEffect(() => {
    const request = new AbortController();
    async function load() {
      try {
        // Browse the official listing here. Installation belongs to the full workspace.
        const response = await fetch(siteHref("/extensions/catalog.json"), { signal: request.signal });
        if (!response.ok) throw new Error("Could not load the plugin catalog.");
        const document: { packages: Array<Omit<CatalogEntry, "sourceId">> } = await response.json();
        if (!request.signal.aborted) setCatalog(document.packages.map(entry => ({ ...entry, sourceId: OFFICIAL_SOURCE.id })));
      } catch {
        if (!request.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => request.abort();
  }, [attempt]);

  if (failed) return <div className="beta-market-status" role="status">
    <p>{zh ? "插件市场未能加载。" : "The plugin market could not load."}</p>
    <button type="button" className="beta-link-button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>{zh ? "重试" : "Retry"}</button>
  </div>;
  if (!catalog) return <p className="beta-market-status" role="status">{zh ? "正在加载插件市场…" : "Loading plugin market…"}</p>;
  return <ExtensionSettings lang={lang} kind="plugin" previewCatalog={catalog} />;
}
