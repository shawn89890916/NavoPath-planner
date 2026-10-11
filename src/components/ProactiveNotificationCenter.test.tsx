import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { ProactiveNotificationCenter } from "./ProactiveNotificationCenter";
import type { PlannerData } from "../types";
import type { ProactiveNotification } from "../proactiveAssistant";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("notification center", () => {
  it.each(["zh", "en"] as const)("clears every current notification without closing the center (%s)", (lang) => {
    const notifications = [{ id: "one", title: "First" }, { id: "two", title: "Second" }] as ProactiveNotification[];
    const onDismiss = vi.fn();
    const onClose = vi.fn();
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<ProactiveNotificationCenter data={{ tasks: [] } as unknown as PlannerData} lang={lang} notifications={notifications} open onClose={onClose} onDismiss={onDismiss} onOpenReview={() => {}} onOpenUnfinished={() => {}} onSaveData={() => {}} />); });
    const button = tree.root.findAllByType("button").find((item) => item.children.includes(lang === "zh" ? "一键清除" : "Clear all"))!;
    act(() => button.props.onClick());
    expect(onDismiss.mock.calls.map(([item]) => item.id)).toEqual(["one", "two"]);
    expect(onClose).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it("disables clearing when there are no notifications", () => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<ProactiveNotificationCenter data={{ tasks: [] } as unknown as PlannerData} lang="en" notifications={[]} open onClose={() => {}} onDismiss={() => {}} onOpenReview={() => {}} onOpenUnfinished={() => {}} onSaveData={() => {}} />); });
    expect(tree.root.findAllByType("button").find((item) => item.children.includes("Clear all"))?.props.disabled).toBe(true);
    act(() => tree.unmount());
  });
});
