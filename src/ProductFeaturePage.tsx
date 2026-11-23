import { useEffect, useState } from "react";
import { UiPlusIcon } from "./components/UiIcons";
import { featureNames, siteHref, siteLanguage, type FeatureCopy, type ProductFeature } from "./productSite";
import ProductDemoFrame from "./ProductDemoFrame";
import ProductNavigation from "./ProductNavigation";
import ProductScreenshot from "./ProductScreenshot";
import ProductSiteFooter from "./ProductSiteFooter";
import "./product-feature.css";

const landscape = "(orientation: landscape)";

export default function ProductFeaturePage({ feature, copy }: { feature: ProductFeature; copy: Record<"zh" | "en", FeatureCopy> }) {
  const [lang, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const [wide, setWide] = useState(() => matchMedia(landscape).matches);
  const c = copy[lang];
  const zh = lang === "zh";

  useEffect(() => {
    const media = matchMedia(landscape);
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.classList.add("product-site-document");
    return () => document.documentElement.classList.remove("product-site-document");
  }, []);
  useEffect(() => {
    document.title = `${featureNames[lang][feature]} · NavoPath`;
    document.documentElement.lang = zh ? "zh-CN" : "en";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = c.description;
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
  }, [lang, feature, zh, c.description]);

  return <div className="np-feature np-feature--reading">
    <header className="np-site-nav np-site-nav--product"><ProductNavigation feature={feature} lang={lang} icon={<img src={siteHref("/navopath-icon.png")} alt="" />} onLanguageChange={setLang} /></header>
    <main>
      <section className="np-product-visual" aria-label={featureNames[lang][feature]}>
        {wide && feature !== "plugins"
          ? <ProductDemoFrame key={lang} feature={feature} lang={lang} />
          : <ProductScreenshot feature={feature} lang={lang} alt={featureNames[lang][feature]} eager />}
      </section>
      <section className="np-product-intro"><h1>{c.title}</h1><p>{c.description}</p></section>
      <div className="np-product-notes">{c.benefits.map(([title, description]) => <section key={title}><h2>{title}</h2><p>{description}</p></section>)}</div>
      <section className="np-faq"><h2>{zh ? "常见问题" : "Frequently Asked Questions"}</h2><div>{c.faq.map(([question, answer]) => <details key={question}><summary><span>{question}</span><UiPlusIcon size={18} strokeWidth={1.2} className="np-faq-plus" /></summary><p>{answer}</p></details>)}</div></section>
      <ProductSiteFooter lang={lang} next={c.next} />
    </main>
  </div>;
}
