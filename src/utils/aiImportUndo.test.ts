import { describe, expect, it } from "vitest";
import { createDemoData, DEMO_DATE, scheduleDemoTask } from "../productDemoData";
import { undoAiImportData } from "./aiImportUndo";

describe("shared AI import undo", () => {
  it("restores the selected round while retaining earlier arrangements and unrelated tasks", () => {
    const initial = createDemoData("en", "ai", 1);
    const first = scheduleDemoTask(initial, "content", DEMO_DATE, "09:30");
    const second = scheduleDemoTask(first, "layout", DEMO_DATE, "11:00");
    const undone = undoAiImportData(second, { previousTasks: [first.tasks[1]], addedTaskIds: [], addedEventIds: [] });
    expect(undone.tasks[0].scheduledStart).toBe("09:30");
    expect(undone.tasks[1].scheduledStart).toBeUndefined();
    expect(undone.tasks[2]).toBe(second.tasks[2]);
    expect(second.tasks[1].scheduledStart).toBe("11:00");
  });

  it("restores the previous version when a later request adjusts the same task", () => {
    const initial = createDemoData("en", "ai", 1);
    const first = scheduleDemoTask(initial, "content", DEMO_DATE, "09:30");
    const changed = scheduleDemoTask(first, "content", DEMO_DATE, "14:00");
    const undone = undoAiImportData(changed, { previousTasks: [first.tasks[0]], addedTaskIds: [], addedEventIds: [] });
    expect(undone.tasks[0]).toBe(first.tasks[0]);
    expect(changed.tasks[0].scheduledStart).toBe("14:00");
  });
});
