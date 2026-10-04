import { useEffect, useRef } from "react";
import type { Language } from "./types";
import type { FeatureCopy, ProductFeature } from "./productSite";

export type StoryLayout = { left: number; top: number; width: number; height: number; headerHeight: number };

// The native workspace owns the available column; the parent owns document scrolling.
export function ProductStorySlot({ feature }: { feature: ProductFeature }) {
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let previous = "";
    const update = () => {
      const { left, top, width, height } = element.getBoundingClientRect();
      const headerHeight = document.querySelector(".df-header")?.getBoundingClientRect().height || 0;
      const next = JSON.stringify({ left, top, width, height, headerHeight });
      if (next === previous) return;
      previous = next;
      if (parent !== window) parent.postMessage({ channel: "navopath-product-demo", type: "story-layout", layout: { left, top, width, height, headerHeight } }, location.origin);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element); addEventListener("resize", update); document.addEventListener("animationend", update, true); document.addEventListener("transitionend", update, true); update();
    return () => { observer.disconnect(); removeEventListener("resize", update); document.removeEventListener("animationend", update, true); document.removeEventListener("transitionend", update, true); };
  }, []);
  return <aside ref={host} className={`df-product-story df-product-story--${feature}`} aria-hidden="true" />;
}

export default function ProductStory({ lang, copy, layout }: { lang: Language; copy: FeatureCopy; layout: StoryLayout | null }) {
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    let pending = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      pending = 0;
      const element = host.current;
      if (!element) return;
      const focus = layout ? layout.top + layout.height / 2 : innerHeight / 2;
      for (const section of element.querySelectorAll<HTMLElement>("section")) {
        const rect = section.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - focus);
        // Keep a broad reading zone; ease the text out only near the viewport edges.
        const edge = Math.max(0, Math.min(1, (distance - innerHeight * .22) / (innerHeight * .30)));
        const fade = edge * edge * (3 - 2 * edge);
        const peakScale = Math.min(1.14, (element.clientWidth - 8) / rect.width);
        section.style.setProperty("--story-opacity", String(reduced.matches ? 1 : 1 - .86 * fade));
        section.style.setProperty("--story-scale", String(reduced.matches ? 1 : peakScale - (peakScale - .78) * fade));
      }
      if (layout) {
        const rect = element.getBoundingClientRect();
        element.style.clipPath = `inset(${Math.max(0, layout.headerHeight - rect.top)}px 0 ${Math.max(0, rect.bottom - innerHeight)}px 0)`;
      } else element.style.clipPath = "none";
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(update); };
    addEventListener("scroll", schedule, { passive: true }); addEventListener("resize", schedule); reduced.addEventListener("change", schedule); update();
    return () => { removeEventListener("scroll", schedule); removeEventListener("resize", schedule); reduced.removeEventListener("change", schedule); cancelAnimationFrame(pending); };
  }, [layout, copy]);
  return <aside ref={host} className={`np-scroll-story${layout ? " np-scroll-story--inline" : ""}`} aria-label={lang === "zh" ? "功能介绍" : "Feature introduction"}
    style={layout ? { width: layout.width, marginLeft: layout.left, paddingTop: `max(0px, calc(${layout.top + layout.height / 2}px - 19svh))`, paddingBottom: `max(0px, calc(100svh - ${layout.top + layout.height / 2}px - 19svh))` } : undefined}>
    {layout && <section><div><h1>{copy.title}</h1><p>{copy.description}</p></div></section>}
    {copy.benefits.map(([title, description]) => <section key={title}><div><h2>{title}</h2><p>{description}</p></div></section>)}
  </aside>;
}
