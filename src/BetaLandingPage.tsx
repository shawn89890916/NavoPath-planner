import { useEffect, useState } from "react";
import { SiteLanguageSwitch } from "./components/ProductMenu";
import { DESKTOP_DOWNLOAD_URL, DESKTOP_RELEASES_URL } from "./downloads";
import ProductDemoFrame from "./ProductDemoFrame";
import { featureHref, principleHref, siteHref, siteLanguage } from "./productSite";
import type { Language } from "./types";
import meta from "./betaHomeMeta.json";
import "./beta-landing.css";

const github = "https://github.com/shawn89890916/NavoPath-planner";

const copy = {
  zh: {
    workspace: "工作区", market: "插件市场", principles: "设计原理", web: "打开网页版",
    title: "挑任务、排时间、临时改，都在同一页",
    intro: "左边是待安排的任务，右边是今天的时间轴。",
    play: "试排一个任务", reset: "重置试玩",
    drag: "把「调整网站布局」拖进右侧空档。",
    tap: "给「调整网站布局」选一个空档。",
    workspaceAlt: "NavoPath 工作区里的待安排任务与当天时间轴。",
    marketTitle: "需要什么，就加什么",
    marketBody: "日常排程用默认工作区。想导入课表、快速记下想法，再到插件市场添加。",
    timetable: "课表", timetableBody: "把固定课程放到时间轴背景，看看课间还能安排什么。",
    capture: "快速收集", captureBody: "临时想到的事，先放进今天的任务列表。",
    marketAlt: "NavoPath 插件市场中的插件列表。",
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
    workspaceAlt: "NavoPath workspace with unscheduled tasks and the daily timeline.",
    marketTitle: "Add what you need",
    marketBody: "Use the default workspace to plan your day. Add plugins when you want to bring in your class timetable or capture ideas on the fly.",
    timetable: "Class Timetable", timetableBody: "See your classes behind your timeline and plan tasks around them.",
    capture: "Quick Capture", captureBody: "Send a thought straight to today’s task list.",
    marketAlt: "Plugin listings in the NavoPath Plugin Market.",
    browse: "Browse the plugin market", dock: "Windows Dock",
    download: "Download for Windows",
    changelog: "Changelog", privacy: "Privacy Policy", issues: "Report an issue", sitemap: "Footer navigation",
  },
} as const;

function WorkspacePreview({ lang }: { lang: Language }) {
  // The two images come from the matching Beta 61 layouts and languages.
  const c = copy[lang];
  return <picture className="beta-workspace-preview">
    <source media="(max-width: 600px)" srcSet={siteHref(`/beta61-home-${lang}-mobile.webp`)} />
    <img src={siteHref(`/beta61-home-${lang}-wide.webp`)} alt={c.workspaceAlt} fetchPriority="high" width={1440} height={900} />
  </picture>;
}

export default function BetaLandingPage() {
  const [lang, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const c = copy[lang];
  const marketPage = featureHref("plugins", lang);
  const notesPage = principleHref("index", lang);
  const workspacePreview = <WorkspacePreview lang={lang} />;

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

  return <div className="beta-landing">
    <header className="beta-header">
      <div className="beta-container beta-header-inner">
        <a className="beta-wordmark" href={siteHref(`/?lang=${lang}`)}>
          <img src={siteHref("/navopath-icon.png")} alt="" width={26} height={26} />
          <span>NavoPath</span>
        </a>
        <nav className="beta-nav" aria-label={lang === "zh" ? "主导航" : "Main navigation"}>
          <a href="#workspace">{c.workspace}</a>
          <a href="#plugins">{c.market}</a>
          <a href={notesPage}>{c.principles}</a>
        </nav>
        <div className="beta-header-actions">
          <SiteLanguageSwitch lang={lang} onChange={(next) => { setReady(false); setScheduled(false); setLang(next); }} />
          <a className="beta-link-button" href="/app">{c.web}</a>
        </div>
      </div>
    </header>

    <main className="beta-container">
      <section className="beta-hero">
        <h1>{c.title}</h1>
        <p>{c.intro}</p>
        <a className="beta-primary" href="#workspace" onClick={() => setPlaying(true)}>{c.play}</a>
      </section>

      <section id="workspace" aria-label={c.workspace} tabIndex={-1}>
        {/* The hero screenshot is the resting state. Only the active demo needs instructions. */}
        {playing && ready && <div className="beta-demo-controls">
          {!scheduled && <p>
            <span className="beta-drag-instruction">{c.drag}</span>
            <span className="beta-tap-instruction">{c.tap}</span>
          </p>}
          <button type="button" onClick={() => { setReady(false); setScheduled(false); setAttempt(value => value + 1); }}>{c.reset}</button>
        </div>}
        <div className="beta-workspace-window">
          {playing
            ? <ProductDemoFrame key={`${lang}-${attempt}`} feature="execute" lang={lang} fallback={workspacePreview} onReady={setReady} onProgress={setScheduled} />
            : workspacePreview}
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
          <a className="beta-link-button" href={marketPage}>{c.browse}</a>
        </div>
        <figure className="beta-market-preview">
          <img src={siteHref(`/beta61-market-${lang}.webp`)} alt={c.marketAlt} loading="lazy" />
        </figure>
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
