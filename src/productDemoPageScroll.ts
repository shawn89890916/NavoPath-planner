export function installProductDemoPageScroll() {
  if (parent === window) return;
  const channel = "navopath-product-demo";
  let timelineScroll = false;
  let swipe: { x: number; y: number; direction?: "vertical" | "horizontal" } | undefined;
  const nativePanel = '[role="dialog"], dialog[open], .df-candidate-panel.is-mobile-candidates';

  const send = (message: { type: "page-scroll"; deltaY: number } | { type: "exit-timeline-scroll" }) => {
    parent.postMessage({ channel, ...message }, location.origin);
  };
  window.addEventListener("message", event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.channel !== channel) return;
    if (event.data.type === "scroll-mode" && typeof event.data.timelineScroll === "boolean") {
      timelineScroll = event.data.timelineScroll;
      swipe = undefined;
    }
  });

  window.addEventListener("wheel", event => {
    if (timelineScroll || event.ctrlKey || event.metaKey || event.shiftKey || !event.cancelable) return;
    if (event.target instanceof Element && event.target.closest(nativePanel)) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
    event.preventDefault();
    event.stopPropagation();
    send({ type: "page-scroll", deltaY: event.deltaY * unit });
  }, { capture: true, passive: false });

  window.addEventListener("touchstart", event => {
    swipe = undefined;
    if (timelineScroll || event.touches.length !== 1) return;
    if (event.target instanceof Element && event.target.closest(`${nativePanel}, .df-task-card, .df-time-block, .df-all-day-block, input, select, textarea, [contenteditable]`)) return;
    const touch = event.touches[0];
    swipe = { x: touch.screenX, y: touch.screenY };
  }, { capture: true, passive: true });
  window.addEventListener("touchmove", event => {
    if (!swipe || event.touches.length !== 1 || !event.cancelable) return;
    if (document.querySelector(".df-app.is-dragging")) {
      swipe = undefined;
      return;
    }
    const touch = event.touches[0];
    const deltaY = swipe.y - touch.screenY;
    if (!swipe.direction) {
      const deltaX = swipe.x - touch.screenX;
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return;
      swipe.direction = Math.abs(deltaY) > Math.abs(deltaX) ? "vertical" : "horizontal";
    }
    if (swipe.direction !== "vertical") return;
    swipe.y = touch.screenY;
    event.preventDefault();
    send({ type: "page-scroll", deltaY });
  }, { capture: true, passive: false });
  const endSwipe = () => { swipe = undefined; };
  window.addEventListener("touchend", endSwipe, { capture: true, passive: true });
  window.addEventListener("touchcancel", endSwipe, { capture: true, passive: true });

  // Leave Escape to the workspace while it is closing a dialog or ending a drag.
  window.addEventListener("keydown", event => {
    if (!timelineScroll || event.key !== "Escape" || event.defaultPrevented || document.querySelector(`${nativePanel}, .df-app.is-dragging`)) return;
    send({ type: "exit-timeline-scroll" });
  });
}
