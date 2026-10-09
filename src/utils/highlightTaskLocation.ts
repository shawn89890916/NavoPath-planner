export function highlightTaskLocation(node: HTMLElement) {
  for (const animation of node.getAnimations()) {
    if (animation.id === "task-location") animation.cancel();
  }
  const accent = getComputedStyle(node).getPropertyValue("--accent-active").trim();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const outline = { outline: `2px solid ${accent || "currentColor"}`, outlineOffset: "2px" };
  const animation = node.animate([
    { ...outline, offset: 0 },
    { ...outline, offset: reducedMotion ? 1 : 0.7 },
    ...(reducedMotion ? [] : [{ outline: "2px solid transparent", outlineOffset: "2px", offset: 1 }]),
  ], { duration: 1800, easing: "ease-out" });
  animation.id = "task-location";
}
