import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Task, TimelineRecord } from "../types";
import { TimeBlock } from "../WorkspacePresentation";
import { EngagementRating } from "./EngagementRating";

const task: Task = {
  id: "work", title: "Work", dueDate: "2026-10-17", category: "personal", priority: null,
  notes: "", goalId: "", completed: false, createdAt: "now", updatedAt: "now",
};
const noop = () => {};
const record = (executionStatus: TimelineRecord["executionStatus"]): TimelineRecord => ({
  id: executionStatus, taskId: task.id, scheduledDate: "2026-10-17",
  scheduledStart: "09:00", scheduledEnd: "10:00", executionStatus, engagement: 40, createdAt: "now",
});

describe("engagement before completion", () => {
  it("offers the default rating on an unfinished task without execution records", () => {
    const markup = renderToStaticMarkup(<EngagementRating task={task} lang="en" onUpdate={noop} />);
    expect(markup).toContain('aria-label="Engagement · Work"');
    expect(markup).not.toContain('<select');
    expect(markup).toContain('aria-valuetext="80%"');
  });

  it("offers independent ratings for scheduled, completed, unfinished, and skipped records", () => {
    const timelineRecords = ["scheduled", "completed", "returned_unfinished", "skipped", "cancelled"].map(status => record(status as TimelineRecord["executionStatus"]));
    const markup = renderToStaticMarkup(<EngagementRating task={{ ...task, timelineRecords }} lang="en" onUpdate={noop} />);
    expect(markup.match(/type="range"/g)).toHaveLength(4);
    for (const item of timelineRecords) {
      const selected = renderToStaticMarkup(<EngagementRating task={{ ...task, timelineRecords }} record={item} lang="en" onUpdate={noop} />);
      if (item.executionStatus === "cancelled") expect(selected).toBe("");
      else expect(selected).toContain('aria-valuetext="40%"');
    }
  });

  it("shows unfinished record stripes consistently in all timeline views and honors the feature switch", () => {
    for (const viewMode of ["daily", "3day", "weekly"] as const) {
      for (const executionStatus of ["scheduled", "returned_unfinished", "completed"] as const) {
        for (const engagementEnabled of [false, true]) {
          const markup = renderToStaticMarkup(<TimeBlock
            task={{ ...task, ...record(executionStatus), completed: executionStatus === "completed" }}
            engagementEnabled={engagementEnabled} viewMode={viewMode} preview={null}
            projectName="" projects={[]} hovered={false} lang="en"
            onHover={noop} onSelect={noop} onEdit={noop} onToggleDone={noop}
            onProjectChange={noop} onProjectColorChange={noop} onCreateProject={noop}
            onDragStart={noop} onResizeStart={noop}
          />);
          if (engagementEnabled) {
            expect(markup).toContain('data-engagement="40"');
            expect(markup).toContain('title="Engagement: 40%"');
          } else expect(markup).not.toContain('data-engagement=');
        }
      }
    }
  });
});
