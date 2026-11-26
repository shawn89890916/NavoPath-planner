import { effectiveMotionPreference, MOTION, MOTION_EASE } from "../motion";

export type MotionRect = { left: number; top: number; width: number; height: number };
export type TaskMotionPoint = { key: string; entity: string; rect: MotionRect };
export type TaskMotionChange<T extends TaskMotionPoint> = { before?: T; after: T };

function uniqueBy<T>(items: readonly T[], key: (item: T) => string) {
  const values = new Map<string, T>();
  const duplicates = new Set<string>();
  for (const item of items) {
    const id = key(item);
    if (values.has(id)) duplicates.add(id);
    values.set(id, item);
  }
  for (const id of duplicates) values.delete(id);
  return values;
}

export function rectChanged(a: MotionRect, b: MotionRect) {
  return Math.abs(a.left - b.left) > 2 || Math.abs(a.top - b.top) > 2 ||
    Math.abs(a.width - b.width) > 2 || Math.abs(a.height - b.height) > 2;
}

/** Prefer exact presentation keys; pair different representations only if unambiguous. */
export function planTaskMotion<T extends TaskMotionPoint>(before: readonly T[], after: readonly T[], limit: number): TaskMotionChange<T>[] {
  const old = uniqueBy(before, x => x.key);
  const next = uniqueBy(after, x => x.key);
  const unmatchedOld = uniqueBy([...old.values()].filter(x => !next.has(x.key)), x => x.entity);
  const unmatchedNew = uniqueBy([...next.values()].filter(x => !old.has(x.key)), x => x.entity);
  const changes: TaskMotionChange<T>[] = [];
  for (const item of next.values()) {
    const exact = old.get(item.key);
    const shared = unmatchedNew.get(item.entity) === item ? unmatchedOld.get(item.entity) : undefined;
    const previous = exact ?? shared;
    if (!previous || rectChanged(previous.rect, item.rect)) changes.push({ before: previous, after: item });
  }
  return changes.length <= limit ? changes : [];
}

export const EXECUTION_MOTION_SELECTOR = ".df-candidate-task-row[data-candidate-task-id], .df-time-block[data-task-id]:not([data-preview='true']):not([data-kind='event'])";
export const PLANNING_MOTION_SELECTOR = "[data-planning-task-id]:not([data-kind='event']), [data-node-type='task'][data-node-id], [data-node-type='subtask'][data-node-id]";

type Point = TaskMotionPoint & { node: HTMLElement };

function identity(node: HTMLElement): { key: string; entity: string } | null {
  const d = node.dataset;
  if (d.candidateTaskId) return { entity: d.candidateTaskId, key: "candidate:" + d.candidateTaskId };
  if (d.taskId) return { entity: d.taskId, key: "schedule:" + (d.timelineEventId || d.taskId) };
  if (d.planningTaskId) return { entity: d.planningTaskId, key: "planning:" + d.planningTaskId };
  if (d.nodeId && d.nodeType) return { entity: d.nodeId, key: d.nodeType + ":" + d.nodeId };
  return null;
}

/** Read all geometry before starting any animation. Hidden/ambiguous instances are ignored. */
export function collectTaskMotion(root: HTMLElement, selector: string): Point[] {
  const win = root.ownerDocument.defaultView;
  if (!win || root.closest("[inert], [aria-hidden='true']") || !root.getClientRects().length) return [];
  const nodes = root.querySelectorAll<HTMLElement>(selector);
  if (nodes.length > 180) return [];
  const points: Point[] = [];
  for (const anchor of nodes) {
    if (anchor.closest("[inert], [aria-hidden='true'], [data-drag-state='source-placeholder']")) continue;
    const id = identity(anchor);
    const node = anchor.matches(".df-task-block") ? anchor : anchor.querySelector<HTMLElement>(".df-task-block") ?? anchor;
    if (!id || !node.getClientRects().length || node.dataset.dragState) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 || rect.left >= win.innerWidth || rect.top >= win.innerHeight) continue;
    if (win.getComputedStyle(node).visibility !== "visible") continue;
    points.push({ ...id, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, node });
  }
  return points;
}

/** All moving pixels live in inert visual copies. Real task geometry and hit targets stay fixed. */
export class TaskMotionCoordinator {
  private active = new Set<() => void>();

  cancel() {
    for (const cancel of [...this.active]) cancel();
    this.active.clear();
  }

  play(changes: TaskMotionChange<Point>[]) {
    this.cancel();
    for (const { before, after } of changes) {
      const node = after.node;
      const doc = node.ownerDocument;
      const win = doc.defaultView;
      const preference = effectiveMotionPreference(win);
      if (!win || preference === "off" || !node.isConnected || typeof node.animate !== "function") continue;
      const duration = preference === "rich" ? MOTION.complete : MOTION.layout;
      if (!before) {
        const animation = node.animate([{ opacity: .45 }, { opacity: 1 }], { duration: MOTION.base, easing: MOTION_EASE });
        const cleanup = () => { animation.cancel(); this.active.delete(cleanup); };
        this.active.add(cleanup);
        void animation.finished.then(cleanup, cleanup);
        continue;
      }
      const target = after.rect;
      const source = before.rect;
      // A lightweight text-only snapshot avoids duplicate DOM identity, event handlers,
      // focusable children, and layout selectors used by drag/resize code.
      const title = node.querySelector(".df-task-block-title, .df-task-title, .df-block-title, .df-shelf-task-title, .df-candidate-title")?.textContent?.trim();
      if (!title) {
        const animation = node.animate([{ opacity: .55 }, { opacity: 1 }], { duration: MOTION.base, easing: MOTION_EASE });
        const cleanup = () => { animation.cancel(); this.active.delete(cleanup); };
        this.active.add(cleanup);
        void animation.finished.then(cleanup, cleanup);
        continue;
      }
      const css = win.getComputedStyle(node);
      const ghost = doc.createElement("div");
      ghost.inert = true;
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = title;
      Object.assign(ghost.style, {
        position: "fixed", pointerEvents: "none", zIndex: "110", boxSizing: "border-box",
        left: target.left + "px", top: target.top + "px", width: target.width + "px", height: target.height + "px",
        border: css.border, borderRadius: css.borderRadius,
        backgroundColor: css.backgroundColor === "rgba(0, 0, 0, 0)" ? win.getComputedStyle(node.closest(".df-app") ?? node).backgroundColor : css.backgroundColor,
        color: css.color, font: css.font, padding: "4px 8px", overflow: "hidden",
        whiteSpace: "nowrap", textOverflow: "ellipsis", transformOrigin: "top left",
        display: "flex", alignItems: "center",
      });
      doc.body.append(ghost);
      const start = "translate(" + (source.left - target.left) + "px," + (source.top - target.top) + "px) scale(" + (source.width / target.width) + "," + (source.height / target.height) + ")";
      const animation = ghost.animate([
        { transform: start, opacity: 1 },
        { transform: "none", opacity: 1, offset: .8 },
        { transform: "none", opacity: 0 },
      ], { duration, easing: MOTION_EASE });
      const reveal = node.animate([{ opacity: 0 }, { opacity: 0, offset: .65 }, { opacity: 1 }], { duration, easing: MOTION_EASE });
      const cleanup = () => { animation.cancel(); reveal.cancel(); ghost.remove(); this.active.delete(cleanup); };
      this.active.add(cleanup);
      void reveal.finished.catch(() => undefined);
      void animation.finished.then(cleanup, cleanup);
    }
  }
}
