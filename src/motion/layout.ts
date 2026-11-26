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
let landing: { entity: string; scope: string; rect: MotionRect; expires: number } | undefined;
export function rememberDragLanding(entity: string, scope: "candidate" | "schedule" | "planning") {
  const overlay = document.querySelector<HTMLElement>(".df-task-drag-layer, .df-unified-drag-overlay");
  if (!overlay) return;
  const { left, top, width, height } = overlay.getBoundingClientRect();
  if (width && height) landing = { entity, scope, rect: { left, top, width, height }, expires: performance.now() + 400 };
}
export function takeDragLanding(points: Point[]): TaskMotionChange<Point> | undefined {
  if (!landing || performance.now() > landing.expires) { landing = undefined; return; }
  const match = points.filter(p => p.entity === landing!.entity && (landing!.scope === "planning" ? /^(planning|task|subtask):/.test(p.key) : p.key.startsWith(landing!.scope + ":")));
  if (match.length !== 1) return;
  const after = match[0], before = { ...after, rect: landing.rect };
  landing = undefined;
  return { before, after };
}

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

/** Only move existing cards. Different sizes/representations settle in their
 * native layout immediately; no surrogate card, scaling, opacity or restyling. */
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
      const win = node.ownerDocument.defaultView;
      const preference = effectiveMotionPreference(win);
      if (!before || !win || preference === "off" || !node.isConnected || !node.animate) continue;
      const source = before.rect, target = after.rect;
      if (Math.abs(source.width - target.width) > 2 || Math.abs(source.height - target.height) > 2 || win.getComputedStyle(node).translate !== "none") continue;
      const dx = source.left - target.left, dy = source.top - target.top;
      if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) continue;
      const animation = node.animate([{ translate: dx + "px " + dy + "px" }, { translate: "0px 0px" }], { duration: preference === "rich" ? MOTION.complete : MOTION.layout, easing: MOTION_EASE });
      const cleanup = () => { animation.cancel(); this.active.delete(cleanup); };
      this.active.add(cleanup);
      void animation.finished.then(cleanup, cleanup);
    }
  }
}
