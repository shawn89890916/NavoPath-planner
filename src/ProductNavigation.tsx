import type { ReactNode } from "react";
import { ProductMenu, SiteLanguageSwitch } from "./components/ProductMenu";
import { WorkspaceModeTabs } from "./components/WorkspaceModeTabs";
import { featureHref, type ProductFeature } from "./productSite";
import type { Language } from "./types";

export default function ProductNavigation({ feature, lang, icon, onLanguageChange, onNavigate }: { feature: ProductFeature; lang: Language; icon: ReactNode; onLanguageChange?: (lang: Language) => void; onNavigate?: (feature: ProductFeature) => void }) {
  const go = onNavigate || ((next: ProductFeature) => { parent.location.href = featureHref(next, lang); });
  return <div className="df-header-inner">
    <a className="df-brand" href="/" target="_top">{icon}<strong>NavoPath</strong></a>
    <WorkspaceModeTabs mode={feature} lang={lang} onChange={go} onAi={() => go("ai")} className="df-tabs df-tabs-center">
      <span className="df-product-principles" aria-disabled="true">{lang === "zh" ? "相关原理" : "Principles"}</span>
    </WorkspaceModeTabs>
    <div className="df-header-right">
      <ProductMenu lang={lang} kind="support" includeGitHub />
      <SiteLanguageSwitch lang={lang} onChange={onLanguageChange || (next => parent.postMessage({ channel: "navopath-product-demo", type: "language", lang: next }, location.origin))} />
      <a className="np-start-link" href="/app" target="_top">{lang === "zh" ? "现在开始" : "Start now"}</a>
    </div>
  </div>;
}
