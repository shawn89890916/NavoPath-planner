import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ProductIcon, PRODUCT_ICON_SRC } from "./ProductIcon";
import { UiCalendarClockIcon, UiChevronDownIcon, UiListChecksIcon, UiReturnIcon } from "./components/UiIcons";
import { TaskBlock } from "./components/TaskBlock";
import { PluginMarketIdentity } from "./extensions/PluginMarketIdentity";
import { OFFICIAL_SOURCE } from "./extensions/packages";
import type { CatalogEntry } from "./extensions/types";
import type { Language } from "./types";
import "./landing.css";
import "./beta-story.css";

gsap.registerPlugin(ScrollTrigger);

const base = import.meta.env.BASE_URL;
const channel = "navopath-product-demo";
const chapters = [
  { id: "workspace", end: .34, open: .38, close: .83 },
  { id: "plugins", end: .57, open: .33, close: .82 },
  { id: "ai", end: .82, open: .29, close: .85 },
  { id: "principles", end: 1, open: .3, close: .82 },
] as const;
type ChapterId = typeof chapters[number]["id"];
const clamp = (progress: number) => Math.max(0, Math.min(1, progress));

const copy = {
  zh: {
    hero: "挑任务、排时间、临时改，都在同一页", lead: "左边是待安排的任务，右边是今天的时间轴。", scroll: "向下滑动",
    workspace: ["一体化工作区", "从待办，直接排到时间轴。"],
    plugins: ["插件市场", "需要什么，就加什么。"],
    ai: ["Navo AI 与 MCP", "先看排程建议，再决定怎么安排。"],
    principles: ["设计原理", "任务与时间，各有自己的位置。"],
    mcp: "MCP 示例 · 经授权读取任务与日程",
    mcpResult: "09:00–10:30 撰写个人介绍",
    examples: ["撰写个人介绍", "完成一节数据分析课程"],
    loading: "正在准备演示…", unavailable: "演示暂时未能加载。",
    ideas: [
      ["一项任务，多种视图", "列表、看板和项目树里的修改会同步到同一项任务。"],
      ["一项任务，多个时段", "做不完的任务，可以分到今天的几个空档。"],
      ["预览、采纳、撤回", "先看每项建议占用的时间，采纳后也能调整或撤回。"],
    ],
  },
  en: {
    hero: "Pick tasks, block time, and shift plans—all on one page.", lead: "Tasks on the left, today’s timeline on the right.", scroll: "Scroll to explore",
    workspace: ["Workspace", "From your list to your timeline."],
    plugins: ["Plugin Market", "Add what you need."],
    ai: ["Navo AI & MCP", "Review a suggested schedule before you apply it."],
    principles: ["Design Principles", "Tasks and time each have a place."],
    mcp: "MCP example · Read tasks and schedules with permission",
    mcpResult: "09:00–10:30 Write your introduction",
    examples: ["Write your introduction", "Complete a data analysis lesson"],
    loading: "Preparing the demo…", unavailable: "The demo could not load.",
    ideas: [
      ["One task, many views", "Edits follow the same task across the list, board, and project tree."],
      ["One task, several time blocks", "Spread longer tasks across the openings in your day."],
      ["Preview, apply, undo", "See the time each suggestion needs. Adjust or undo changes after applying them."],
    ],
  },
} as const;

const pluginNames: Record<string, string> = {
  "activity-history": "活动记录", "class-timetable": "课表", "daily-overview": "每日概览", kanban: "看板",
  list: "列表", matrix: "优先级矩阵", metrics: "数据统计", pomodoro: "番茄钟", "quick-capture": "快速收集",
  "schedule-templates": "日程模板", tree: "项目树", weather: "天气",
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
      .then(catalog => setPlugins(catalog.packages.filter(entry => entry.manifest.kind === "plugin").map(entry => ({ ...entry, iconUrl: undefined, sourceId: OFFICIAL_SOURCE.id }))))
      .catch(() => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, []);
  if (failed) return <p role="status">{lang === "zh" ? "未能加载插件目录。" : "The plugin catalog could not load."}</p>;
  return <div className="story-plugin-catalog" aria-label={lang === "zh" ? "社区插件" : "Community plugins"}>
    {[0, 1].map(lane => {
      const entries = plugins.filter((_, index) => index % 2 === lane);
      return <div className="story-strip" key={lane}>
        <div className="story-track">
          {[false, true].map(duplicate => <ul key={String(duplicate)} aria-hidden={duplicate || undefined} className={duplicate ? "story-track-copy" : undefined}>
            {entries.map(entry => <li key={entry.manifest.id}>
              <PluginMarketIdentity entry={entry} />
              <span>{lang === "zh" ? pluginNames[entry.manifest.id] ?? entry.manifest.name : entry.manifest.name}</span>
            </li>)}
          </ul>)}
        </div>
      </div>;
    })}
  </div>;
}

