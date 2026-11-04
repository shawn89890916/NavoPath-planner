const { ipcRenderer } = require("electron");

let side = new URL(window.location.href).searchParams.get("side") === "right" ? "right" : "left";

function applySide() {
  if (document.documentElement) document.documentElement.dataset.side = side;
}

ipcRenderer.on("dock-handle:set-side", (_event, nextSide) => {
  side = nextSide === "right" ? "right" : "left";
  applySide();
});

window.addEventListener("DOMContentLoaded", applySide, { once: true });

window.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector("button");
  const zh = navigator.language.startsWith("zh");
  button.setAttribute("aria-label", zh ? "打开 NavoPath 贴边栏" : "Open NavoPath Dock");
  button.title = zh ? "NavoPath · 悬停或点击打开 · 上下拖动调整位置" : button.title;
  const send = (action) => { void ipcRenderer.invoke(`dock-handle:${action}`).catch(() => {}); };
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    button.setPointerCapture(event.pointerId);
    send("press");
  });
  button.addEventListener("pointerup", (event) => {
    if (!button.hasPointerCapture(event.pointerId)) return;
    send("release");
    button.releasePointerCapture(event.pointerId);
  });
  button.addEventListener("pointercancel", () => send("cancel"));
  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      send("open");
    }
  });
});
