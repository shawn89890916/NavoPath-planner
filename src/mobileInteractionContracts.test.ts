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

  it("uses the settings home as the compact category switcher", () => {
    expect(main).not.toContain("df-settings-mobile-category");
    expect(main).toContain('className="df-settings-back-button"');
    expect(appCss).toContain("grid-template-rows: minmax(0, 1fr);");
    expect(appCss).toContain(".df-settings-shell.df-settings-detail-shell > .df-settings-rail {");
    expect(appCss).toContain("display: none;");
  });

  it("keeps desktop settings navigation beside the detail content", () => {
    expect(appCss).toMatch(/\.df-settings-detail-shell > \.df-settings-rail\s*\{[\s\S]*?grid-column:\s*1;/);
    expect(appCss).toMatch(/\.df-settings-detail-shell > \.df-settings-content\s*\{[\s\S]*?grid-column:\s*2;/);
  });

  it("opens settings details directly on landscape while retaining the compact home", () => {
    expect(main).toContain("compactLayout={compactLayout}");
    expect(main).toContain("useState(!initialSection && compactLayout)");
    expect(main).toContain("setSettingsHome(!initialSection && compactLayout)");
    expect(main).toContain('kind === "settings" && compactLayout && !settingsHome');
  });

  it("persists the AI sidebar preference when the panel closes and reopens", () => {
    expect(main).toContain('const AI_DOCKED_STORAGE_KEY = "navopath-ai-docked";');
    expect(main).toContain("const [aiDocked, setAiDocked] = useState(loadAiDockedPreference);");
    expect(main).toContain("localStorage.setItem(AI_DOCKED_STORAGE_KEY, String(aiDocked))");
    expect(main).not.toContain("cancelAi(); setAiDocked(false); setAiOpen(false);");
  });

  it("keeps 3-Day and Week on the Day view paper and hour-band rhythm", () => {
    expect(appCss).toContain(":is(.df-timeline-3day-top, .df-timeline-3day-allday, .df-timeline-3day-scroll)");
    expect(appCss).toMatch(/\.df-timeline-3day \.df-time-grid\s*\{[\s\S]*?background-color:\s*transparent;/);
    expect(appCss).toMatch(/:not\(\.theme-dark\).*?\.df-timeline-3day \.df-hour-lines-layer \.df-slot\.hour\s*\{[\s\S]*?border-top-color:\s*#E5E7EB;/);
    expect(appCss).toContain("/* Multi-day views share the Day view's paper and hour-band rhythm. */");
  });

  it("uses the compact workbench until landscape has room for the two-column layout", () => {
    expect(main).toContain("const COMPACT_LAYOUT_MEDIA_QUERY = \"(orientation: portrait), (max-width: 980px) and (orientation: landscape)\";");
    expect(appCss).not.toContain("grid-template-columns: clamp(330px, 40%, 390px)");
    expect(appCss).toContain("@media (min-width: 981px) and (orientation: landscape)");
    expect(appCss).toContain("#root .df-app.mode-execute > .df-execute {\n    grid-template-columns: minmax(0, 1fr);");
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

  it("centers the timeline on now once and keeps scheduling previews in place", () => {
    const previewStart = main.indexOf("function startPlacementPreview");
    const previewEnd = main.indexOf("function confirmPlacementPreview", previewStart);

    expect(main).toContain("timelineInitialFocusCompleteRef");
    expect(main.slice(previewStart, previewEnd)).not.toContain("setPendingTimelineFocus");
    expect(main).toContain("preserveTimelineViewportOnNextDataChange();\n    applyCandidateTimeSettings");
    expect(main).toContain("focusTimeline: false");
  });

  it("keeps candidate suggestions inside the dates visible in the current timeline view", () => {
    const choicesStart = main.indexOf("function findCandidatePlacementChoices");
    const choicesEnd = main.indexOf("function cancelPlacementPreview", choicesStart);
    const choicesSource = main.slice(choicesStart, choicesEnd);

    expect(choicesSource).toContain("const visibleRange");
    expect(choicesSource).toContain("return [];");
    expect(choicesSource).not.toContain("fallbackRange");
    expect(main).not.toContain("function findCandidatePlacement(task:");
    expect(main).toContain("if (wasPlacementArmedRef.current && !isPlacementArmed) setSchedulePanelOpen(false)");
    expect(main).toContain("const viewportFocus = currentTimelineViewportFocus();");
    expect(main).toContain("setVisibleTimelineDate(viewportFocus.date);");
    expect(main).toContain('if (nextView !== "month") setPendingTimelineFocus({ ...viewportFocus, source: "schedule" });');
  });

  it("uses the overdue scheduling action grid with a restrained reveal", () => {
    expect(main).toContain('df-candidate-schedule-panel is-overdue-actions');
    expect(main).toContain('term(lang, "incomplete")');
    expect(main).toContain('term(lang, "unschedule")');
    expect(main).toContain('lang === "zh" ? "显示到时间轴" : "Show in schedule"');
    expect(appCss).toContain("@keyframes dfCandidateScheduleReveal");
    expect(appCss).toMatch(/prefers-reduced-motion:[\s\S]*?\.df-candidate-schedule-panel[\s\S]*?animation:\s*none/);
    expect(appCss).toMatch(/\.df-candidate-schedule-more\s*\{[\s\S]*?width:\s*100%;[\s\S]*?justify-self:\s*stretch/);
    expect(main).not.toContain('<span className="df-project-group-count">{tasks.length}</span>');
  });

  it("keeps an overdue task's original unfinished time while previewing a suggestion", () => {
    expect(main).toContain("const overdueDisplayTime = returnedSchedule");
    expect(main).toContain("<span>{overdueDisplayTime}</span>");
    expect(main).not.toContain("isPlacementArmed && placementPreview ? `${formatCandidateDate(placementPreview.date, lang)}");
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

  it("keeps the task-prediction undo action readable after global button resets", () => {
    const globalButtonReset = appCss.lastIndexOf(".df-app button:not(.df-resize-dot):not(.df-level-option)");
    const toastActionRule = appCss.lastIndexOf("#root .df-app .df-toast .df-toast-undo-btn");

    expect(toastActionRule).toBeGreaterThan(globalButtonReset);
    expect(appCss.slice(toastActionRule)).toMatch(/color:\s*var\(--accent-active\)/);
    expect(main).toContain('lang === "zh" ? "撤销归属" : "Undo assignment"');
  });
});
