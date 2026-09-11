import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const main = readFileSync(resolve(__dirname, "main.tsx"), "utf8");
const appCss = readFileSync(resolve(__dirname, "app.css"), "utf8");

describe("portrait interaction contracts", () => {
  it("opens the task short sheet on the second tap after selection", () => {
    expect(main).toContain("function selectTimelineTask(task: Task)");
    expect(main).toContain("if (resizeHintTaskId === taskId)");
    expect(main).toContain("openTaskEdit(task);");
    expect(main).toContain("onSelect={() => selectTimelineTask(task)}");
  });

  it("does not use returned-unfinished status as a resize lock", () => {
    expect(main).toContain("const canResize = !isExternalEvent && (isEvent || !hasRecurringRule(task));");
    expect(main).not.toContain("const canResize = !isExternalEvent && !isReturnedUnfinished");
  });

  it("uses the task-detail language for every new task with a start/end range", () => {
    expect(main).not.toContain("quickAddDetail");
    expect(main).toContain("if (!props.editing && props.type === \"task\")");
    expect(main).toContain('className="df-drawer df-task-detail df-quick-add-detail"');
    expect(main).toContain('className="df-detail-time-range"');
  });

  it("dismisses the AI plus menu outside and omits hardware sync", () => {
    expect(main).toContain('document.addEventListener("pointerdown", closeComposerMenu)');
    expect(main).not.toContain("同步硬件");
    expect(main).not.toContain("Sync hardware");
  });

  it("uses the portrait settings switch style in narrow landscape mode", () => {
    expect(appCss).toContain("(max-width: 899.98px) and (orientation: portrait),");
    expect(appCss).toContain("(max-width: 1180px) and (orientation: landscape)");
    expect(appCss).toContain("/* Touch settings use the same system switch in portrait and landscape. */");
  });

  it("uses the compact workbench before a narrow landscape timeline collapses", () => {
    expect(main).toContain("const COMPACT_LAYOUT_MEDIA_QUERY = \"(max-width: 899.98px) and (orientation: portrait), (max-width: 760px) and (orientation: landscape)\";");
    expect(appCss).toContain("@media (min-width: 761px) and (max-width: 980px) and (orientation: landscape)");
  });

  it("keeps the landscape candidate list as the native vertical touch scroller", () => {
    expect(appCss).toContain("#root .df-app .df-candidate-list {");
    expect(appCss).toContain("touch-action: pan-y;");
    expect(appCss).toContain("overscroll-behavior-y: contain;");
    expect(appCss).toContain("#root .df-app .df-candidate-list .df-candidate-task-row {");
  });

  it("keeps the candidate panel height bounded and scrolls the list at desktop widths", () => {
    expect(appCss).toMatch(/\.df-candidate-panel\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/);
    expect(appCss).toMatch(/\.df-app \.df-candidate-list\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/);
  });

  it("resolves the product mark from the Vite base path", () => {
    expect(main).toContain("const PRODUCT_ICON_SRC = `${import.meta.env.BASE_URL}navopath-icon.png`;");
    expect(main).toContain("const size = compact ? 32 : 36;");
    expect(main).toContain("<img src={PRODUCT_ICON_SRC} alt=\"\" width={size} height={size} />");
  });

  it("snaps the real task block into timeline slots instead of covering a white target preview", () => {
    expect(main).toContain("function SnappedTimelineDragBlock");
    expect(main).toContain("const timelineSnapActive = Boolean(draggedTask && hoverSlot && !drag?.outsideTimeline);");
    expect(main).toContain("drag.pointer && draggedTask && !timelineSnapActive");
    expect(main).toContain("dragOverlayTask && drag?.source !== \"candidate\" && !timelineSnapActive");
    expect(main).not.toContain("draggingBlock conflict=");
  });
});