function LiveDemo({ feature, lang }: { feature: "execute" | "ai"; lang: Language }) {
  const c = copy[lang];
  return <div className="story-live">
    <p className="story-loading" role="status">{c.loading}</p>
    <p className="story-error" role="status">{c.unavailable}</p>
    <iframe
      data-story-demo={feature}
      title={feature === "execute" ? c.workspace[0] : c.ai[0]}
      src={`${base}product-demo/${feature}?lang=${lang}`}
      allow="clipboard-read 'none'; clipboard-write 'none'"
      tabIndex={-1}
    />
  </div>;
}

function Chapter({ id, text, children }: { id: ChapterId; text: readonly [string, string]; children: ReactNode }) {
  return <section className={`story-card story-${id}`} id={id} aria-labelledby={`${id}-title`}>
    <div className="story-card-surface">
      <header className="story-mast">
        <h2 id={`${id}-title`}>{text[0]}</h2>
        <p>{text[1]}</p>
      </header>
      <div className="story-content">{children}</div>
    </div>
  </section>;
}

export default function BetaStory({ lang }: { lang: Language }) {
  const root = useRef<HTMLDivElement>(null);
  const c = copy[lang];

  useLayoutEffect(() => {
    const page = root.current!;
    const screen = page.querySelector<HTMLElement>(".story-screen")!;
    const cards = Array.from(screen.querySelectorAll<HTMLElement>(".story-card"));
    const docks = Array.from(screen.querySelectorAll<HTMLElement>(".story-dock"));
    const frames = cards.map(card => card.querySelector<HTMLIFrameElement>("iframe"));
    const ready = new WeakSet<HTMLIFrameElement>();
    const lastState = new WeakMap<HTMLIFrameElement, string>();
    let time = 0;
    let still = false;

    function sync() {
      page.style.setProperty("--read", String(time));
      chapters.forEach((chapter, index) => {
        const start = chapters[index - 1]?.end ?? 0;
        const place = (time - start) / (chapter.end - start);
        const active = still || (place > 0 && place < 1);
        const interactive = still || (active && place >= chapter.open && place <= chapter.close);
        const progress = still ? 1 : clamp((place - chapter.open) / (chapter.close - chapter.open));
        const card = cards[index];
        card.toggleAttribute("data-active", active);
        if (chapter.id === "ai") card.toggleAttribute("data-mcp-result", progress >= .82);
        card.toggleAttribute("data-interactive", interactive);
        const frame = frames[index];
        if (!frame || !ready.has(frame)) return;
        const lock = interactive ? 0 : -1;
        if (frame.tabIndex !== lock) frame.tabIndex = lock;
        if (frame.inert === interactive) frame.inert = !interactive;
        const quantized = Math.round(progress * 1000) / 1000;
        const key = `${active},${interactive},${quantized},${still}`;
        if (lastState.get(frame) === key) return;
        lastState.set(frame, key);
        frame.contentWindow?.postMessage({ channel, type: "story-state", active, interactive, still, progress: quantized }, location.origin);
      });
    }

    function message(event: MessageEvent) {
      if (event.origin !== location.origin || event.data?.channel !== channel) return;
      const frame = frames.find(item => item && item.contentWindow === event.source);
      if (!frame) return;
      const container = frame.parentElement!;
      if (event.data.type === "ready") {
        ready.add(frame);
        lastState.delete(frame);
        container.dataset.status = "ready";
        sync();
      } else if (event.data.type === "error") {
        ready.delete(frame);
        container.dataset.status = "error";
      } else if (event.data.type === "page-scroll" && Number.isFinite(event.data.deltaY) && ready.has(frame)
        && frame.closest("[data-interactive]")) {
        window.scrollBy(0, gsap.utils.clamp(-10000, 10000, event.data.deltaY));
      }
    }

    function layout() {
      const origin = screen.getBoundingClientRect();
      docks.forEach((dock, index) => {
        const slot = dock.getBoundingClientRect();
        const card = cards[index];
        const angle = getComputedStyle(dock);
        card.style.setProperty("--portal-turn", angle.getPropertyValue("--portal-turn"));
        card.style.setProperty("--portal-tilt", angle.getPropertyValue("--portal-tilt"));
        const scale = Math.max(slot.width / card.offsetWidth, slot.height / card.offsetHeight);
        card.style.setProperty("--dock-x", `${slot.left - origin.left - card.offsetLeft}px`);
        card.style.setProperty("--dock-y", `${slot.top - origin.top - card.offsetTop}px`);
        card.style.setProperty("--dock-scale", String(scale));
        card.style.setProperty("--dock-heading-pad", `${Math.max(0, -slot.left + 29) / (scale * .82)}px`);
        card.style.setProperty("--dock-crop-x", `${Math.max(0, card.offsetWidth - slot.width / scale)}px`);
        card.style.setProperty("--dock-crop-y", `${Math.max(0, card.offsetHeight - slot.height / scale)}px`);
      });
    }

    window.addEventListener("message", message);
    const loadTimeout = window.setTimeout(() => {
      frames.forEach(frame => {
        if (frame && !ready.has(frame)) frame.parentElement!.dataset.status = "error";
      });
    }, 15000);
    const media = gsap.matchMedia();
    media.add({ motion: "(prefers-reduced-motion: no-preference) and (min-height: 420px)", always: "all" }, context => {
      still = !context.conditions?.motion;
      page.dataset.static = String(still);
      if (still) {
        time = 1;
        sync();
        return;
      }
      layout();
      const timeline = gsap.timeline({
        onUpdate: () => { time = timeline.time(); sync(); },
        scrollTrigger: {
          trigger: page, start: 0, end: "max", scrub: true,
          onRefresh: layout,
        },
      });
      chapters.forEach((chapter, index) => {
        const start = chapters[index - 1]?.end ?? 0;
        const length = chapter.end - start;
        timeline.fromTo(cards[index], { "--lift": 0 }, {
          "--lift": 1, duration: length * chapter.open, ease: "power2.inOut", immediateRender: false,
        }, start);
        timeline.to(cards[index], {
          "--lift": 0, duration: length * (1 - chapter.close), ease: "power2.inOut",
        }, start + length * chapter.close);
      });
      time = timeline.time();
      sync();
      let resizeFrame = 0;
      const resize = () => {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => timeline.scrollTrigger?.refresh());
      };
      window.addEventListener("resize", resize, { passive: true });
      return () => {
        window.removeEventListener("resize", resize);
        window.cancelAnimationFrame(resizeFrame);
      };
    });
    return () => {
      window.removeEventListener("message", message);
      window.clearTimeout(loadTimeout);
      media.revert();
    };
  }, []);

  return <div className="landing beta-story" ref={root}>
    <header className="story-brand">
      <img src={PRODUCT_ICON_SRC} alt="" width="24" height="24" />
      <span>NavoPath</span>
      <span className="story-progress" aria-hidden="true" />
    </header>
    <main className="story-tour">
      <div className="story-screen">
        <section className="story-cover landing-cover-content" aria-labelledby="story-hero-title">
          <div className="landing-cover-logo"><ProductIcon /></div>
          <div className="landing-brand-copy">
            <p className="landing-product-name">NavoPath</p>
            <h1 className="landing-slogan" id="story-hero-title">{c.hero}</h1>
            <p className="story-lead">{c.lead}</p>
            <span className="story-scroll-hint">{c.scroll}<UiChevronDownIcon size={17} /></span>
          </div>
        </section>
        <div className="landing-portals story-docks" aria-hidden="true">
          {chapters.map(({ id }) => <span className={`landing-portal landing-portal--${id} story-dock`} key={id} />)}
        </div>
        <Chapter id="workspace" text={c.workspace}><LiveDemo feature="execute" lang={lang} /></Chapter>
        <Chapter id="plugins" text={c.plugins}><StoryPlugins lang={lang} /></Chapter>
        <Chapter id="ai" text={c.ai}>
          <LiveDemo feature="ai" lang={lang} />
          <div className="story-mcp" aria-label={c.mcp}>
            <span>{c.mcp}</span>
            <strong>Agent <span aria-hidden="true">→</span> MCP <span aria-hidden="true">→</span> NavoPath</strong>
            <span className="story-mcp-result">{c.mcpResult}</span>
          </div>
        </Chapter>
        <Chapter id="principles" text={c.principles}>
          <ol className="story-ideas">
            {c.ideas.map(([title, body], index) => {
              const Icon = [UiListChecksIcon, UiCalendarClockIcon, UiReturnIcon][index];
              return <li key={title}><Icon size={27} /><div><h3>{title}</h3><p>{body}</p></div></li>;
            })}
          </ol>
          <div className="story-day" aria-hidden="true">
            <div><span>09:00</span><span>10:00</span><span>11:00</span><span>12:00</span></div>
            <TaskBlock variant="scheduled" className="story-day-block" projectColor="#7ea172">{c.examples[0]}</TaskBlock>
            <TaskBlock variant="scheduled" className="story-day-block" projectColor="#584d3d">{c.examples[1]}</TaskBlock>
            <TaskBlock variant="scheduled" className="story-day-block" projectColor="#7ea172">{c.examples[0]}</TaskBlock>
          </div>
        </Chapter>
      </div>
      <div className="story-scroll-space" aria-hidden="true" />
    </main>
  </div>;
}
