import { useCallback, useEffect, useRef, useState } from "react";
import { UiPlusIcon } from "./components/UiIcons";
import { featureHref, featureNames, productFeature, siteLanguage, type DemoCommand, type FeatureCopy, type ProductFeature } from "./productSite";
import ProductStory, { type MenuBounds, type StoryLayout } from "./ProductStory";
import ProductNavigation from "./ProductNavigation";
import ProductSiteFooter from "./ProductSiteFooter";
import "./product-feature.css";

export default function ProductFeaturePage({ feature, copy }: { feature: ProductFeature; copy: Record<"zh" | "en", FeatureCopy> }) {
  const [lang, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const [portrait, setPortrait] = useState(() => matchMedia("(orientation: portrait)").matches);
  const [mounted, setMounted] = useState(false), [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [storyLayout, setStoryLayout] = useState<StoryLayout | null>(null);
  const [menu, setMenu] = useState<{ id: string; bounds: MenuBounds } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null), host = useRef<HTMLDivElement>(null), visible = useRef(true);
  const c = copy[lang], zh = lang === "zh", immersive = !portrait;
  const send = useCallback((type: DemoCommand["type"], inView?: boolean) => frame.current?.contentWindow?.postMessage({ channel: "navopath-product-demo", type, stage: feature === "execute" ? 2 : 1, lang, visible: inView } satisfies DemoCommand, location.origin), [feature, lang]);
  useEffect(() => {
    const media = matchMedia("(orientation: portrait)");
    const update = () => { setPortrait(media.matches); setMounted(false); setReady(false); setFailed(false); setStoryLayout(null); setMenu(null); };
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
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]'); if (meta) meta.content = c.description;
    const url = new URL(location.href); url.searchParams.set("lang", lang); history.replaceState(null, "", url);
    setReady(false); setFailed(false);
    setMenu(null);
  }, [lang, feature, zh, c.description]);
  useEffect(() => {
    if (portrait || !host.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setMounted(true); }, { rootMargin: "400px" });
    const visibility = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; send("visibility", entry.isIntersecting); });
    observer.observe(host.current); visibility.observe(host.current);
    return () => { observer.disconnect(); visibility.disconnect(); };
  }, [send, portrait]);
  useEffect(() => {
    if (portrait || !mounted || ready) return;
    const timer = setTimeout(() => setFailed(true), 15000); return () => clearTimeout(timer);
  }, [mounted, ready, attempt, portrait]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "navopath-product-demo") return;
      if (event.data.type === "ready") { setReady(true); setFailed(false); send("stage"); send("visibility", visible.current); }
      if (event.data.type === "story-layout") {
        const value = event.data.layout;
        if (value && ["left", "top", "width", "height", "headerHeight"].every(key => typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0) && value.left + value.width <= innerWidth + 1 && value.top + value.height <= innerHeight + 1) setStoryLayout(value.width > 0 && value.height > 0 ? value : null);
      }
      if (event.data.type === "menu-layout" && typeof event.data.id === "string") {
        const { id, layout: bounds } = event.data;
        if (bounds === null) setMenu(current => current?.id === id ? null : current);
        else if (["left", "top", "width", "height"].every(key => typeof bounds?.[key] === "number" && Number.isFinite(bounds[key]) && bounds[key] >= 0) && bounds.left + bounds.width <= innerWidth + 1 && bounds.height <= innerHeight + 1) setMenu({ id, bounds });
      }
      if (event.data.type === "language" && (event.data.lang === "zh" || event.data.lang === "en")) setLang(event.data.lang);
      if (event.data.type === "error") { setFailed(true); setReady(false); }
      if (event.data.type === "navigate" && productFeature(`/features/${event.data.feature}`, "features")) location.assign(featureHref(event.data.feature, lang));
    };
    addEventListener("message", receive); return () => removeEventListener("message", receive);
  }, [send, lang]);
  return <div className={`np-feature np-feature--${feature}${portrait ? " np-feature--reading" : ""}${immersive ? " np-feature--immersive" : ""}${immersive && !storyLayout ? " np-feature--compact" : ""}`}>
    {!immersive && <header className="np-site-nav np-site-nav--product"><ProductNavigation feature={feature} lang={lang} icon={<img src={`${import.meta.env.BASE_URL}navopath-icon.png`} alt="" />} onLanguageChange={setLang} /></header>}
    <main>
      {!immersive && <section className="np-product-intro"><h1>{c.title}</h1><p>{c.description}</p></section>}
      {portrait ? <section className="np-product-notes">{c.benefits.map(([title, description]) => <section key={title}><h2>{title}</h2><p>{description}</p></section>)}</section> : <>
      <section className={`np-product-layout np-product-layout--${feature}${immersive ? " np-workspace-scroll" : ""}`} aria-label={featureNames[lang][feature]}>
        <div className="np-product-window" ref={host}>
          {mounted && <iframe key={attempt} ref={frame} src={`/product-demo/${feature}?lang=${lang}${immersive ? "&presentation=full" : ""}`} title={`${featureNames[lang][feature]} · ${zh ? "产品体验" : "Product preview"}`} onError={() => setFailed(true)} />}
          <div className="np-demo-status" role={ready && !failed ? undefined : "status"} aria-hidden={ready && !failed}>
            {failed ? <><p>{zh ? "暂时无法打开。" : "Unable to load."}</p><button type="button" onClick={() => { setReady(false); setFailed(false); setAttempt(attempt + 1); }}>{zh ? "重试" : "Retry"}</button></> : <><img src={`/product-entry-${feature}-${lang}.jpg`} width={1280} height={800} alt="" /><span className="np-demo-loading-label">{zh ? "正在打开产品体验…" : "Opening the product example…"}</span></>}
          </div>
        </div>
        {immersive && feature !== "ai" && storyLayout && <ProductStory lang={lang} copy={c} layout={storyLayout} menu={menu?.bounds} />}
      </section>
      {immersive && feature !== "ai" && !storyLayout && <><section className="np-product-intro"><h1>{c.title}</h1><p>{c.description}</p></section><ProductStory lang={lang} copy={c} layout={null} /></>}
      </>}
      <section className="np-faq"><h2>{zh ? "常见问题" : "FAQ"}</h2><div>{c.faq.map(([question, answer]) => <details key={question}><summary><span>{question}</span><UiPlusIcon size={18} strokeWidth={1.2} className="np-faq-plus" /></summary><p>{answer}</p></details>)}</div></section>
      <ProductSiteFooter lang={lang} next={c.next} />
    </main>
  </div>;
}
