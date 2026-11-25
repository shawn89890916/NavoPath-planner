/**
 * Opt-in, theme-aware UI boundary for new plugin pages. Inherited custom
 * properties cross the shadow root; host and plugin selectors do not.
 * This is CSS isolation, not a security sandbox.
 */
export const PLUGIN_SURFACE_CSS = `
  :host { display: block; min-width: 0; max-width: 100%; }
  .nvp-plugin-surface {
    --p-bg: var(--surface-main, #f8f7f3);
    --p-text: var(--text-main, #27231e);
    --p-muted: var(--text-muted, #716a60);
    --p-border: var(--paper-rule-strong, #a8a096);
    --p-rule: var(--paper-rule, #d9d1c5);
    --p-accent: var(--accent-active, #584d3d);
    --p-on-accent: var(--accent-on, #fff);
    color: var(--p-text); font: 14px/1.55 var(--paper-sans, system-ui, sans-serif);
  }
  .nvp-plugin-surface, .nvp-plugin-surface * { box-sizing: border-box; min-width: 0; }
  [hidden] { display: none; }
  button, select, input { font: inherit; color: var(--p-text); }
  button, select, input[type=text], input[type=search] {
    min-height: 40px; padding: 8px 12px; border: 1px solid var(--p-border);
    border-radius: 7px; background: var(--p-bg);
  }
  button { cursor: pointer; font-weight: 600; }
  button:hover:not(:disabled) { border-color: var(--p-accent); }
  button:disabled, select:disabled { cursor: not-allowed; opacity: .65; }
  button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible {
    outline: 2px solid var(--p-accent); outline-offset: 2px;
  }
  button[data-variant=primary] { color: var(--p-on-accent); background: var(--p-accent); border-color: var(--p-accent); }
  input[type=checkbox] { flex: 0 0 auto; width: 18px; height: 18px; accent-color: var(--p-accent); }
`;
export function mountIsolatedPluginSurface(container: HTMLElement, css = "") {
  const host = document.createElement("div");
  host.dataset.nvpPluginSurface = "";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = PLUGIN_SURFACE_CSS + "\n" + css;
  const content = document.createElement("section");
  content.className = "nvp-plugin-surface";
  root.append(style, content);
  container.append(host);
  return { content, dispose: () => host.remove() };
}
