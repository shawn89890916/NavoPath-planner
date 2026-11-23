import { useEffect, useRef, useState, type ReactNode } from "react";
import { PRODUCT_ICON_SRC } from "./ProductIcon";
import { UiCalendarClockIcon, UiChevronDownIcon, UiListChecksIcon, UiReturnIcon } from "./components/UiIcons";
import { PluginMarketIdentity } from "./extensions/PluginMarketIdentity";
import { OFFICIAL_SOURCE } from "./extensions/packages";
import type { CatalogEntry } from "./extensions/types";
import type { Language } from "./types";
import "./beta-story.css";

const base = import.meta.env.BASE_URL;
const portraitMedia = "(max-width: 980px), (max-aspect-ratio: 4/5)";
const copy = {
  zh: {
    hero: "安排一天，只用一页。", lead: "挑任务、排时间、临时改，都在同一个工作区。", scroll: "向下滑动",
    workspace: ["一体化工作区", "从待办，直接排到时间轴。", "把左边的一项任务拖进右侧的空档，再就地调整。"],
    workspaceBefore: "NavoPath 工作区。左侧是今日候选，右侧是今天的时间轴。",
    workspaceAfter: "「调整网站布局」已从候选排入时间轴。",
    task: "调整网站布局",
    plugins: ["插件市场", "需要什么，就加什么。", "课表、番茄钟、看板和更多工具，按需加入工作区。"],
    ai: ["Navo AI 与 MCP", "把安排交给 AI，决定权留给你。", "用 Navo AI 辅助排程，也可以通过 MCP 让已授权的 Agent 读取任务和日程。"],
    aiBefore: "排程前，工作区显示今日候选和时间轴上的空档。",
    aiAfter: "排程后，候选任务已出现在右侧时间轴。",
    bridge: "按授权读取任务与日程",
    principles: ["设计原理", "任务和时间，各有自己的位置。"],
    ideas: [
      ["一项任务，多种视图", "列表、看板和项目树看到的是同一份任务。"],
      ["一项任务，多个时段", "一次做不完，可以安排到几个不同的时间段。"],
      ["先看安排，再做决定", "预览 AI 的建议，采纳后也能按实际情况调整或撤回。"],
    ],
  },
  en: {
    hero: "Plan your day on one page.", lead: "Pick tasks, block time, and adjust plans in the same workspace.", scroll: "Scroll to explore",
    workspace: ["Workspace", "From your list to your timeline.", "Drag a task from the left into an open slot on the right. Adjust it in place."],
    workspaceBefore: "The NavoPath workspace with today’s candidate tasks on the left and the timeline on the right.",
    workspaceAfter: "Refine the website layout moves from the candidate list into the timeline.",
    task: "Refine the website layout",
    plugins: ["Plugin Market", "Add what you need.", "Bring a timetable, a focus timer, a board, and more into your workspace."],
    ai: ["Navo AI & MCP", "Get help planning. Stay in control.", "Plan with Navo AI, or let an authorized agent read tasks and schedules through MCP."],
    aiBefore: "Before scheduling, the workspace shows candidate tasks and open slots.",
    aiAfter: "After scheduling, candidate tasks appear on the timeline.",
    bridge: "Authorized access to tasks and schedules",
    principles: ["Design Principles", "Tasks and time each have a place."],
    ideas: [
      ["One task, many views", "The list, board, and project tree all show the same tasks."],
      ["More than one time block", "Spread a task across several sessions when it takes longer than one sitting."],
      ["Review before you commit", "Preview AI suggestions, then adjust or undo changes after applying them."],
    ],
  },
} as const;

const pluginNames: Record<string, string> = {
  "class-timetable": "课表", "daily-overview": "每日概览", kanban: "看板", list: "列表", matrix: "优先级矩阵", metrics: "数据统计",
  pomodoro: "番茄钟", "quick-capture": "快速收集", "schedule-templates": "日程模板", tree: "项目树", weather: "天气",
};

