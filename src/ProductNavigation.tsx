import type { ReactNode } from "react";
import { ProductMenu, SiteLanguageSwitch } from "./components/ProductMenu";
import { siteHref, type ProductFeature } from "./productSite";
import type { Language } from "./types";

export default function ProductNavigation({ feature, lang, icon, onLanguageChange }: { feature: ProductFeature | "principles"; lang: Language; icon: ReactNode; onLanguageChange: (lang: Language) => void }) {
  return <div className="df-header-inner">
    <a className="df-brand" href={siteHref(`/?lang=${lang}`)} target="_top">{icon}<strong>NavoPath</strong></a>
    <nav className="df-tabs df-tabs-center" aria-label={lang === "zh" ? "产品主导航" : "Main Navigation"}>
      <ProductMenu lang={lang} kind="product" active={feature !== "principles"} />
      <ProductMenu lang={lang} kind="principles" active={feature === "principles"} />
      <ProductMenu lang={lang} kind="support" includeGitHub />
    </nav>
    <div className="df-header-right">
      <SiteLanguageSwitch lang={lang} onChange={onLanguageChange} />
      <a className="np-start-link" href="/app" target="_top">{lang === "zh" ? "立即开始" : "Start now"}</a>
    </div>
  </div>;
}
