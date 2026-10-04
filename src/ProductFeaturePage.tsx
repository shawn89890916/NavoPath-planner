import { useCallback, useEffect, useRef, useState } from "react";
import { ProductMenu, SiteLanguageSwitch } from "./components/ProductMenu";
import { featureHref, featureNames, productFeature, siteLanguage, type DemoCommand, type FeatureCopy, type ProductFeature } from "./productSite";
import ProductStory, { type StoryLayout } from "./ProductStory";
import "./product-feature.css";

export default function ProductFeaturePage({ feature, copy }: { feature: ProductFeature; copy: Record<"zh" | "en", FeatureCopy> }) {
  const [lang, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const [mounted, setMounted] = useState(false), [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [storyLayout, setStoryLayout] = useState<StoryLayout | null>(null);
  const frame = useRef<HTMLIFrameElement>(null), host = useRef<HTMLDivElement>(null), visible = useRef(true);
  const c = copy[lang], zh = lang === "zh", immersive = feature !== "ai";
  const send = useCallback((type: DemoCommand["type"], inView?: boolean) => frame.current?.contentWindow?.postMessage({ channel: "navopath-product-demo", type, stage: feature === "execute" ? 2 : 1, lang, visible: inView } satisfies DemoCommand, location.origin), [feature, lang]);
  useEffect(() => {
    document.documentElement.classList.add("product-site-document");
    return () => document.documentElement.classList.remove("product-site-document");
  }, []);
  useEffect(() => {
    document.title = `${featureNames[lang][feature]} · NavoPath`;
    document.documentElement.lang = zh ? "zh-CN" : "en";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]'); if (meta) meta.content = c.description;
    const url = new URL(location.href); url.searchParams.set("lang", lang); history.replaceState(null, "", url);
    setReady(false); setFailed(false);
  }, [lang, feature, zh, c.description]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setMounted(true); }, { rootMargin: "400px" });
    const visibility = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; send("visibility", entry.isIntersecting); });
    observer.observe(host.current); visibility.observe(host.current);
    return () => { observer.disconnect(); visibility.disconnect(); };
  }, [send]);
  useEffect(() => {
    if (!mounted || ready) return;
    const timer = setTimeout(() => setFailed(true), 15000); return () => clearTimeout(timer);
  }, [mounted, ready, attempt]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "navopath-product-demo") return;
      if (event.data.type === "ready") { setReady(true); setFailed(false); send("stage"); send("visibility", visible.current); }
      if (event.data.type === "story-layout") {
        const value = event.data.layout;
        if (value && ["left", "top", "width", "height", "headerHeight"].every(key => typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0) && value.left + value.width <= innerWidth + 1 && value.top + value.height <= innerHeight + 1) setStoryLayout(value.width > 0 && value.height > 0 ? value : null);
      }
      if (event.data.type === "language" && (event.data.lang === "zh" || event.data.lang === "en")) setLang(event.data.lang);
      if (event.data.type === "error") { setFailed(true); setReady(false); }
      if (event.data.type === "navigate" && productFeature(`/features/${event.data.feature}`, "features")) location.assign(featureHref(event.data.feature, lang));
    };
    addEventListener("message", receive); return () => removeEventListener("message", receive);
  }, [send, lang]);
  return <div className={`np-feature np-feature--${feature}${immersive ? " np-feature--immersive" : ""}${immersive && !storyLayout ? " np-feature--compact" : ""}`}>
    {!immersive && <header className="np-site-nav">
      <ProductMenu lang={lang} kind="brand"><img src={`${import.meta.env.BASE_URL}navopath-icon.png`} alt="" /><span>NavoPath</span></ProductMenu>
      <div className="np-site-actions"><SiteLanguageSwitch lang={lang} onChange={setLang} /><a className="np-start-link" href="/app">{zh ? "现在开始" : "Start now"}</a></div>
    </header>}
    <main>
      {!immersive && <section className="np-product-intro"><h1>{c.title}</h1><p>{c.description}</p></section>}
      <section className={`np-product-layout np-product-layout--${feature}${immersive ? " np-workspace-scroll" : ""}`} aria-label={featureNames[lang][feature]}>
        <div className="np-product-window" ref={host}>
          {mounted && <iframe key={attempt} ref={frame} src={`/product-demo/${feature}?lang=${lang}${immersive ? "&presentation=full" : ""}`} title={`${featureNames[lang][feature]} · ${zh ? "产品体验" : "Product preview"}`} onError={() => setFailed(true)} />}
          {(!ready || failed) && <div className="np-demo-status" role="status"><p>{failed ? (zh ? "暂时无法打开。" : "Unable to load.") : "NavoPath…"}</p>{failed && <button type="button" onClick={() => { setReady(false); setFailed(false); setAttempt(attempt + 1); }}>{zh ? "重试" : "Retry"}</button>}</div>}
        </div>
        {immersive && storyLayout && <ProductStory lang={lang} copy={c} layout={storyLayout} />}
        {!immersive && <aside className="np-product-notes">{c.benefits.map(([title, description]) => <div key={title}><h2>{title}</h2><p>{description}</p></div>)}</aside>}
      </section>
      {immersive && !storyLayout && <><section className="np-product-intro"><h1>{c.title}</h1><p>{c.description}</p></section><ProductStory lang={lang} copy={c} layout={null} /></>}
      <section className="np-faq"><h2>{zh ? "常见问题" : "FAQ"}</h2><div>{c.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
      <footer className="np-feature-footer"><a href={featureHref(c.next, lang)}>{featureNames[lang][c.next]}</a>{immersive ? <><a href="https://afdian.com/a/233cxy/plan" target="_blank" rel="noreferrer">{zh ? "爱发电" : "Afdian"}</a><a href="https://github.com/shawn89890916/NavoPath-planner" target="_blank" rel="noreferrer">GitHub</a><span className="np-personal-placeholder" role="link" aria-disabled="true">{zh ? "个人网页" : "Personal website"}</span></> : <ProductMenu lang={lang} kind="support" />}<span>© 2026 NavoPath</span></footer>
    </main>
  </div>;
}
