import { useEffect, useRef, useState } from "react";
import { UiPlusIcon } from "./components/UiIcons";
import { featureNames, siteLanguage, type FeatureCopy, type ProductFeature } from "./productSite";
import ProductNavigation from "./ProductNavigation";
import ProductScreenshot from "./ProductScreenshot";
import ProductSiteFooter from "./ProductSiteFooter";
import "./product-feature.css";

const landscape = "(orientation: landscape)";

function ProductDemoFrame({ feature, lang }: { feature: "workspace" | "ai"; lang: "zh" | "en" }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const zh = lang === "zh";

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setMounted(true);
    }, { rootMargin: "400px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mounted || status !== "loading") return;
    const timeout = window.setTimeout(() => setStatus("failed"), 15000);
    return () => window.clearTimeout(timeout);
  }, [mounted, status, attempt]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let visible = false;
    const sendVisibility = () => frame.current?.contentWindow?.postMessage(
      { channel: "navopath-product-demo", type: "visibility", visible },
      location.origin,
    );
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sendVisibility();
    });
    observer.observe(element);
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "navopath-product-demo") return;
      if (event.data.type === "ready") {
        setStatus("ready");
        sendVisibility();
      }
      if (event.data.type === "error") setStatus("failed");
    };
    addEventListener("message", receive);
    return () => {
      observer.disconnect();
      removeEventListener("message", receive);
    };
  }, []);

  return <div className="np-product-window" ref={host}>
    {mounted && status !== "failed" && <iframe
      key={attempt}
      ref={frame}
      src={`/product-demo/${feature}?lang=${lang}&presentation=full`}
      title={`${featureNames[lang][feature]} · ${zh ? "交互演示" : "Interactive demo"}`}
      tabIndex={status === "ready" ? undefined : -1}
      aria-hidden={status !== "ready" || undefined}
      onError={() => setStatus("failed")}
    />}
    <div className="np-demo-status" aria-hidden={status === "ready" || undefined}>
      <ProductScreenshot feature={feature} lang={lang} alt={featureNames[lang][feature]} eager />
      <div className="np-demo-loading-label">
        <span role="status">{status === "failed" ? (zh ? "演示暂时无法加载。" : "Unable to load the demo.") : (zh ? "正在加载交互演示…" : "Loading interactive demo…")}</span>
        {status === "failed" && <button type="button" onClick={() => { setAttempt(value => value + 1); setStatus("loading"); }}>{zh ? "重试" : "Retry"}</button>}
      </div>
    </div>
  </div>;
}

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
    <header className="np-site-nav np-site-nav--product"><ProductNavigation feature={feature} lang={lang} icon={<img src="/navopath-icon.png" alt="" />} onLanguageChange={setLang} /></header>
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
