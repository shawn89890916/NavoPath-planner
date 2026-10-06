import { type CSSProperties, type MouseEvent, useEffect, useRef } from "react";
import { featureHref, featureNames, principleHref } from "./productSite";
import { MOTION, prefersReducedMotion } from "./motion";
import type { Language } from "./types";
import { preloadSitePage } from "./sitePages";

const entries = ["execute", "planning", "ai", "principles"] as const;

export default function LandingPortals({ lang, recede }: { lang: Language; recede: number }) {
  const opening = useRef<{ element: HTMLElement; animation: Animation } | null>(null);
  useEffect(() => {
    const clear = () => { opening.current?.animation.cancel(); opening.current?.element.remove(); opening.current = null; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") clear(); };
    addEventListener("pageshow", clear); addEventListener("keydown", escape);
    return () => { clear(); removeEventListener("pageshow", clear); removeEventListener("keydown", escape); };
  }, []);
  const enter = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || prefersReducedMotion() || !event.currentTarget.animate) return;
    event.preventDefault();
    if (opening.current) return;
    preloadSitePage(event.currentTarget.href);
    const source = event.currentTarget, parent = source.offsetParent as HTMLElement;
    const origin = parent.getBoundingClientRect(), surface = getComputedStyle(source), transform = surface.transform;
    const slide = (parseFloat(surface.translate) || 0) * (surface.translate.includes("%") ? source.offsetWidth / 100 : 1);
    const element = source.cloneNode(true) as HTMLAnchorElement;
    element.removeAttribute("href"); element.setAttribute("aria-hidden", "true"); element.classList.add("landing-portal--opening");
    Object.assign(element.style, { left: `${origin.left + source.offsetLeft + slide}px`, top: `${origin.top + source.offsetTop}px`, width: `${source.offsetWidth}px`, height: `${source.offsetHeight}px`, transform });
    source.closest(".landing")!.appendChild(element);
    const animation = element.animate([
      { transform, left: element.style.left, top: element.style.top, width: element.style.width, height: element.style.height, borderRadius: surface.borderRadius },
      { transform: "perspective(1100px) rotateY(0deg) rotateZ(0deg)", left: "0px", top: "0px", width: `${innerWidth}px`, height: `${innerHeight}px`, borderRadius: "0px" },
    ], { duration: MOTION.layout * 2, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "forwards" });
    const heading = element.querySelector<HTMLElement>(".landing-portal-heading")!;
    heading.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MOTION.layout, fill: "forwards" });
    opening.current = { element, animation };
    try { await animation.finished; location.assign(source.href); } catch { /* Escape or unmount cancels the transition. */ }
  };
  return <nav className="landing-portals" aria-label={lang === "zh" ? "探索 NavoPath" : "Explore NavoPath"} inert={recede >= .95} style={{ opacity: Math.max(0, 1 - recede ** 1.5), "--portal-exit-x": `${recede * 110}%` } as CSSProperties}>
    {entries.map(entry => <a key={entry} className={`landing-portal landing-portal--${entry}`} href={entry === "principles" ? principleHref("index", lang) : featureHref(entry, lang)} onPointerEnter={event => { if (event.pointerType === "mouse") preloadSitePage(event.currentTarget.href); }} onFocus={event => preloadSitePage(event.currentTarget.href)} onClick={enter}>
      <span className="landing-portal-heading"><strong>{entry === "principles" ? (lang === "zh" ? "相关原理" : "Principles") : featureNames[lang][entry]}</strong><span aria-hidden="true">↗</span></span>
      <img src={`/product-entry-${entry}-${lang}.jpg`} width={1280} height={800} alt="" decoding="async" draggable={false} />
    </a>)}
  </nav>;
}
