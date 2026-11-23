import { lazy, Suspense, useEffect, useState } from "react";
import { ProductMenu, SiteLanguageSwitch } from "./components/ProductMenu";
import { ProductIcon } from "./ProductIcon";
import { DESKTOP_DOWNLOAD_URL, DESKTOP_RELEASES_URL } from "./downloads";
import ProductDemoFrame from "./ProductDemoFrame";
import { featureHref, principleHref, siteHref, siteLanguage } from "./productSite";
import type { Language } from "./types";
import meta from "./betaHomeMeta.json";
import "./landing.css";
import "./beta-landing.css";

const BetaPluginMarket = lazy(() => import("./BetaPluginMarket"));

const github = "https://github.com/shawn89890916/NavoPath-planner";

const copy = {
  zh: {
    workspace: "工作区", market: "插件市场", principles: "设计原理", web: "打开网页版",
    title: "挑任务、排时间、临时改，都在同一页",
    intro: "左边是待安排的任务，右边是今天的时间轴。",
    play: "试排一个任务", reset: "重置试玩",
    drag: "把「调整网站布局」拖进右侧空档。",
    tap: "给「调整网站布局」选一个空档。",
    marketTitle: "需要什么，就加什么",
    marketBody: "日常排程用默认工作区。想导入课表、快速记下想法，再到插件市场添加。",
    timetable: "课表", timetableBody: "把固定课程放到时间轴背景，看看课间还能安排什么。",
    capture: "快速收集", captureBody: "临时想到的事，先放进今天的任务列表。",
    browse: "浏览插件市场", dock: "Windows 停靠",
    download: "下载 Windows 客户端",
    changelog: "更新日志", privacy: "隐私政策", issues: "问题反馈", sitemap: "页脚导航",
  },
  en: {
    workspace: "Workspace", market: "Plugin Market", principles: "Design Notes", web: "Open web app",
    title: "Pick tasks, block time, and shift plans—all on one page.",
    intro: "Tasks on the left, today’s timeline on the right.",
    play: "Try scheduling a task", reset: "Reset demo",
    drag: "Drag “Refine the website layout” into an open slot.",
    tap: "Pick an open slot for “Refine the website layout.”",
    marketTitle: "Add what you need",
    marketBody: "Use the default workspace to plan your day. Add plugins when you want to bring in your class timetable or capture ideas on the fly.",
    timetable: "Class Timetable", timetableBody: "See your classes behind your timeline and plan tasks around them.",
    capture: "Quick Capture", captureBody: "Send a thought straight to today’s task list.",
    browse: "Browse the plugin market", dock: "Windows Dock",
    download: "Download for Windows",
    changelog: "Changelog", privacy: "Privacy Policy", issues: "Report an issue", sitemap: "Footer navigation",
  },
} as const;

export default function BetaLandingPage() {
  const [lang, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const [ready, setReady] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const c = copy[lang];
  const marketPage = featureHref("plugins", lang);
  const notesPage = principleHref("index", lang);

  useEffect(() => {
    document.documentElement.classList.add("beta-landing-document");
    return () => document.documentElement.classList.remove("beta-landing-document");
  }, []);

  useEffect(() => {
    const language = lang === "zh" ? "zh-CN" : "en";
    document.documentElement.lang = language;
    document.title = meta[lang].title;
    const setMeta = (attribute: "name" | "property", name: string, value: string) => {
      let node = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
      if (!node) {
        node = document.createElement("meta");
        node.setAttribute(attribute, name);
        document.head.appendChild(node);
      }
      node.content = value;
    };
    setMeta("name", "description", meta[lang].description);
    setMeta("property", "og:title", meta[lang].title);
    setMeta("property", "og:description", meta[lang].share);
    const url = new URL(location.href);
    if (url.searchParams.get("lang") !== lang) {
      url.pathname = siteHref("/");
      url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    }
  }, [lang]);

  return <div className="landing beta-landing" lang={lang}>
    <nav className="landing-nav" aria-label="NavoPath">
      <a className="landing-brand" href={siteHref(`/?lang=${lang}`)}><ProductIcon compact /><span>NavoPath</span></a>
      <div className="landing-nav-links">
        <ProductMenu lang={lang} productLinks={{ workspace: "#workspace", plugins: "#plugins" }} />
        <ProductMenu lang={lang} kind="principles" />
        <ProductMenu lang={lang} kind="support" includeGitHub />
      </div>
      <div className="landing-nav-actions">
        <SiteLanguageSwitch lang={lang} onChange={(next) => { setReady(false); setScheduled(false); setLang(next); }} />
        <a className="np-start-link" href="/app">{c.web}</a>
      </div>
    </nav>

    <main className="beta-container">
      <section className="landing-cover beta-hero" id="top">
        <div className="landing-cover-content">
          <div className="landing-cover-logo"><ProductIcon /></div>
          <div className="landing-brand-copy">
            <p className="landing-product-name">NavoPath</p>
            <h1 className="landing-slogan">{c.title}</h1>
            <p className="beta-hero-intro">{c.intro}</p>
            <a className="beta-primary" href="#workspace">{c.play}</a>
          </div>
        </div>
      </section>

      <section id="workspace" aria-label={c.workspace} tabIndex={-1}>
        {/* The real workspace loads on approach. Show one instruction until the sample task is scheduled. */}
        {ready && <div className="beta-demo-controls">
          {!scheduled && <p>
            <span className="beta-drag-instruction">{c.drag}</span>
            <span className="beta-tap-instruction">{c.tap}</span>
          </p>}
          <button type="button" onClick={() => { setReady(false); setScheduled(false); setAttempt(value => value + 1); }}>{c.reset}</button>
        </div>}
        <div className="beta-workspace-window">
          <ProductDemoFrame key={`${lang}-${attempt}`} feature="execute" lang={lang} onReady={setReady} onProgress={setScheduled} />
        </div>
      </section>

      <section className="beta-market" id="plugins" aria-labelledby="beta-market-title">
        <div className="beta-market-copy">
          <h2 id="beta-market-title">{c.marketTitle}</h2>
          <p>{c.marketBody}</p>
          <dl>
            <div><dt>{c.timetable}</dt><dd>{c.timetableBody}</dd></div>
            <div><dt>{c.capture}</dt><dd>{c.captureBody}</dd></div>
          </dl>
          <a className="beta-link-button" href="#plugin-catalog">{c.browse}</a>
        </div>
        <div className="beta-market-preview" id="plugin-catalog" tabIndex={-1}>
          <Suspense fallback={null}><BetaPluginMarket lang={lang} /></Suspense>
        </div>
      </section>

      <div className="beta-final-actions">
        <a className="beta-primary" href="/app">{c.web}</a>
        <a className="beta-link-button" href={DESKTOP_DOWNLOAD_URL}>{c.download}</a>
        <div className="beta-secondary-links">
          <a href={featureHref("ai", lang)}>Navo AI</a>
          <a href={featureHref("workspace", lang)}>{c.dock}</a>
        </div>
      </div>
    </main>

    <footer className="beta-container beta-footer">
      <nav aria-label={c.sitemap}>
        <a href="#workspace">{c.workspace}</a>
        <a href={marketPage}>{c.market}</a>
        <a href={notesPage}>{c.principles}</a>
        <a href={DESKTOP_RELEASES_URL}>{c.changelog}</a>
        <a href={siteHref(`/privacy?lang=${lang}`)}>{c.privacy}</a>
        <a href={github}>GitHub</a>
        <a href={`${github}/issues`}>{c.issues}</a>
      </nav>
    </footer>
  </div>;
}
