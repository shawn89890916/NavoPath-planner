export default {
  onload(ctx: any) {
    const zh = ctx.language === "zh";
    const name = zh ? "日程模板" : "Schedule templates";
    const open = () => ctx.events.emit("schedule-templates:open");
    ctx.ui.addHeaderItem(name, (container: HTMLElement) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "navopath-plugin-header-button";
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 18h6"/></svg>';
      button.setAttribute("aria-label", zh ? "打开日程模板，可拖动调整插件顺序" : "Open schedule templates; drag to reorder plugins");
      button.title = zh ? "日程模板 · 拖动调整顺序" : "Schedule templates · drag to reorder";
      const off = ctx.on(button, "click", open);
      container.append(button);
      return () => { off(); button.remove(); };
    });
  },
};
