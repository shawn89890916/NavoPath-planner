/** Ephemeral, scope-local pointer prediction. No DOM, timers, or persistent data. */
export type IntentPoint = { x: number; y: number; t: number };
export type IntentBounds = { left: number; right: number; top: number; bottom: number };

export function predictPointer(a: IntentPoint, b: IntentPoint, c: IntentPoint): IntentPoint | undefined {
  const dt1 = b.t - a.t, dt2 = c.t - b.t;
  if (dt1 <= 0 || dt2 <= 0 || dt1 > 150 || dt2 > 150) return;
  const ax = (b.x - a.x) / dt1, ay = (b.y - a.y) / dt1;
  const bx = (c.x - b.x) / dt2, by = (c.y - b.y) / dt2;
  const av = Math.hypot(ax, ay), bv = Math.hypot(bx, by);
  if (av < .12 || bv < .12 || bv < av * .45 || (ax * bx + ay * by) / (av * bv) < .8) return;
  const vx = .3 * ax + .7 * bx, vy = .3 * ay + .7 * by;
  const lead = Math.min(100, 120 / Math.hypot(vx, vy));
  return { x: c.x + vx * lead, y: c.y + vy * lead, t: c.t + lead };
}

/** Test the projected segment, not just its endpoint (fast pointers may overshoot). */
export function approachesBounds(from: IntentPoint, to: IntentPoint, bounds: IntentBounds): boolean {
  const { left, right, top, bottom } = bounds;
  if (right <= left || bottom <= top) return false;
  if (from.x >= left && from.x <= right && from.y >= top && from.y <= bottom) return false;
  let enter = 0, exit = 1;
  for (const [start, delta, min, max] of [[from.x, to.x - from.x, left, right], [from.y, to.y - from.y, top, bottom]]) {
    if (!delta) { if (start < min || start > max) return false; continue; }
    const a = (min - start) / delta, b = (max - start) / delta;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return exit >= 0 && enter <= 1;
}

/** Fixed two-sample history, at most one calculation per 16 ms. */
export function createIntentSampler() {
  let older: IntentPoint | undefined, latest: IntentPoint | undefined;
  return {
    reset() { older = latest = undefined; },
    sample(point: IntentPoint) {
      if (latest && point.t >= latest.t && point.t - latest.t < 16) return;
      if (latest && (point.t < latest.t || point.t - latest.t > 150)) older = latest = undefined;
      const prediction = older && latest ? predictPointer(older, latest, point) : undefined;
      older = latest; latest = point;
      return prediction;
    },
  };
}
