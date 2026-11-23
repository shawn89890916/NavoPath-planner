type Point = { x: number; y: number };

const buttonPoint = (rect: DOMRect): Point => ({
  x: rect.left + rect.width * .5,
  y: rect.top + rect.height * .5,
});
const taskPoint = (rect: DOMRect): Point => ({
  x: rect.left + Math.min(70, rect.width * .32),
  y: rect.top + Math.min(17, rect.height * .45),
});

export function createProductStoryPointer() {
  const element = document.createElement("div");
  element.className = "product-story-pointer";
  element.setAttribute("aria-hidden", "true");
  element.hidden = true;
  element.innerHTML = '<span class="product-story-pulse"></span><svg viewBox="0 0 22 29"><path d="M2 1.6v21.2l5.3-4.5 3.7 8.4 4.7-2.1-3.8-8.1 7.5-.4Z"/></svg>';
  document.body.append(element);
  let marked: HTMLElement | null = null;
  const buttons = new Map<string, Point>();
  const clearTarget = () => {
    marked?.removeAttribute("data-story-press");
    marked = null;
  };

  return {
    hide() {
      if (!element.hidden) element.hidden = true;
      clearTarget();
    },
    reset() {
      buttons.clear();
    },
    paint(selector: string, progress: number, start: number, press: number, end: number, kind: "button" | "task", down: boolean) {
      const candidate = document.querySelector<HTMLElement>(selector);
      const rect = candidate?.getBoundingClientRect();
      const visible = !!rect?.width && !!rect.height && rect.top < innerHeight && rect.bottom > 0;
      const fresh = visible && rect ? (kind === "button" ? buttonPoint(rect) : taskPoint(rect)) : undefined;
      if (kind === "button" && fresh) buttons.set(selector, fresh);
      const point = fresh ?? (kind === "button" && progress >= press ? buttons.get(selector) : undefined);
      if (!point) {
        this.hide();
        return;
      }

      const approach = Math.max(0, Math.min(1, (progress - start) / (press - start)));
      const glide = (1 - approach) ** 2;
      const pulse = Math.max(0, Math.min(1, (progress - press) / .065));
      element.hidden = false;
      element.dataset.target = selector;
      element.style.setProperty("--pointer-x", `${point.x - 27 * glide}px`);
      element.style.setProperty("--pointer-y", `${point.y + 19 * glide}px`);
      element.style.setProperty("--pointer-press", down ? ".86" : "1");
      element.style.setProperty("--pulse-scale", String(.45 + pulse * 1.1));
      element.style.setProperty("--pulse-opacity", progress >= press && pulse < 1 ? String((1 - pulse) * .76) : "0");
      element.style.opacity = String(Math.max(0, Math.min(1, (progress - start) * 35, (end - progress) * 35)));

      const next = kind === "button" && visible && down ? candidate : null;
      if (next !== marked) {
        clearTarget();
        next?.setAttribute("data-story-press", "");
        marked = next;
      }
    },
  };
}
