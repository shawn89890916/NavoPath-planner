import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { CloseButton } from "./components/UiPrimitives";
import { MOTION, prefersReducedMotion } from "./motion";
import { featureNames, principleNames, principleRoute, productFeature, sitePath } from "./productSite";
import { loadFeature, loadPrinciple } from "./sitePages";
import type { Language } from "./types";
import "./ui-primitives.css";

export default function LandingPortalPanel({ href, opener, lang, onClose }: {
  href: string; opener: HTMLAnchorElement; lang: Language; onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [path, setPath] = useState(() => sitePath(new URL(href).pathname));
  const feature = productFeature(path);
  const topic = principleRoute(path);
  const zh = lang === "zh";
  const title = feature ? featureNames[lang][feature] : topic && topic !== "index" ? principleNames[lang][topic] : zh ? "设计原理" : "Principles";
  const Page = useMemo(() => lazy(() => feature ? loadFeature(feature) : loadPrinciple(topic!)), [feature, topic]);
  const dismiss = useCallback((restoreFocus: boolean) => {
    onClose();
    if (restoreFocus) requestAnimationFrame(() => opener.focus({ preventScroll: true }));
  }, [onClose, opener]);
  const close = useCallback(() => dismiss(true), [dismiss]);

  useLayoutEffect(() => {
    const element = panel.current;
    const workspace = document.getElementById("workspace");
    if (!element || !workspace) return;
    const position = () => {
      const top = workspace.getBoundingClientRect().top + window.scrollY;
      element.style.setProperty("--portal-workspace-edge", `${top}px`);
    };
    position();
    const resize = new ResizeObserver(position);
    resize.observe(workspace);
    window.addEventListener("resize", position);
    if (!prefersReducedMotion()) {
      const from = opener.getBoundingClientRect(), to = element.getBoundingClientRect();
      const inset = [from.top - to.top, to.right - from.right, to.bottom - from.bottom, from.left - to.left].map(value => `${Math.max(0, value)}px`).join(" ");
      element.animate([{ clipPath: `inset(${inset} round 12px)`, opacity: .65 }, { clipPath: "inset(0 round 10px)", opacity: 1 }], {
        duration: MOTION.layout * 1.5,
        easing: "cubic-bezier(.22, 1, .36, 1)",
      });
    }
    return () => { resize.disconnect(); window.removeEventListener("resize", position); };
  }, [opener]);

  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }); }, [path]);
  useEffect(() => {
    const outside = (event: globalThis.MouseEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) dismiss(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) dismiss(true);
    };
    document.addEventListener("click", outside, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", outside, true);
      document.removeEventListener("keydown", escape);
    };
  }, [dismiss]);

  const followLink = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element && event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    const next = sitePath(url.pathname);
    if (!productFeature(next) && !principleRoute(next)) return;
    event.preventDefault();
    if (scroller.current) scroller.current.scrollTop = 0;
    setPath(next);
  };

  return <section className="beta-portal-panel" ref={panel} role="dialog" aria-labelledby="beta-portal-title" onClick={followLink}>
    <header className="beta-portal-bar">
      <h2 id="beta-portal-title" ref={heading} tabIndex={-1}>{title}</h2>
      <CloseButton label={zh ? "关闭预览" : "Close preview"} onClick={close} />
    </header>
    <div className="beta-portal-reader" ref={scroller}>
      <Suspense fallback={<p className="beta-portal-loading" role="status">{zh ? "正在加载…" : "Loading…"}</p>}>
        <Page embedded={{ lang, scroller, close }} />
      </Suspense>
    </div>
  </section>;
}
