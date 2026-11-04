import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TimeBlock } from "../WorkspacePresentation";
import { blockingCalendarEvents, courseBackgroundColor, isUneditedMigratedCourse } from "./courseBackground";
import { computeConflictLayout, scheduledTaskIntervalsOnDate } from "./conflictLayout";
import { getVisibleDays } from "../timelineGeometry";
import { normalizeData } from "../browserFallback";
import { getFreeSlots } from "../autoSchedule";
import type { CalendarEvent, Task } from "../types";

const date = "2099-01-05";
const course: CalendarEvent = { id: "class", fixedCourse: true, title: "语言文学", date, startTime: "09:00", endTime: "10:00", category: "personal", details: "", createdAt: "" };
const task: Task = { id: "work", title: "写作练习", dueDate: date, scheduledDate: date, scheduledStart: "09:15", scheduledEnd: "09:45", category: "personal", priority: "medium", notes: "", goalId: "", completed: false, createdAt: "", updatedAt: "" };
const displayedCourse: Task = { ...task, id: "event_occ_class", title: course.title, scheduledStart: "09:00", scheduledEnd: "10:00", fixedCourse: true };
const noop = () => {};
function markup(display: Task, viewMode: "daily" | "weekly", end = display.scheduledEnd) {
  return renderToStaticMarkup(<TimeBlock task={{ ...display, scheduledEnd: end }} preview={null} projectName="" projects={[]} hovered onHover={noop} onSelect={noop} onEdit={noop} onToggleDone={noop} onProjectChange={noop} onProjectColorChange={noop} onCreateProject={noop} onDragStart={noop} onResizeStart={noop} lang="zh" viewMode={viewMode} hourHeight={60} extraStyle={{ left: 8, width: 200, top: 60 }} />);
}

describe("course backgrounds", () => {
  it("merges untouched legacy course tasks while retaining edited copies and actual tasks", () => {
    const event = { ...course, id: "course_literature", details: "source timetable" };
    const migrated = { ...task, id: "migrated_event_course_literature_primary", title: course.title, notes: event.details, timelineRecords: [{ id: "old", taskId: "old", scheduledDate: date, scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus: "scheduled" as const, createdAt: "" }] };
    expect(isUneditedMigratedCourse(migrated, [event])).toBe(true);
    expect(isUneditedMigratedCourse({ ...migrated, title: "个人任务" }, [event])).toBe(false);
    expect(isUneditedMigratedCourse({ ...migrated, completed: true }, [event])).toBe(false);
    expect(isUneditedMigratedCourse({ ...migrated, timelineRecords: [{ ...migrated.timelineRecords[0], scheduledStart: "09:15" }] }, [event])).toBe(false);
    expect(isUneditedMigratedCourse(task, [event])).toBe(false);
  });
  it("respects the host seven-day week", () => {
    expect(getVisibleDays("weekly", "2026-11-04")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
  });
  it("preserves fixed courses as events across normalization instead of migrating them to tasks", () => {
    const data = { version: 2, importedSeedVersion: "test", generatedAt: "2026-11-02T00:00:00Z", aiMemories: [], tasks: [task], projects: [], events: [course], goals: [], longTasks: [], notes: [], drafts: [], chat: [] } as Parameters<typeof normalizeData>[0];
    const normalized = normalizeData(data);
    expect(normalized.events).toEqual([course]);
    expect(normalized.tasks.some(task => task.title === course.title)).toBe(false);
    expect(normalizeData(normalized).events).toEqual([course]);
  });
  it("retains ordinary event occupancy while allowing scheduling across classes", () => {
    const meeting = { ...course, id: "meeting", fixedCourse: undefined, startTime: "10:00", endTime: "11:00" };
    const events = blockingCalendarEvents([course, meeting]);
    expect(events).toEqual([meeting]);
    const free = getFreeSlots({ dateRange: [date], scheduledEvents: events.map(event => ({ id: event.id, title: event.title, scheduledDate: date, scheduledStart: event.startTime, scheduledEnd: event.endTime })), settings: { dayStart: "09:00", dayEnd: "11:00", bufferMinutes: 0 } });
    expect(free).toEqual([expect.objectContaining({ date, startMinutes: 540, endMinutes: 600 })]);
  });
  it("keeps a task at full width over a class, but preserves task overlap layout", () => {
    expect(computeConflictLayout([displayedCourse, task]).size).toBe(0);
    const layout = computeConflictLayout([displayedCourse, task, { ...task, id: "second" }]);
    expect(layout.has(displayedCourse.id)).toBe(false);
    expect(layout.get(task.id)?.count).toBe(2);
    expect(scheduledTaskIntervalsOnDate([displayedCourse, task], date)).toEqual([{ start: 555, end: 585 }]);
  });
  it("uses stable color across whitespace and full-width equivalent titles", () => {
    expect(courseBackgroundColor("语言文学")).toBe(courseBackgroundColor(" 语言文学 "));
    expect(courseBackgroundColor("ＡＰ计算机原理")).toBe(courseBackgroundColor("AP计算机原理"));
  });
  it.each(["daily", "weekly"] as const)("renders %s courses without task controls and with pass-through geometry", view => {
    const html = markup(displayedCourse, view);
    expect(html).toContain('data-kind="course"');
    expect(html).toContain("pointer-events:none");
    expect(html).toContain("left:8px;width:200px;top:60px;height:60px");
    expect(html).toContain("课程详情: 语言文学, 09:00–10:00");
    expect(html).not.toContain("df-resize-dot");
    expect(html).not.toContain("df-task-block-check");
    expect(html).not.toContain("df-block-project");
    expect(markup(task, view)).toContain("df-task-block-check");
  });
  it("preserves the actual height of a fifteen-minute course", () => {
    expect(markup(displayedCourse, "weekly", "09:15")).toContain("height:15px");
  });
});

describe('recurring course migration',()=>{it('merges exact recurring course copies and retains user edits',()=>{const recurrence={mode:'scheduled' as const,frequency:'weekly' as const,startDate:date,startTime:'09:00',durationMinutes:60};const event={...course,id:'course_recurring',recurrence};const migrated={...task,id:'migrated_event_course_recurring_primary',title:event.title,notes:event.details,dueDate:date,plannedForDate:date,estimatedHours:1,workflowStatus:'next' as const,recurrence,timelineRecords:[]};expect(isUneditedMigratedCourse(migrated,[event])).toBe(true);expect(isUneditedMigratedCourse({...migrated,plannedForDate:'2099-01-12',executionLane:'candidate'},[event])).toBe(true);expect(isUneditedMigratedCourse({...migrated,priority:'high'},[event])).toBe(false);expect(isUneditedMigratedCourse({...migrated,notes:'user notes'},[event])).toBe(false);expect(isUneditedMigratedCourse({...migrated,estimatedHours:0.5},[event])).toBe(false);});});
