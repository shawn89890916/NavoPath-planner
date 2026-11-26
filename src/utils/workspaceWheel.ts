/**
 * Workspace panels intentionally retain their outside-click backdrop. Route
 * only vertical wheel gestures on exposed background pixels to the underlying
 * execution region, without closing a panel or leaking clicks through it.
 */
const PANEL = ".df-execute > :is(.df-candidate-panel, .df-timeline-panel)";
const BACKDROP = "[data-workspace-backdrop], .df-utility-backdrop, .df-drawer-backdrop";
const FOREGROUND = "[data-workspace-panel], .df-utility-panel, .df-ai-panel, .df-drawer, .df-command-palette, .df-proactive-center";
const INTERACTIVE = "input, textarea, select, [contenteditable=true]";

function visiblePanel(element: Element): HTMLElement | null {
  const panel = element.closest<HTMLElement>(PANEL);
  if (!panel || panel.closest('[inert], [aria-hidden="true"]') || !panel.getClientRects().length) return null;
  return panel;
}

function nearestScroller(element: Element, panel: HTMLElement, view: Window | null): HTMLElement | null {
  for (let node: Element | null = element; node && panel.contains(node); node = node.parentElement) {
    const html = node as HTMLElement;
    if (html.clientHeight > 0 && html.scrollHeight > html.clientHeight &&
        /^(auto|scroll|overlay)$/.test(view?.getComputedStyle(node).overflowY || "")) return html;
  }
  return null;
}

function defaultScroller(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector<HTMLElement>(panel.matches(".df-candidate-panel")
    ? ".df-candidate-list" : ".df-timeline-scroll, .df-month-scroll");
}

export function wheelPixels(delta: number, mode: number, pageHeight: number): number {
  return delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
}

export function routeWorkspaceWheel(event: WheelEvent, doc: Document): void {
  if (!event.cancelable || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey ||
      !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const target = event.target as Element | null;
  if (!target?.closest || !target.closest(".df-app.mode-execute") || target.closest(FOREGROUND)) return;
  let scroller: HTMLElement | null = null;

  if (target.closest(BACKDROP)) {
    // Hit-test the real stacking order beneath the backdrop, including nested
    // task/plugin scrollers. Never scroll through the foreground panel itself.
    for (const element of doc.elementsFromPoint(event.clientX, event.clientY)) {
      const panel = visiblePanel(element);
      if (!panel) continue;
      scroller = nearestScroller(element, panel, doc.defaultView) || defaultScroller(panel);
      break;
    }
  } else {
    // The Tasks header and padding belong to the list too. Leave native wheel
    // delivery inside scrolling descendants intact; timeline already handles
    // its own header/empty-area gestures.
    const panel = visiblePanel(target);
    if (!panel?.matches(".df-candidate-panel") || target.closest(INTERACTIVE) ||
        nearestScroller(target, panel, doc.defaultView)) return;
    scroller = defaultScroller(panel);
  }

  if (!scroller || scroller.clientHeight <= 0 || scroller.scrollHeight <= scroller.clientHeight) return;
  event.preventDefault();
  const max = scroller.scrollHeight - scroller.clientHeight;
  scroller.scrollTop = Math.max(0, Math.min(max, scroller.scrollTop +
    wheelPixels(event.deltaY, event.deltaMode, scroller.clientHeight)));
}

export function installWorkspaceWheelRouting(doc: Document): () => void {
  const onWheel = (event: WheelEvent) => routeWorkspaceWheel(event, doc);
  doc.addEventListener("wheel", onWheel, { capture: true, passive: false });
  return () => doc.removeEventListener("wheel", onWheel, true);
}
