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

/** Inert snapshots keep logical hit rectangles unchanged. Only same-list
 * reorders are projected; cross-list drops retain their existing markers. */
export function createDragProjection(source: HTMLElement, copy: (source: HTMLElement, clone: HTMLElement) => void) {
  let frame = 0;
  let target: HTMLElement | undefined;
  let position: string | undefined;
  let dispose: (() => void)[] = [];
  const clear = () => { for (const fn of dispose) fn(); dispose = []; };
  const render = () => {
    frame = 0;
    clear();
    const preference = effectiveMotionPreference(window);
    if (!target || position !== "before" && position !== "after" || preference === "off") return;
    const from = row(source), to = row(target), parent = from.parentElement;
    if (!parent || to.parentElement !== parent || !from.isConnected || from === to) return;
    const siblings = Array.from(parent.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.matches(rowSelector));
    const sourceIndex = siblings.indexOf(from), targetIndex = siblings.indexOf(to);
    const rect = from.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(parent).rowGap) || 0;
    const offsets = projectedOffsets(siblings.length, sourceIndex, targetIndex, position, rect.height + gap);
    if (offsets.size > (preference === "rich" ? 24 : 12)) return;
    const clip = parent.closest("[data-shelf-scroll], .df-candidate-panel")?.getBoundingClientRect();
    const samples = [...offsets].map(([i, dy]) => ({ node: siblings[i], dy, rect: siblings[i].getBoundingClientRect() }));
    for (const { node, dy, rect: box } of samples) {
      if (!box.height || box.bottom <= 0 || box.top >= window.innerHeight || node.querySelectorAll("*").length > 180) continue;
      if (clip && (box.top + dy < clip.top || box.bottom + dy > clip.bottom)) continue;
      const clone = node.cloneNode(true) as HTMLElement;
      copy(node, clone);
      for (const el of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
        for (const attr of Array.from(el.attributes)) if (attr.name === "id" || attr.name.startsWith("data-") || attr.name === "name") el.removeAttribute(attr.name);
      }
      clone.inert = true;
      clone.setAttribute("aria-hidden", "true");
      Object.assign(clone.style, { position: "fixed", margin: "0", left: box.left + "px", top: box.top + "px", width: box.width + "px", height: box.height + "px", boxSizing: "border-box", pointerEvents: "none", zIndex: "120", transform: "none" });
      document.body.append(clone);
      const opacity = node.style.opacity;
      node.style.opacity = "0";
      const animation = clone.animate?.([{ translate: "0 0" }, { translate: "0 " + dy + "px" }], { duration: MOTION.base, easing: MOTION_EASE, fill: "forwards" });
      if (!animation) clone.style.translate = "0 " + dy + "px";
      dispose.push(() => { animation?.cancel(); clone.remove(); node.style.opacity = opacity; });
    }
  };
  const refresh = () => { if (!frame) frame = requestAnimationFrame(render); };
  const invalidate = () => { clear(); refresh(); };
  window.addEventListener("scroll", invalidate, true);
  window.addEventListener("resize", invalidate);
  return {
    update(next?: HTMLElement, side?: string) {
      if (target === next && position === side) return;
      target = next; position = side; refresh();
    },
    close() { cancelAnimationFrame(frame); clear(); window.removeEventListener("scroll", invalidate, true); window.removeEventListener("resize", invalidate); },
  };
}
