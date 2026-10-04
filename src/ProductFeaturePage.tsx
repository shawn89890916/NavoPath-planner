import { useCallback, useEffect, useRef, useState } from "react";
import { ProductMenu, SiteLanguageSwitch } from "./components/ProductMenu";
import { featureHref, featureNames, productFeature, siteLanguage, type DemoCommand, type FeatureCopy, type ProductFeature } from "./productSite";
import "./product-feature.css";

export default function ProductFeaturePage({ feature, copy }: { feature: ProductFeature; copy: Record<"zh" | "en", FeatureCopy> }) {
  const [lang, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const [mounted, setMounted] = useState(false), [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [compactStory, setCompactStory] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null), host = useRef<HTMLDivElement>(null), visible = useRef(true), storyHost = useRef<HTMLElement>(null), activeStory = useRef(0);
  const c = copy[lang], zh = lang === "zh", immersive = feature !== "ai";
  const send = useCallback((type: DemoCommand["type"], inView?: boolean) => frame.current?.contentWindow?.postMessage({ channel: "navopath-product-demo", type, stage: type === "story" ? Math.round(activeStory.current) : feature === "execute" ? 2 : 1, progress: activeStory.current, lang, visible: inView } satisfies DemoCommand, location.origin), [feature, lang]);
  useEffect(() => {
    if (!immersive) return;
    let pending = 0;
    const update = () => {
      pending = 0;
      const element = storyHost.current;
      if (!element) return;
      const span = Math.max(1, element.offsetHeight - innerHeight);
      const progress = Math.max(0, Math.min(1, -element.getBoundingClientRect().top / span)) * (c.benefits.length - 1);
      if (progress !== activeStory.current) { activeStory.current = progress; send("story"); }
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(update); };
    addEventListener("scroll", schedule, { passive: true }); addEventListener("resize", schedule); update();
    return () => { removeEventListener("scroll", schedule); removeEventListener("resize", schedule); cancelAnimationFrame(pending); };
  }, [immersive, send, c.benefits.length]);
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
    const resize = new ResizeObserver(([entry]) => setCompactStory(entry.contentRect.width < 1265 || matchMedia("(orientation: portrait)").matches));
    resize.observe(host.current);
    return () => { observer.disconnect(); visibility.disconnect(); resize.disconnect(); };
  }, [send]);
  useEffect(() => {
    if (!mounted || ready) return;
    const timer = setTimeout(() => setFailed(true), 15000); return () => clearTimeout(timer);
  }, [mounted, ready, attempt]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "navopath-product-demo") return;
      if (event.data.type === "ready") { setReady(true); setFailed(false); send("stage"); send("story"); send("visibility", visible.current); }
      if (event.data.type === "story-ready") send("story");
      if (event.data.type === "language" && (event.data.lang === "zh" || event.data.lang === "en")) setLang(event.data.lang);
      if (event.data.type === "error") { setFailed(true); setReady(false); }
      if (event.data.type === "navigate" && productFeature(`/features/${event.data.feature}`, "features")) location.assign(featureHref(event.data.feature, lang));
    };
    addEventListener("message", receive); return () => removeEventListener("message", receive);
  }, [send, lang]);
  return <div className={`np-feature np-feature--${feature}${immersive ? " np-feature--immersive" : ""}${compactStory ? " np-feature--compact" : ""}`}>
    {!immersive && <header className="np-site-nav">
      <ProductMenu lang={lang} kind="brand"><img src={`${import.meta.env.BASE_URL}navopath-icon.png`} alt="" /><span>NavoPath</span></ProductMenu>
      <div className="np-site-actions"><SiteLanguageSwitch lang={lang} onChange={setLang} /><a className="np-start-link" href="/app">{zh ? "现在开始" : "Start now"}</a></div>
    </header>}
    <main>
      <section className={`np-product-intro${immersive ? " np-visually-hidden" : ""}`}><h1>{c.title}</h1><p>{c.description}</p></section>
      <section ref={storyHost} className={`np-product-layout np-product-layout--${feature}${immersive ? " np-workspace-scroll" : ""}`} aria-label={featureNames[lang][feature]}>
        <div className="np-product-window" ref={host}>
          {mounted && <iframe key={attempt} ref={frame} src={`/product-demo/${feature}?lang=${lang}${immersive ? "&presentation=full" : ""}`} title={`${featureNames[lang][feature]} · ${zh ? "产品体验" : "Product preview"}`} onError={() => setFailed(true)} />}
          {(!ready || failed) && <div className="np-demo-status" role="status"><p>{failed ? (zh ? "暂时无法打开。" : "Unable to load.") : "NavoPath…"}</p>{failed && <button type="button" onClick={() => { setReady(false); setFailed(false); setAttempt(attempt + 1); }}>{zh ? "重试" : "Retry"}</button>}</div>}
        </div>
        {!immersive && <aside className="np-product-notes">{c.benefits.map(([title, description]) => <div key={title}><h2>{title}</h2><p>{description}</p></div>)}</aside>}
      </section>
      {immersive && <aside className="np-product-notes np-mobile-story"><h2>{c.title}</h2><p>{c.description}</p>{c.benefits.map(([title, description]) => <div key={title}><h3>{title}</h3><p>{description}</p></div>)}</aside>}
      <section className="np-faq"><h2>{zh ? "常见问题" : "FAQ"}</h2><div>{c.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
      <footer className="np-feature-footer"><a href={featureHref(c.next, lang)}>{featureNames[lang][c.next]}</a>{immersive ? <><a href="https://afdian.com/a/233cxy/plan" target="_blank" rel="noreferrer">{zh ? "爱发电" : "Afdian"}</a><a href="https://github.com/shawn89890916/NavoPath-planner" target="_blank" rel="noreferrer">GitHub</a><span className="np-personal-placeholder" role="link" aria-disabled="true">{zh ? "个人网页" : "Personal website"}</span></> : <ProductMenu lang={lang} kind="support" />}<span>© 2026 NavoPath</span></footer>
    </main>
  </div>;
}
