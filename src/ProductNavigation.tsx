import type { ReactNode } from "react";
import { ProductMenu, SiteLanguageSwitch } from "./components/ProductMenu";
import { WorkspaceModeTabs } from "./components/WorkspaceModeTabs";
import { featureHref, type ProductFeature } from "./productSite";
import type { Language } from "./types";

export default function ProductNavigation({ feature, lang, icon, onLanguageChange, onNavigate }: { feature: ProductFeature | "principles"; lang: Language; icon: ReactNode; onLanguageChange?: (lang: Language) => void; onNavigate?: (feature: ProductFeature) => void }) {
  const go = onNavigate || ((next: ProductFeature) => { parent.location.href = featureHref(next, lang); });
  return <div className="df-header-inner">
    <a className="df-brand" href="/" target="_top">{icon}<strong>NavoPath</strong></a>
    <WorkspaceModeTabs mode={feature === "principles" ? null : feature} lang={lang} onChange={go} onAi={() => go("ai")} className="df-tabs df-tabs-center">
      <a className={`df-product-principles${feature === "principles" ? " active" : ""}`} href={`/principles?lang=${lang}`} target="_top" aria-current={feature === "principles" ? "page" : undefined}>{lang === "zh" ? "相关原理" : "Principles"}</a>
      <ProductMenu lang={lang} kind="support" includeGitHub />
    </WorkspaceModeTabs>
    <div className="df-header-right">
      <SiteLanguageSwitch lang={lang} onChange={onLanguageChange || (next => parent.postMessage({ channel: "navopath-product-demo", type: "language", lang: next }, location.origin))} />
      <a className="np-start-link" href="/app" target="_top">{lang === "zh" ? "现在开始" : "Start now"}</a>
    </div>
  </div>;
}