function StoryPlugins({ lang }: { lang: Language }) {
  const [plugins, setPlugins] = useState<CatalogEntry[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    void fetch(`${base}extensions/catalog.json`, { signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json() as Promise<{ packages: Omit<CatalogEntry, "sourceId">[] }>;
      })
      .then(catalog => {
        if (!request.signal.aborted) setPlugins(catalog.packages.filter(entry => entry.manifest.kind === "plugin").map(entry => ({ ...entry, sourceId: OFFICIAL_SOURCE.id })));
      })
      .catch(() => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, []);
  if (failed) return <p role="status">{lang === "zh" ? "未能加载插件目录。" : "The plugin catalog could not load."}</p>;
  return <div className="story-plugin-catalog" aria-label={lang === "zh" ? "社区插件" : "Community plugins"}>
    {[0, 1].map(lane => <div className="story-strip" key={lane}>
      <ul className="story-track">
        {plugins.filter((_, index) => index % 2 === lane).map(entry => <li key={entry.manifest.id}>
          <PluginMarketIdentity entry={entry} />
          <span>{lang === "zh" ? pluginNames[entry.manifest.id] ?? entry.manifest.name : entry.manifest.name}</span>
        </li>)}
      </ul>
    </div>)}
  </div>;
}

function StoryPicture({ feature, lang, after, alt, className }: {
  feature: "workspace" | "ai"; lang: Language; after?: boolean; alt: string; className?: string;
}) {
  const name = `${base}story/${feature}-${lang}`, stage = after ? "after" : "before";
  return <picture className={className}>
    <source media={portraitMedia} srcSet={`${name}-portrait-${stage}.webp`} width="390" height="844" />
    <img src={`${name}-landscape-${stage}.webp`} width="1440" height="900" alt={alt} decoding="async" />
  </picture>;
}

function Chapter({ id, text, children }: { id: string; text: readonly [string, string, string?]; children: ReactNode }) {
  return <section className={`story-chapter story-${id}`} id={id} aria-labelledby={`${id}-title`}>
    <div className="story-stage">
      <header className="story-intro">
        <p>{text[0]}</p>
        <h2 id={`${id}-title`}>{text[1]}</h2>
        {text[2] && <div>{text[2]}</div>}
      </header>
      {children}
    </div>
  </section>;
}

export default function BetaStory({ lang }: { lang: Language }) {
  const root = useRef<HTMLDivElement>(null);
  const c = copy[lang];
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    const chapters = Array.from(page.querySelectorAll<HTMLElement>(".story-chapter"));
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    let frame = 0;
    const update = () => {
      frame = 0;
      const height = Math.max(1, innerHeight);
      const topBar = page.querySelector(".story-brand")?.getBoundingClientRect().height ?? 0;
      page.style.setProperty("--cover", String(clamp(window.scrollY / height)));
      page.style.setProperty("--read", String(clamp(window.scrollY / Math.max(1, document.documentElement.scrollHeight - height))));
      for (const chapter of chapters) {
        const bounds = chapter.getBoundingClientRect();
        const stageHeight = chapter.firstElementChild?.getBoundingClientRect().height ?? height;
        const progress = clamp((topBar - bounds.top) / Math.max(1, bounds.height - stageHeight));
        chapter.style.setProperty("--enter", String(clamp((height * .92 - bounds.top) / (height * .66))));
        chapter.style.setProperty("--progress", String(progress));
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(page);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, []);

  return <div className="beta-story" ref={root}>
    <header className="story-brand">
      <img src={PRODUCT_ICON_SRC} alt="" width="24" height="24" />
      <span>NavoPath</span>
      <span className="story-progress" aria-hidden="true" />
    </header>
    <main>
      <section className="story-hero" aria-labelledby="story-hero-title">
        <div className="story-orbit" aria-hidden="true">
          <span><StoryPicture feature="workspace" lang={lang} alt="" /></span>
          <span><img src={`${base}product-plugins-${lang}-landscape.webp`} alt="" width="1440" height="900" /></span>
          <span><StoryPicture feature="ai" lang={lang} alt="" after /></span>
          <span><img src={`${base}product-entry-principles-${lang}.jpg`} alt="" width="1280" height="800" /></span>
        </div>
        <div className="story-hero-copy">
          <img src={PRODUCT_ICON_SRC} alt="" width="180" height="180" />
          <h1 id="story-hero-title">{c.hero}</h1>
          <p>{c.lead}</p>
        </div>
        <span className="story-scroll-hint">{c.scroll}<UiChevronDownIcon size={17} /></span>
      </section>
      <Chapter id="workspace" text={c.workspace}>
        <figure className="story-visual">
          <StoryPicture feature="workspace" lang={lang} alt={c.workspaceBefore} />
          <StoryPicture feature="workspace" lang={lang} alt="" after className="story-result" />
          <span className="story-task" aria-hidden="true">{c.task}</span>
          <figcaption className="story-sr">{c.workspaceAfter}</figcaption>
        </figure>
      </Chapter>
      <Chapter id="plugins" text={c.plugins}><StoryPlugins lang={lang} /></Chapter>
      <Chapter id="ai" text={c.ai}>
        <figure className="story-visual">
          <StoryPicture feature="ai" lang={lang} alt={c.aiBefore} />
          <StoryPicture feature="ai" lang={lang} alt="" after className="story-result" />
          <figcaption className="story-sr">{c.aiAfter}</figcaption>
        </figure>
        <div className="story-mcp"><strong>Agent</strong><span aria-hidden="true">→</span><strong>MCP</strong><span aria-hidden="true">→</span><strong>NavoPath</strong><span>{c.bridge}</span></div>
      </Chapter>
      <Chapter id="principles" text={c.principles}>
        <ol className="story-ideas">
          {c.ideas.map(([title, body], index) => {
            const Icon = [UiListChecksIcon, UiCalendarClockIcon, UiReturnIcon][index];
            return <li key={title}><Icon size={25} /><div><h3>{title}</h3><p>{body}</p></div></li>;
          })}
        </ol>
      </Chapter>
    </main>
  </div>;
}
