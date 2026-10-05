import type { ReactNode } from "react";
import { ProductMenu, SiteLanguageSwitch } from "./components/ProductMenu";
import type { ProductFeature } from "./productSite";
import type { Language } from "./types";

export default function ProductNavigation({ feature, lang, icon, onLanguageChange }: { feature: ProductFeature | "principles"; lang: Language; icon: ReactNode; onLanguageChange?: (lang: Language) => void }) {
  return <div className="df-header-inner">
    <a className="df-brand" href="/" target="_top">{icon}<strong>NavoPath</strong></a>
    <nav className="df-tabs df-tabs-center" aria-label={lang === "zh" ? "产品导航" : "Product navigation"}>
      <ProductMenu lang={lang} kind="product" active={feature !== "principles"} />
      <ProductMenu lang={lang} kind="principles" active={feature === "principles"} />
      <ProductMenu lang={lang} kind="support" includeGitHub />
    </nav>
    <div className="df-header-right">
      <SiteLanguageSwitch lang={lang} onChange={onLanguageChange || (next => parent.postMessage({ channel: "navopath-product-demo", type: "language", lang: next }, location.origin))} />
      <a className="np-start-link" href="/app" target="_top">{lang === "zh" ? "现在开始" : "Start now"}</a>
    </div>
  </div>;
}
