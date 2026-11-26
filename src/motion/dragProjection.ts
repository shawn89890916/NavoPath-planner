import { MOTION, MOTION_EASE, effectiveMotionPreference } from "../motion";

export function projectedOffsets(count: number, source: number, target: number, position: "before" | "after", extent: number) {
  const result = new Map<number, number>();
  if (source === target || source < 0 || target < 0 || target >= count || source >= count) return result;
  const end = target + (position === "after" ? 1 : 0);
  for (let i = 0; i < count; i++) {
    if (source < end && i > source && i < end) result.set(i, -extent);
    if (source > end && i >= end && i < source) result.set(i, extent);
  }
  return result;
}

const rowSelector = ".df-task-branch, .df-category-branch, .df-candidate-subtask-item, [data-planning-task-id], [data-candidate-task-id]";
const row = (node: HTMLElement) => node.closest<HTMLElement>(rowSelector) || node;

/** Read the original DOM geometry without its temporary visual projection.
 * Detach only our effects for this synchronous read; restore before paint. */
export function readLogicalLayout<T>(animations: Iterable<Animation>, read: () => T): T {
  const effects = [...animations].map(animation => ({ animation, effect: animation.effect, time: animation.currentTime }));
  try {
    for (const { animation } of effects) animation.effect = null;
    return read();
  } finally {
    for (const { animation, effect, time } of effects) {
      animation.effect = effect;
      if (time !== null) animation.currentTime = time;
    }
  }
}

/** Move the actual existing siblings, preserving their full DOM/CSS context.
 * Only translate is animated; no clone, opacity, dimensions, font or border changes. */
export function createDragProjection(source: HTMLElement) {
  let frame = 0;
  let target: HTMLElement | undefined;
  let position: string | undefined;
  const active = new Map<HTMLElement, Animation>();
  const clear = () => { for (const animation of active.values()) animation.cancel(); active.clear(); };
  const logical = <T,>(read: () => T): T => readLogicalLayout(active.values(), read);
  const render = () => {
    frame = 0;
    const preference = effectiveMotionPreference(window);
    const next = logical(() => {
      const result = new Map<HTMLElement, number>();
      if (!target || position !== "before" && position !== "after" || preference === "off") return result;
      const from = row(source), to = row(target), parent = from.parentElement;
      if (!parent || to.parentElement !== parent || !from.isConnected || from === to || !from.getClientRects().length) return result;
      const siblings = Array.from(parent.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.matches(rowSelector));
      const rect = from.getBoundingClientRect();
      if (!rect.height) return result;
      const gap = parseFloat(getComputedStyle(parent).rowGap) || 0;
      const offsets = projectedOffsets(siblings.length, siblings.indexOf(from), siblings.indexOf(to), position, rect.height + gap);
      if (offsets.size > (preference === "rich" ? 24 : 12)) return result;
      for (const [index, dy] of offsets) {
        const node = siblings[index];
        const box = node.getBoundingClientRect();
        if (box.height && box.bottom > 0 && box.top < window.innerHeight && getComputedStyle(node).translate === "none") result.set(node, dy);
      }
      return result;
    });
    if (preference === "off") { clear(); return; }
    const nodes = new Set([...active.keys(), ...next.keys()]);
    for (const node of nodes) {
      const prior = active.get(node);
      const current = prior ? getComputedStyle(node).translate : "0px 0px";
      prior?.cancel();
      active.delete(node);
      if (!node.isConnected || !node.animate) continue;
      const dy = next.get(node) || 0;
      const animation = node.animate([{ translate: current === "none" ? "0px 0px" : current }, { translate: "0px " + dy + "px" }], { duration: MOTION.base, easing: MOTION_EASE, fill: "forwards" });
      active.set(node, animation);
      if (!dy) void animation.finished.then(() => { if (active.get(node) === animation) { animation.cancel(); active.delete(node); } }, () => {});
      else void animation.finished.catch(() => {});
    }
  };
  const refresh = () => { if (!frame) frame = requestAnimationFrame(render); };
  const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  window.addEventListener("scroll", refresh, true);
  window.addEventListener("resize", refresh);
  media?.addEventListener?.("change", refresh);
  return {
    logical,
    update(next?: HTMLElement, side?: string) {
      if (target === next && position === side) return;
      target = next; position = side; refresh();
    },
    close() { cancelAnimationFrame(frame); clear(); window.removeEventListener("scroll", refresh, true); window.removeEventListener("resize", refresh); media?.removeEventListener?.("change", refresh); },
  };
}
