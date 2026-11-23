import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ProductIcon, PRODUCT_ICON_SRC } from "./ProductIcon";
import { UiCalendarClockIcon, UiListChecksIcon, UiReturnIcon } from "./components/UiIcons";
import { SiteLanguageSwitch } from "./components/ProductMenu";
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
const narrowMedia = "(max-width: 680px)";
const chapters = [
  { id: "workspace", end: 194, open: .38, close: .83 },
  { id: "plugins", end: 434, open: .20, close: .80 },
  { id: "ai", end: 577, open: .29, close: .85 },
  { id: "principles", end: 680, open: .3, close: .82 },
] as const;
const scrollLength = chapters[chapters.length - 1].end;
type ChapterId = typeof chapters[number]["id"];
const clamp = (progress: number) => Math.max(0, Math.min(1, progress));

const copy = {
  zh: {
    hero: "今天要做的事，排得清清楚楚", start: "立刻开始",
    workspace: "一体化工作区", plugins: "插件市场", ai: "Navo AI 与 MCP", principles: "设计原理",
    mcp: "MCP 示例", mcpResult: "09:00–10:30 撰写个人介绍",
    examples: ["撰写个人介绍", "完成一节数据分析课程"],
    loading: "正在准备演示…", unavailable: "演示暂时未能加载。",
    ideas: ["一项任务，多种视图", "一项任务，多个时段", "预览、采纳、撤回"],
  },
  en: {
    hero: "See what to do today — and when to do it.", start: "Start now",
    workspace: "Workspace", plugins: "Plugin Market", ai: "Navo AI & MCP", principles: "Design Principles",
    mcp: "MCP example", mcpResult: "09:00–10:30 Write your introduction",
    examples: ["Write your introduction", "Complete a data analysis lesson"],
    loading: "Preparing the demo…", unavailable: "The demo could not load.",
    ideas: ["One task, many views", "One task, several time blocks", "Preview, apply, undo"],
  },
} as const;

const pluginCopy: Record<string, [string, string, string]> = {
  "class-timetable": ["课表", "导入每周课程", "Import your weekly classes"],
  "daily-overview": ["每日概览", "查看当天任务与日程", "See the day’s tasks and events"],
  kanban: ["看板", "按进度移动任务", "Move tasks between stages"],
  list: ["列表", "筛选和排序任务", "Filter and reorder tasks"],
  matrix: ["优先级矩阵", "按重要性和紧急度排序", "Prioritize by urgency and importance"],
  metrics: ["数据统计", "查看时间投入与完成情况", "See where your time goes"],
  pomodoro: ["番茄钟", "安排专注和休息", "Time focus sessions and breaks"],
  "quick-capture": ["快速收集", "把想法加入今天的候选", "Capture an idea as a task for today"],
  "schedule-templates": ["日程模板", "复用整天的安排", "Reuse a day’s schedule"],
  tree: ["项目树", "按层级整理项目与任务", "Organize projects as a hierarchy"],
  weather: ["天气", "查看气温和降水", "Check temperatures and rain"],
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
        if (!request.signal.aborted) setPlugins(catalog.packages.filter(entry => entry.manifest.kind === "plugin").map(entry => ({ ...entry, iconUrl: undefined, sourceId: OFFICIAL_SOURCE.id })));
      })
      .catch(() => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, []);

  if (failed) return <p role="status">{lang === "zh" ? "未能加载插件目录。" : "The plugin catalog could not load."}</p>;
  return <div className="story-orbit-field">
    <ul className="story-orbit" aria-label={lang === "zh" ? "社区插件" : "Community plugins"}>
      {plugins.map((entry, index) => {
        const text = pluginCopy[entry.manifest.id];
        return <li className="story-orbit-card" key={entry.manifest.id} style={{ "--orbit-home": `${360 * index / plugins.length}deg` } as CSSProperties}>
          <PluginMarketIdentity entry={entry} />
          <div>
            <strong>{lang === "zh" ? text?.[0] ?? entry.manifest.name : entry.manifest.name}</strong>
            <p>{text?.[lang === "zh" ? 1 : 2] ?? entry.manifest.description}</p>
          </div>
        </li>;
      })}
    </ul>
  </div>;
}

function LiveDemo({ feature, lang }: { feature: "execute" | "ai"; lang: Language }) {
  const c = copy[lang];
  return <div className="story-live">
    <p className="story-loading" role="status">{c.loading}</p>
    <p className="story-error" role="status">{c.unavailable}</p>
    <iframe
      data-story-demo={feature}
      title={feature === "execute" ? c.workspace : c.ai}
      src={`${base}product-demo/${feature}?lang=${lang}&layout=${matchMedia(narrowMedia).matches ? "narrow" : "wide"}`}
      allow="clipboard-read 'none'; clipboard-write 'none'"
      tabIndex={-1}
    />
  </div>;
}

function Chapter({ id, text, children }: { id: ChapterId; text: string; children: ReactNode }) {
  return <section className={`story-card story-${id}`} id={id} aria-labelledby={`${id}-title`}>
    <div className="story-card-surface">
      <h2 className="story-dock-label" id={`${id}-title`}>{text}</h2>
      <div className="story-content">{children}</div>
    </div>
  </section>;
}

