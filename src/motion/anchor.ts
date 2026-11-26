type Bounds = { left: number; right: number; top: number; bottom: number };

export function anchorPlacement(anchor: Bounds, bounds: Bounds, width: number, height: number, gap = 8, gutter = 12) {
  const below = Math.max(0, bounds.bottom - gutter - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - gap - bounds.top - gutter);
  const upward = height > below && above > below;
  const maxHeight = Math.min(height, upward ? above : below);
  const panelWidth = Math.min(width, Math.max(0, bounds.right - bounds.left - gutter * 2));
  return {
    upward, width: panelWidth, maxHeight,
    top: Math.max(bounds.top + gutter, Math.min(upward ? anchor.top - gap - maxHeight : anchor.bottom + gap, bounds.bottom - gutter - maxHeight)),
    left: Math.max(bounds.left + gutter, Math.min(anchor.left, bounds.right - panelWidth - gutter)),
  };
}

export function viewportBounds(): Bounds {
  const v = window.visualViewport;
  const left = v?.offsetLeft || 0, top = v?.offsetTop || 0;
  return { left, top, right: left + (v?.width || window.innerWidth), bottom: top + (v?.height || window.innerHeight) };
}

export function observeAnchor(nodes: (Element | null | undefined)[], update: () => void) {
  let frame = 0;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); };
  const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
  for (const node of nodes) if (node) observer?.observe(node);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  update();
  return () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    window.visualViewport?.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("scroll", schedule);
  };
}
