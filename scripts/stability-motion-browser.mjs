import { TaskMotionCoordinator } from "../src/motion/layout.ts";
export async function exerciseMotion() {
  const assert = (value, message) => { if (!value) throw Error(message); };
  document.documentElement.dataset.motionPreference = "standard";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return { skipped: "system reduced motion" };
  const baseline = document.querySelectorAll("*").length;
  const controller = new TaskMotionCoordinator();
  const root = document.createElement("div"), parent = document.createElement("div"), child = document.createElement("div");
  root.append(parent); parent.append(child); document.body.append(root);
  const point = (node, key, y) => ({ node, key, entity: key, rect: { left: 0, top: y, width: 100, height: 30 } });
  const pair = (node, key, a, b) => ({ before: point(node,key,a), after: point(node,key,b) });
  const start = performance.now();
  try {
    for (let i=0; i<100; i++) {
      controller.play([pair(parent,"p",0,40),pair(child,"c",30,70)]);
      assert(parent.getAnimations().length === 1 && child.getAnimations().length === 0, "Nested translation compounded");
      controller.play([pair(parent,"p",0,40),pair(child,"c",30,80)]);
      assert(child.getAnimations().length === 1, "Independent child motion missing");
      controller.cancel();
      assert(!parent.getAnimations().length && !child.getAnimations().length, "Animation retained after cancellation");
    }
    document.documentElement.dataset.motionPreference = "off";
    controller.play([pair(parent,"p",0,40)]);
    assert(!parent.getAnimations().length, "Motion off ignored");
  } finally {
    controller.cancel(); root.remove(); delete document.documentElement.dataset.motionPreference;
  }
  assert(document.querySelectorAll("*").length === baseline, "Fixture nodes retained");
  return { cycles:100, elapsedMs: Math.round(performance.now()-start), retainedAnimations:0, retainedNodes:0 };
}
