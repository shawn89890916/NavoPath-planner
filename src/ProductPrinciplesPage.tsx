import { useEffect, useState } from "react";
import ProductNavigation from "./ProductNavigation";
import ProductSiteFooter from "./ProductSiteFooter";
import { PRINCIPLES, principleNames, principleHref, siteLanguage, type Principle, type PrincipleCopy } from "./productSite";
import type { Language } from "./types";
import "./product-feature.css";
import "./product-principles.css";

const directory = {
  zh: {
    label: "相关原理", title: "让好用，有迹可循。", description: "几个小原理，串起从任务到执行的体验。选一个你感兴趣的话题，慢慢了解。",
    read: "了解原理", back: "所有原理", example: "处理流程 · 原理示意", sources: "继续了解", next: "接着读",
    topics: {
      jev: "任务先记下来，估时与项目建议随后补充。",
      feedback: "建议如何有分寸，手动修改为什么有优先级。",
      time: "从空闲时段到时间网格，一项任务如何找到位置。",
      control: "让 AI 的每一次改变，都能检查和调整。",
      views: "树、列表、看板与矩阵如何共用一份数据。",
      records: "把要做什么和什么时候做分开，计划更容易调整。",
    },
  },
  en: {
    label: "Principles", title: "Why it feels this way.", description: "A few small ideas connect capturing a task to getting it done. Pick a topic and explore at your own pace.",
    read: "Explore the principle", back: "All principles", example: "Process · Illustrative example", sources: "Read further", next: "Read next",
    topics: {
      jev: "Capture first. Duration and project suggestions follow.",
      feedback: "How suggestions stay measured and respect manual edits.",
      time: "How free slots and a shared time grid help a task find room.",
      control: "Make AI changes easy to inspect and adjust.",
      views: "How tree, list, Kanban and matrix share the same data.",
      records: "Separate the work from its arrangements so plans can change.",
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
