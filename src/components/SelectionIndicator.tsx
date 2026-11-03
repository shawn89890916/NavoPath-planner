import { useLayoutEffect, useRef } from "react";
import { MOTION, prefersReducedMotion } from "../motion";

const ACTIVE_ITEM_SELECTOR = ":scope > .ui-choice-item:is(.active, [aria-current=page], [aria-selected=true], [aria-pressed=true])";

/** One quiet highlight that follows the selected item in a single-choice list. */
export function SelectionIndicator({ activeKey }: { activeKey: string }) {
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const list = indicator?.parentElement;
    const activeItem = list?.querySelector<HTMLElement>(ACTIVE_ITEM_SELECTOR);
    if (!indicator || !list) return;
    if (!activeItem) {
      indicator.hidden = true;
      return;
    }
    indicator.hidden = false;

    const place = (animate: boolean) => {
      const currentIndicator = indicator.getBoundingClientRect();
      const target = activeItem.getBoundingClientRect();
      const left = activeItem.offsetLeft;
      const top = activeItem.offsetTop;
      const canAnimate = animate
        && !prefersReducedMotion()
        && currentIndicator.width > 0
        && currentIndicator.height > 0;

      indicator.getAnimations()[0]?.cancel();
      indicator.style.left = `${left}px`;
      indicator.style.top = `${top}px`;
      indicator.style.width = `${activeItem.offsetWidth}px`;
      indicator.style.height = `${activeItem.offsetHeight}px`;

      if (canAnimate) {
        const start = `matrix(${currentIndicator.width / activeItem.offsetWidth},0,0,${currentIndicator.height / activeItem.offsetHeight},${currentIndicator.left - target.left},${currentIndicator.top - target.top})`;
        indicator.animate?.([
          { transform: start },
          { transform: "none" },
        ], {
          duration: MOTION.layout,
          easing: "cubic-bezier(.2,.75,.25,1)",
        });
      }
    };

    place(true);

    const handleResize = () => place(false);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeKey]);

  return <span ref={indicatorRef} className="ui-choice-selection-indicator" aria-hidden="true" />;
}