export default function BetaStory({ lang: initialLang }: { lang: Language }) {
  const [lang, setLang] = useState(initialLang);
  const root = useRef<HTMLDivElement>(null);
  const c = copy[lang];

  function changeLanguage(next: Language) {
    const url = new URL(location.href);
    url.searchParams.set("lang", next);
    history.replaceState(history.state, "", url);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    document.title = next === "zh" ? "NavoPath · 一体式产品介绍" : "NavoPath · A product tour on one page";
    setLang(next);
  }

  useLayoutEffect(() => {
    const page = root.current!;
    const screen = page.querySelector<HTMLElement>(".story-screen")!;
    const cards = Array.from(screen.querySelectorAll<HTMLElement>(".story-card"));
    const docks = Array.from(screen.querySelectorAll<HTMLElement>(".story-dock"));
    const frames = cards.map(card => card.querySelector<HTMLIFrameElement>("iframe"));
    const ready = new WeakSet<HTMLIFrameElement>();
    const lastState = new WeakMap<HTMLIFrameElement, string>();
    const narrow = matchMedia(narrowMedia);
    const orbit = page.querySelector<HTMLElement>(".story-orbit");
    let frontCard: Element | undefined;
    let time = 0;
    let still = false;

    function sync() {
      chapters.forEach((chapter, index) => {
        const start = chapters[index - 1]?.end ?? 0;
        const place = (time - start) / (chapter.end - start);
        const active = still || (place > 0 && place < 1);
        const interactive = still || (active && place >= chapter.open && place <= chapter.close);
        const progress = still ? 1 : clamp((place - chapter.open) / (chapter.close - chapter.open));
        const card = cards[index];
        card.toggleAttribute("data-active", active);
        if (chapter.id === "plugins" && orbit) {
          const items = orbit.children;
          orbit.style.setProperty("--orbit-turn", `${360 * progress}deg`);
          const front = items[Math.round(progress * items.length) % items.length];
          if (front !== frontCard) {
            frontCard?.removeAttribute("data-front");
            front?.setAttribute("data-front", "");
            frontCard = front;
          }
        }
        if (chapter.id === "ai") card.toggleAttribute("data-mcp-result", progress >= .82);
        card.toggleAttribute("data-interactive", interactive);
        const frame = frames[index];
        if (!frame || !ready.has(frame)) return;
        const lock = interactive ? 0 : -1;
        if (frame.tabIndex !== lock) frame.tabIndex = lock;
        if (frame.inert === interactive) frame.inert = !interactive;
        const quantized = Math.round(progress * 1000) / 1000;
        const key = `${active},${interactive},${quantized},${still},${narrow.matches}`;
        if (lastState.get(frame) === key) return;
        lastState.set(frame, key);
        frame.contentWindow?.postMessage({ channel, type: "story-state", active, interactive, still, narrow: narrow.matches, progress: quantized }, location.origin);
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
    const orbitObserver = new MutationObserver(sync);
    if (orbit) orbitObserver.observe(orbit, { childList: true });
    narrow.addEventListener("change", sync);
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
        time = scrollLength;
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
      const refresh = () => {
        const progress = clamp(window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
        timeline.scrollTrigger?.refresh();
        timeline.progress(progress);
        time = timeline.time();
        sync();
      };
      refresh();
      let resizeFrame = 0;
      const resize = () => {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(refresh);
      };
      window.addEventListener("resize", resize, { passive: true });
      return () => {
        window.removeEventListener("resize", resize);
        window.cancelAnimationFrame(resizeFrame);
      };
    });
    return () => {
      window.removeEventListener("message", message);
      orbitObserver.disconnect();
      narrow.removeEventListener("change", sync);
      window.clearTimeout(loadTimeout);
      media.revert();
    };
  }, [lang]);

  return <div className="landing beta-story" ref={root}>
    <header className="story-brand">
      <img src={PRODUCT_ICON_SRC} alt="" width="24" height="24" />
      <span>NavoPath</span>
      <div className="story-header-actions">
        <SiteLanguageSwitch lang={lang} onChange={changeLanguage} />
        <a className="np-start-link" href="/app">{c.start}</a>
      </div>
    </header>
    <main className="story-tour">
      <div className="story-screen">
        <section className="story-cover landing-cover-content" aria-labelledby="story-hero-title">
          <div className="landing-cover-logo"><ProductIcon /></div>
          <div className="landing-brand-copy">
            <p className="landing-product-name">NavoPath</p>
            <h1 className="landing-slogan" id="story-hero-title">{c.hero}</h1>
          </div>
        </section>
        <div className="landing-portals story-docks" aria-hidden="true">
          {chapters.map(({ id }) => <span className={`landing-portal landing-portal--${id} story-dock`} key={id} />)}
        </div>
        <Chapter id="workspace" text={c.workspace}><LiveDemo key={lang} feature="execute" lang={lang} /></Chapter>
        <Chapter id="plugins" text={c.plugins}><StoryPlugins lang={lang} /></Chapter>
        <Chapter id="ai" text={c.ai}>
          <LiveDemo key={lang} feature="ai" lang={lang} />
          <div className="story-mcp" aria-label={c.mcp}>
            <span>{c.mcp}</span>
            <strong>Agent <span aria-hidden="true">→</span> MCP <span aria-hidden="true">→</span> NavoPath</strong>
            <span className="story-mcp-result">{c.mcpResult}</span>
          </div>
        </Chapter>
        <Chapter id="principles" text={c.principles}>
          <ol className="story-ideas">
            {c.ideas.map((title, index) => {
              const Icon = [UiListChecksIcon, UiCalendarClockIcon, UiReturnIcon][index];
              return <li key={title}><Icon size={24} /><span>{title}</span></li>;
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
      <div className="story-scroll-space" style={{ height: `${scrollLength}svh` }} aria-hidden="true" />
    </main>
  </div>;
}
