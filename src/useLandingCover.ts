import { useEffect, useState, type CSSProperties, type HTMLAttributes } from "react";
import { prefersReducedMotion } from "./motion";

export function useLandingCover() {
  const [coverRecede, setCoverRecede] = useState(0);
  const [portalExit, setPortalExit] = useState(0);
  const [entering, setEntering] = useState(() => !prefersReducedMotion() && window.scrollY < 1 && !location.hash);

  useEffect(() => {
    let frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const endEntrance = () => setEntering(false);
    const update = () => {
      frame = 0;
      const viewport = Math.max(window.innerHeight, 1);
      if (window.scrollY > 0) setEntering(false);
      const distance = Math.min(1, Math.max(0, (window.scrollY - viewport * .1) / (viewport * 1.4)));
      const progress = distance ** .34;
      setCoverRecede((current) => Math.abs(current - progress) < .01 ? current : progress);
      const exit = Math.min(1, Math.max(0, window.scrollY / (viewport * .58)));
      setPortalExit(current => Math.abs(current - exit) < .004 ? current : exit);
    };
    const requestUpdate = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    reduced.addEventListener("change", endEntrance);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reduced.removeEventListener("change", endEntrance);
    };
  }, []);

  const coverStyle = {
    "--landing-cover-scale": String(1 - coverRecede * .16),
    "--landing-cover-gray": String(coverRecede * .98),
    "--landing-cover-brightness": String(1 - coverRecede * .22),
    "--landing-cover-opacity": String(1 - coverRecede * .56),
  } as CSSProperties;

  const finishEntrance = () => setEntering(false);
  const events: HTMLAttributes<HTMLDivElement> = {
    onPointerDownCapture: finishEntrance,
    onKeyDownCapture: finishEntrance,
    onFocusCapture: finishEntrance,
    onAnimationEnd: event => {
      if (event.animationName === "landing-preview-arrive") finishEntrance();
    },
  };
  return { coverStyle, portalExit, entrance: { entering, events } };
}
