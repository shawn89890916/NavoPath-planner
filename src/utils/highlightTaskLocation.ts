export function highlightTaskLocation(node: HTMLElement) {
  for (const animation of node.getAnimations()) {
    if (animation.id === "task-location") animation.cancel();
  }
  const style = getComputedStyle(node);
  const accent = style.getPropertyValue("--accent-active").trim() || "currentColor";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const border = { borderColor: accent, boxShadow: `inset 0 0 0 2px ${accent}` };
  const animation = node.animate([
    { ...border, offset: 0 },
    { ...border, offset: reducedMotion ? 1 : 0.7 },
    ...(reducedMotion ? [] : [{ borderColor: style.borderColor, boxShadow: style.boxShadow, offset: 1 }]),
  ], { duration: 1800, easing: "ease-out" });
  animation.id = "task-location";
}
