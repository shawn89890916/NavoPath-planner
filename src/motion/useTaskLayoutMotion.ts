import { useLayoutEffect, useRef } from "react";
import { effectiveMotionPreference } from "../motion";
import { collectTaskMotion, planTaskMotion, TaskMotionCoordinator, takeDragLanding } from "./layout";

type MotionOptions = {
  root: () => HTMLElement | null;
  selector: string;
  scope: string;
  revision: readonly unknown[];
  blocked?: boolean;
};

export function useTaskLayoutMotion(options: MotionOptions) {
  const previous = useRef<{ scope: string; revision: readonly unknown[]; points: ReturnType<typeof collectTaskMotion>; blocked: boolean } | null>(null);
  const coordinator = useRef<TaskMotionCoordinator | null>(null);
  if (!coordinator.current) coordinator.current = new TaskMotionCoordinator();

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const runtime = coordinator.current!;
    const cancel = () => runtime.cancel();
    const invalidate = () => { runtime.cancel(); previous.current = null; };
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    document.addEventListener("pointerdown", cancel, true);
    document.addEventListener("keydown", cancel, true);
    document.addEventListener("scroll", invalidate, true);
    window.addEventListener("resize", invalidate);
    media?.addEventListener?.("change", invalidate);
    return () => {
      document.removeEventListener("pointerdown", cancel, true);
      document.removeEventListener("keydown", cancel, true);
      document.removeEventListener("scroll", invalidate, true);
      window.removeEventListener("resize", invalidate);
      media?.removeEventListener?.("change", invalidate);
      runtime.cancel();
      previous.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const root = options.root();
    const old = previous.current;
    const blocked = Boolean(options.blocked || document.documentElement.dataset.motionScope || effectiveMotionPreference(window) === "off");
    if (!root) { previous.current = null; coordinator.current?.cancel(); return; }
    const unchanged = old && old.scope === options.scope && old.blocked === blocked &&
      old.revision.length === options.revision.length && old.revision.every((value, index) => Object.is(value, options.revision[index]));
    if (unchanged) return;
    coordinator.current?.cancel();
    const points = collectTaskMotion(root, options.selector);
    previous.current = { scope: options.scope, revision: options.revision, points, blocked };
    if (blocked || !old || old.scope !== options.scope) { coordinator.current?.cancel(); return; }
    const landed = takeDragLanding(points);
    if (landed) { coordinator.current?.play([landed]); return; }
    if (old.blocked) { coordinator.current?.cancel(); return; }
    const limit = effectiveMotionPreference(window) === "rich" ? 24 : 12;
    const changes = planTaskMotion(old.points, points, limit);
    if (changes.length) coordinator.current?.play(changes);
  });
}
