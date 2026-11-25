/**
 * Opt-in isolated DOM surface for extension pages. CSS variables inherit from
 * the host, while host selectors and plugin-local rules cannot cross the root.
 * This is a styling boundary, not a security sandbox.
 */
export function mountIsolatedPluginSurface(container: HTMLElement, css: string) {
  const host = document.createElement("div");
  host.dataset.nvpPluginSurface = "";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const content = document.createElement("section");
  root.append(style, content);
  container.append(host);
  return { content, dispose: () => host.remove() };
}
