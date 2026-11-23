import { useEffect, useState } from "react";
import { UiPlusIcon } from "./components/UiIcons";
import { featureNames, siteHref, siteLanguage, type FeatureCopy, type ProductFeature, type ProductPageEmbed } from "./productSite";
import ProductDemoFrame from "./ProductDemoFrame";
import ProductNavigation from "./ProductNavigation";
import ProductScreenshot from "./ProductScreenshot";
import ProductSiteFooter from "./ProductSiteFooter";
import "./product-feature.css";

const landscape = "(orientation: landscape)";

export default function ProductFeaturePage({ feature, copy, embedded }: {
  feature: ProductFeature; copy: Record<"zh" | "en", FeatureCopy>; embedded?: ProductPageEmbed;
}) {
  const [language, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const lang = embedded?.lang ?? language;
  const [wide, setWide] = useState(() => matchMedia(landscape).matches);
  const c = copy[lang];
  const zh = lang === "zh";
  const Content = embedded ? "div" : "main";

  useEffect(() => {
    const media = matchMedia(landscape);
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (embedded) return;
    document.documentElement.classList.add("product-site-document");
    return () => document.documentElement.classList.remove("product-site-document");
  }, [embedded]);
  useEffect(() => {
    if (embedded) return;
    document.title = `${featureNames[lang][feature]} · NavoPath`;
    document.documentElement.lang = zh ? "zh-CN" : "en";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = c.description;
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
  }, [lang, feature, zh, c.description, embedded]);

  return <div className="np-feature np-feature--reading">
    {!embedded && <header className="np-site-nav np-site-nav--product"><ProductNavigation feature={feature} lang={lang} icon={<img src={siteHref("/navopath-icon.png")} alt="" />} onLanguageChange={setLang} /></header>}
    <Content className="np-page-content">
      <section className="np-product-visual" aria-label={featureNames[lang][feature]}>
        {(wide && feature !== "plugins") || (embedded && feature === "workspace")
          ? <ProductDemoFrame key={lang} feature={feature === "workspace" ? "execute" : feature} lang={lang} embedded={embedded} />
          : <ProductScreenshot feature={feature} lang={lang} alt={featureNames[lang][feature]} eager />}
      </section>
      <section className="np-product-intro"><h1>{c.title}</h1><p>{c.description}</p></section>
      <div className="np-product-notes">{c.benefits.map(([title, description]) => <section key={title}><h2>{title}</h2><p>{description}</p></section>)}</div>
      <section className="np-faq"><h2>{zh ? "常见问题" : "Frequently Asked Questions"}</h2><div>{c.faq.map(([question, answer]) => <details key={question}><summary><span>{question}</span><UiPlusIcon size={18} strokeWidth={1.2} className="np-faq-plus" /></summary><p>{answer}</p></details>)}</div></section>
      <ProductSiteFooter lang={lang} next={c.next} />
    </Content>
  </div>;
}
