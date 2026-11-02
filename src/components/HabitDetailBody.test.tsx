import React, { createRef } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import HabitDetailBody from "./HabitDetailBody";
import type { Habit } from "../types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.unstubAllGlobals());

describe("habit editor save on exit", () => {
  it("saves the latest unsaved form values through the parent close action", () => {
    vi.stubGlobal("window", {
      requestAnimationFrame: () => 0, cancelAnimationFrame: vi.fn(),
      setTimeout: () => 0, clearTimeout: vi.fn(),
    });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const ref = createRef<{ save: () => void }>();
    const onSave = vi.fn();
    const habit: Habit = {
      id: "habit-draft", title: "New habit", defaultDurationMinutes: 15,
      createdAt: "2026-11-02T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z",
    };
    let tree!: ReactTestRenderer;
    const render = (value: Habit) => <HabitDetailBody ref={ref} habit={value} projects={[]}
      dailyStates={[]} today="2026-11-02" zh weekdays={["日", "一", "二", "三", "四", "五", "六"]}
      onSave={onSave} onToggleDay={vi.fn()} onDelete={vi.fn()}
      onBack={vi.fn()} onConvertTo={vi.fn()} />;
    act(() => { tree = create(render(habit)); });
    act(() => {
      tree.root.findByProps({ type: "text" }).props.onChange({ target: { value: "晨读" } });
      tree.root.findAllByType("select")[0].props.onChange({ target: { value: "project-reading" } });
      tree.root.findByType("textarea").props.onChange({ target: { value: "保留编辑内容" } });
    });
    // A data refresh must not replace edits that are still in the open form.
    act(() => tree.update(render({ ...habit, updatedAt: "2026-11-02T01:00:00Z" })));
    expect(onSave).not.toHaveBeenCalled();
    act(() => ref.current!.save());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "晨读", projectId: "project-reading", notes: "保留编辑内容",
    }));
    act(() => tree.root.findByProps({ role: "switch" }).props.onClick());
    act(() => ref.current!.save());
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ archived: true, title: "晨读" }));
    act(() => tree.unmount());
    expect(ref.current).toBeNull();
  });
});
