import { useCallback, useEffect, useRef, useState } from "react";
import { ProductMenu } from "./components/ProductMenu";
import {
  featureHref,
  featureNames,
  siteLanguage,
  type DemoCommand,
  type ProductFeature,
} from "./productSite";
import type { FeatureCopy } from "./productSite";
import type { Language } from "./types";
import "./product-feature.css";

export default function ProductFeaturePage({
  feature,
  copy,
}: {
  feature: ProductFeature;
  copy: Record<Language, FeatureCopy>;
}) {
  const [lang, setLang] = useState(() =>
    siteLanguage(location.search, navigator.language),
  );
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const demoHost = useRef<HTMLElement>(null);
  const steps = useRef<(HTMLElement | null)[]>([]);
  const inView = useRef(false);
  const state = useRef({ stage, lang, paused });
  state.current = { stage, lang, paused };
  const c = copy[lang];
  const zh = lang === "zh";
  const send = useCallback((type: DemoCommand["type"], visible?: boolean) => {
    frame.current?.contentWindow?.postMessage(
      {
        channel: "navopath-product-demo",
        type,
        stage: state.current.stage,
        lang: state.current.lang,
        visible,
      } satisfies DemoCommand,
      location.origin,
    );
  }, []);
  useEffect(() => {
    document.documentElement.classList.add("product-site-document");
    return () =>
      document.documentElement.classList.remove("product-site-document");
  }, []);
  useEffect(() => {
    document.title = `${featureNames[lang][feature]} · NavoPath`;
    document.documentElement.lang = zh ? "zh-CN" : "en";
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.append(meta);
    }
    meta.content = c.description;
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
    if (ready) {
      setPaused(false);
      send("stage");
    }
  }, [lang, feature, c.description]);
  useEffect(() => {
    const host = demoHost.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "400px" },
    );
    const visibility = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      send("visibility", entry.isIntersecting);
    });
    observer.observe(host);
    visibility.observe(host);
    return () => {
      observer.disconnect();
      visibility.disconnect();
    };
  }, [send]);
  useEffect(() => {
    if (!mounted || ready) return;
    const timer = setTimeout(() => setFailed(true), 15000);
    return () => clearTimeout(timer);
  }, [mounted, ready, attempt]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.channel !== "navopath-product-demo"
      )
        return;
      if (event.data.type === "ready") {
        setReady(true);
        setFailed(false);
        send("stage");
        send("visibility", inView.current);
      }
      if (event.data.type === "error") {
        setFailed(true);
        setReady(false);
      }
      if (event.data.type === "interacting") setPaused(true);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [send]);
  useEffect(() => {
    setReady(false);
    setFailed(false);
    setPaused(false);
  }, [lang, feature]);
  useEffect(() => {
    if (ready && !paused) send("stage");
  }, [stage, ready, paused, send]);
  useEffect(() => {
    let scheduled = 0;
    const update = () => {
      scheduled = 0;
      if (!matchMedia("(min-width:900px) and (min-height:700px)").matches)
        return;
      let next = 0;
      steps.current.forEach((element, index) => {
        if (
          element &&
          element.getBoundingClientRect().top <= innerHeight * 0.42
        )
          next = index;
      });
      setStage(next);
    };
    const request = () => {
      if (!scheduled) scheduled = requestAnimationFrame(update);
    };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    request();
    return () => {
      removeEventListener("scroll", request);
      removeEventListener("resize", request);
      cancelAnimationFrame(scheduled);
    };
  }, []);
  const choose = (index: number) => {
    setStage(index);
    if (matchMedia("(min-width:900px) and (min-height:700px)").matches)
      steps.current[index]?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
  };
  return (
    <div className={`np-feature np-feature--${feature}`}>
      <header className="np-site-nav">
        <a className="np-site-brand" href="/">
          <img src={`${import.meta.env.BASE_URL}navopath-icon.png`} alt="" />
          NavoPath
        </a>
        <div className="np-site-nav-links">
          <ProductMenu lang={lang} />
          <a href={`/changelog?lang=${lang}`}>
            {zh ? "更新日志" : "Changelog"}
          </a>
        </div>
        <div className="np-site-nav-actions">
          <button type="button" onClick={() => setLang(zh ? "en" : "zh")}>
            {zh ? "EN" : "中"}
          </button>
          <a href="/app">
            {zh ? "直接开始" : "Start now"}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <main>
        <section className="np-feature-intro">
          <a className="np-back" href="/">
            ← {zh ? "返回首页" : "Back to home"}
          </a>
          <p className="np-eyebrow">NAVOPATH / {featureNames[lang][feature]}</p>
          <h1>{c.title}</h1>
          <p className="np-intro-description">{c.description}</p>
          <a className="np-text-link" href="#experience">
            {zh ? "向下探索，动手试试" : "Explore and try it yourself"}
            <span aria-hidden="true">↓</span>
          </a>
        </section>
        <section
          id="experience"
          className="np-story"
          aria-label={zh ? "产品演示" : "Product demonstration"}
        >
          <nav
            className="np-stage-nav"
            aria-label={zh ? "演示阶段" : "Demo stages"}
          >
            {c.steps.map(([title], index) => (
              <button
                key={index}
                type="button"
                aria-current={stage === index ? "step" : undefined}
                onClick={() => choose(index)}
              >
                <span>0{index + 1}</span>
                {title}
              </button>
            ))}
          </nav>
          <div className="np-story-steps">
            {c.steps.map(([title, description], index) => (
              <section
                key={index}
                className={`np-story-step${stage === index ? " is-active" : ""}`}
                ref={(element) => {
                  steps.current[index] = element;
                }}
              >
                <span className="np-eyebrow">
                  0{index + 1} / {featureNames[lang][feature]}
                </span>
                <h2><button className="np-step-heading" type="button" onClick={() => choose(index)}>{title}</button></h2>
                <p>{description}</p>
                <span className="np-step-note">
                  {zh ? "在右侧演示中试试" : "Try it in the live example"} ↗
                </span>
              </section>
            ))}
          </div>
          <aside className="np-demo-host" ref={demoHost}>
            <div className="np-demo-caption">
              <span>
                <i aria-hidden="true" />
                {zh ? "示例一天" : "An example day"} ·{" "}
                {featureNames[lang][feature]}
              </span>
              <span aria-live="polite">
                {paused
                  ? zh
                    ? "自由探索"
                    : "Explore freely"
                  : zh
                    ? "跟随讲解"
                    : "Follow the story"}
              </span>
            </div>
            <div className="np-demo-window">
              {mounted && (
                <iframe
                  key={attempt}
                  ref={frame}
                  src={`/product-demo/${feature}?lang=${lang}`}
                  title={`${featureNames[lang][feature]} · ${zh ? "交互演示" : "Interactive demo"}`}
                  onError={() => setFailed(true)}
                />
              )}
              {(!ready || failed) && (
                <div className="np-demo-status" role="status">
                  <strong>
                    {failed
                      ? zh
                        ? "演示暂时未能加载"
                        : "The demo could not load"
                      : zh
                        ? "正在打开示例…"
                        : "Opening the example…"}
                  </strong>
                  <p>{c.steps[stage][1]}</p>
                  {failed && (
                    <button
                      type="button"
                      onClick={() => {
                        setReady(false);
                        setFailed(false);
                        setAttempt((value) => value + 1);
                      }}
                    >
                      {zh ? "重新加载" : "Try again"}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="np-demo-controls">
              <p>
                {zh
                  ? "点击或拖动后暂停讲解，操作只影响此示例。"
                  : "Click or drag to explore. Changes stay in this example."}
              </p>
              <div>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => {
                    setPaused(false);
                    send("stage");
                  }}
                >
                  {zh ? "继续演示" : "Follow the story"}
                </button>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => {
                    setPaused(false);
                    send("reset");
                  }}
                >
                  {zh ? "重置" : "Reset"}
                </button>
              </div>
            </div>
          </aside>
        </section>
        <section
          className="np-benefits"
          aria-label={zh ? "功能特点" : "Features"}
        >
          {c.benefits.map(([title, description], index) => (
            <article key={title}>
              <span className="np-eyebrow">0{index + 1}</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>
        <section className="np-faq">
          <div>
            <p className="np-eyebrow">FAQ</p>
            <h2>
              {zh
                ? "开始之前，你可能想知道。"
                : "A few things before you start."}
            </h2>
          </div>
          <div>
            {c.faq.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">＋</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="np-feature-next">
          <p className="np-eyebrow">{zh ? "继续探索" : "KEEP EXPLORING"}</p>
          <h2>
            {feature === "planning"
              ? zh
                ? "接下来，为任务安排时间。"
                : "Next, make time for your tasks."
              : feature === "execute"
                ? zh
                  ? "安排今天，也可以有帮手。"
                  : "Get a little help with your day."
                : zh
                  ? "从你的第一个目标开始。"
                  : "Start with a goal of your own."}
          </h2>
          <div>
            <a href={featureHref(c.next, lang)}>
              {featureNames[lang][c.next]} →
            </a>
            <a href="/app">{zh ? "直接开始" : "Start now"} ↗</a>
          </div>
        </section>
      </main>
      <footer className="np-site-footer">
        <a href="/">NavoPath / Plan the path. Execute today.</a>
        <a
          href="https://afdian.com/a/233cxy/plan"
          target="_blank"
          rel="noreferrer"
        >
          {zh ? "支持开发" : "Support development"}
        </a>
        <span>© 2026 Xiaoyang Chen</span>
      </footer>
    </div>
  );
}
