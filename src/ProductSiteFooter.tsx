import type { Language } from "./types";
import { PERSONAL_SITE_URL, PRODUCT_FEATURES, featureHref, featureNames, type ProductFeature } from "./productSite";

export default function ProductSiteFooter({ lang, next }: { lang: Language; next: ProductFeature }) {
  const zh = lang === "zh";
  return <footer className="np-feature-footer">
    {[next, ...PRODUCT_FEATURES.filter(feature => feature !== next)].map(feature => <a key={feature} href={featureHref(feature, lang)}>{featureNames[lang][feature]}</a>)}
    <a href="https://afdian.com/a/233cxy/plan" target="_blank" rel="noreferrer">{zh ? "爱发电" : "Afdian"}</a>
    <a href="https://github.com/shawn89890916/NavoPath-planner" target="_blank" rel="noreferrer">GitHub</a>
    <a href={`/privacy?lang=${lang}`}>{zh ? "隐私政策" : "Privacy Policy"}</a>
    <a href={PERSONAL_SITE_URL} target="_blank" rel="noreferrer">{zh ? "个人主页" : "Personal Website"}</a>
    <span>© 2026 NavoPath</span>
  </footer>;
}
