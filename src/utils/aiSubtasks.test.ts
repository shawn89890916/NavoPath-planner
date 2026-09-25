import { describe, expect, it } from "vitest";
import { appendAiSubtasks, getAiSubtaskSuggestions } from "./aiSubtasks";

describe("getAiSubtaskSuggestions", () => {
  it("accepts only valid subtasks for the focused task", () => {
    expect(getAiSubtaskSuggestions([
      { type: "create_subtasks", taskId: "another-task", subtasks: [{ title: "Wrong target" }] },
      { type: "create_subtasks", taskId: "task-1", subtasks: [{ title: " Draft outline " }, { title: " " }] },
    ], "task-1")).toEqual([{ title: " Draft outline " }]);
  });

  it("returns no suggestions when the action does not target the focused task", () => {
    expect(getAiSubtaskSuggestions([{ type: "create_subtasks", taskId: "task-2", subtasks: [{ title: "Other task" }] }], "task-1")).toEqual([]);
  });
});

describe("appendAiSubtasks", () => {
  it("turns AI suggestions into visible subtasks while preserving existing rows", () => {
    let index = 0;
    const result = appendAiSubtasks(
      [{ id: "existing", title: "收集资料", completed: false, createdAt: "earlier" }],
      [{ title: "  列出提纲  " }, { title: "收集资料" }, { title: "" }],
      () => `ai-${++index}`,
      "now",
    );

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ id: "ai-1", title: "列出提纲", completed: false, done: false, createdAt: "now" });
  });

  it("returns the existing list unchanged when suggestions are empty or duplicates", () => {
    const existing = [{ id: "existing", title: "收集资料", completed: false, createdAt: "earlier" }];
    let createIdCalled = false;
    const result = appendAiSubtasks(existing, [{ title: "收集资料" }, { title: " " }], () => { createIdCalled = true; return "unused"; }, "now");
    expect(result).toEqual(existing);
    expect(createIdCalled).toBe(false);
  });
});
