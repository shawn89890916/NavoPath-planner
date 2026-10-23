export const MOTION = {
  instant: 90,
  fade: 140,
  base: 180,
  layout: 240,
  story: 520,
} as const;

export type MotionDirection = "backward" | "forward" | "neutral";
export type MotionScope = "timeline" | "workspace" | "settings" | "planning";

type ViewTransitionLike = {
  finished: Promise<unknown>;
  ready?: Promise<unknown>;
  skipTransition?: () => void;
};

type MotionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike;
};

const activeTransitions = new WeakMap<Document, { skip?: () => void }>();

export function prefersReducedMotion(targetWindow: Window | null | undefined = typeof window === "undefined" ? undefined : window) {
  return Boolean(targetWindow?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function clearTransitionState(root: HTMLElement) {
  delete root.dataset.motionDirection;
  delete root.dataset.motionFallback;
  delete root.dataset.motionScope;
  root.style.removeProperty("--motion-shift-x");
}

export async function runMotionTransition(
  update: () => void,
  options: {
    direction?: MotionDirection;
    document?: Document | null;
    duration?: number;
    scope?: MotionScope;
    updates?: "latest" | "all";
  } = {},
) {
  const targetDocument = options.document === undefined
    ? (typeof document === "undefined" ? null : document)
    : options.document;
  const targetWindow = targetDocument?.defaultView;

  if (!targetDocument) {
    update();
    return;
  }

  activeTransitions.get(targetDocument)?.skip?.();
  const active: { skip?: () => void } = {};
  activeTransitions.set(targetDocument, active);
  const root = targetDocument.documentElement;
  const finish = () => {
    // A cancelled navigation must not clear a newer navigation's direction.
    if (activeTransitions.get(targetDocument) !== active) return;
    activeTransitions.delete(targetDocument);
    clearTransitionState(root);
  };
  if (prefersReducedMotion(targetWindow)) {
    finish();
    update();
    return;
  }

  const direction = options.direction ?? "neutral";
  delete root.dataset.motionFallback;
  root.dataset.motionDirection = direction;
  const scope = options.scope ?? "workspace";
  root.dataset.motionScope = scope;
  const distance = scope === "timeline" || scope === "workspace" && targetWindow?.matchMedia?.("(orientation: portrait)").matches
    ? "100%" : scope === "settings" || scope === "planning" ? "24px" : "6px";
  root.style.setProperty("--motion-shift-x", direction === "backward" ? `-${distance}` : direction === "forward" ? distance : "0px");

  const startViewTransition = (targetDocument as MotionDocument).startViewTransition;
  if (typeof startViewTransition === "function") {
    let committed = false;
    const commit = () => {
      if (committed || (options.updates !== "all" && activeTransitions.get(targetDocument) !== active)) return;
      committed = true;
      update();
    };
    try {
      const transition = startViewTransition.call(targetDocument, commit);
      // Skipping an overlapping transition rejects ready even if finished resolves.
      void transition.ready?.catch(() => undefined);
      active.skip = () => {
        // Relative commands must be applied before capturing their successor.
        if (options.updates === "all") commit();
        transition.skipTransition?.();
      };
      await transition.finished;
    } catch (error) {
      // Browser animation cancellation must not interrupt the requested navigation.
      if (!(error instanceof DOMException) || !["AbortError", "TimeoutError", "InvalidStateError"].includes(error.name)) throw error;
      commit();
    } finally {
      finish();
    }
    return;
  }

  root.dataset.motionFallback = "true";
  update();
  await new Promise<void>((resolve) => {
    const complete = () => {
      finish();
      resolve();
    };
    targetWindow?.setTimeout(complete, options.duration ?? MOTION.layout);
    if (!targetWindow) complete();
  });
}

export function scheduleMotionCommit(
  commit: () => void,
  duration: number = MOTION.fade,
  targetWindow: Window | null | undefined = typeof window === "undefined" ? undefined : window,
) {
  let committed = false;
  let timer: number | undefined;
  const finish = () => {
    if (committed) return;
    committed = true;
    if (timer !== undefined) targetWindow?.clearTimeout(timer);
    commit();
  };
  const cancel = () => {
    if (committed) return;
    committed = true;
    if (timer !== undefined) targetWindow?.clearTimeout(timer);
  };

  if (!targetWindow || prefersReducedMotion(targetWindow) || duration <= 0) finish();
  else timer = targetWindow.setTimeout(finish, duration);

  return { cancel, finish };
}
