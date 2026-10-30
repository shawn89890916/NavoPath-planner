import { useEffect, useState } from "react";
import ProductNavigation from "./ProductNavigation";
import ProductSiteFooter from "./ProductSiteFooter";
import { PRINCIPLES, principleNames, principleHref, siteLanguage, type Principle, type PrincipleCopy } from "./productSite";
import type { Language } from "./types";
import "./product-feature.css";
import "./product-principles.css";

const directory = {
  zh: {
    label: "设计原理", title: "清晰直观背后的设计思考。", description: "从目标拆解到日常落地，串联规划与执行的六个核心设计原则。",
    read: "查阅详情", back: "所有设计原理", example: "设计原理 · 流程示意", sources: "深入了解", next: "接着读",
    topics: {
      jev: "快速记录任务本体，估时与层级归属按需细化。",
      feedback: "AI 建议保持克制，手动安排始终具备最高优先权。",
      time: "结合 15 分钟时间网格与空档，让任务找到合适位置。",
      control: "AI 操作完全透明：预览确认、可微调、可撤回。",
      views: "树状结构、列表、看板与矩阵无缝切换，数据完全同源。",
      records: "区分“任务本体”与“日程安排”，让计划更具灵活性。",
    },
  },
  en: {
    label: "Principles", title: "Why it works this way.", description: "Six core design principles connecting long-term goals to everyday execution.",
    read: "Explore principle", back: "All Principles", example: "Principles · Workflow Diagram", sources: "Read further", next: "Read next",
    topics: {
      jev: "Capture tasks quickly; refine duration and hierarchy when needed.",
      feedback: "AI suggestions stay measured, with manual edits taking priority.",
      time: "How free slots and a 15-minute grid help tasks find realistic room.",
      control: "Inspect, adjust, and undo every change proposed by AI.",
      views: "Tree, List, Kanban, and Matrix share a single source of truth.",
      records: "Separate task definitions from temporal schedules for flexible planning.",
    },
  },
};

export default function ProductPrinciplesPage({ topic, copy }: { topic?: Principle; copy?: Record<Language, PrincipleCopy> }) {
  const [lang, setLang] = useState(() => siteLanguage(location.search, navigator.language));
  const d = directory[lang], article = copy?.[lang], c = article || d;
  const next = topic ? PRINCIPLES[(PRINCIPLES.indexOf(topic) + 1) % PRINCIPLES.length] : null;
  useEffect(() => {
    document.documentElement.classList.add("product-site-document");
    return () => document.documentElement.classList.remove("product-site-document");
  }, []);
  useEffect(() => {
    document.title = `${article ? c.title : d.label} · NavoPath`;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = c.description;
    const url = new URL(location.href); url.searchParams.set("lang", lang); history.replaceState(null, "", url);
  }, [lang, c, d, article]);
  return <div className={`np-feature np-principles${article ? " np-principles--article" : ""}`}>
    <header className="np-site-nav np-site-nav--product">
      <ProductNavigation feature="principles" lang={lang} icon={<img src={`${import.meta.env.BASE_URL}navopath-icon.png`} alt="" />} onLanguageChange={setLang} />
    </header>
    <main>
      <section className="np-principles-intro">
        <div>
          {article ? <a className="np-principles-label np-principle-link" href={principleHref("index", lang)}>{d.back}</a> : <p className="np-principles-label">{d.label}</p>}
          <h1>{c.title}</h1><p>{c.description}</p>
        </div>
        {article && <figure className="np-principle-process"><figcaption>{d.example}</figcaption><ol>{article.steps.map(([label, value]) => <li key={label}><span>{label}</span><p>{value}</p></li>)}</ol></figure>}
      </section>
      {article ? <>
        <article aria-label={c.title}>{article.sections.map(([title, body], index) => <section className="np-principle" key={title} aria-labelledby={`section-${index}`}><h2 id={`section-${index}`}>{title}</h2><p>{body}</p></section>)}</article>
        <aside className="np-principles-sources" aria-label={d.sources}><h2>{d.sources}</h2>{article.sources.map(([title, url]) => <a key={url} href={url} target="_blank" rel="noreferrer">{title}</a>)}</aside>
        {next && <nav className="np-principle-next" aria-label={d.next}><span>{d.next}</span><a className="np-principle-link" href={principleHref(next, lang)}>{principleNames[lang][next]}</a><a className="np-principle-link" href={principleHref("index", lang)}>{d.back}</a></nav>}
      </> : <nav className="np-principles-grid" aria-label={d.label}>
        {PRINCIPLES.map((id, index) => <a className="np-principle-entry" key={id} href={principleHref(id, lang)}><span className="np-principles-label">{String(index + 1).padStart(2, "0")}</span><h2>{principleNames[lang][id]}</h2><p>{d.topics[id]}</p><span className="np-principle-link">{d.read}</span></a>)}
      </nav>}
      <ProductSiteFooter lang={lang} next="ai" />
    </main>
  </div>;
}
