import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MobileQuickAddButton } from "./components/MobileQuickAddButton";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const props = { compactLayout: true, productPresentation: false, drawerOpen: false, notificationCenterOpen: false, utilityPanelOpen: false, aiOpen: false, lang: "zh" as const, onAdd: () => undefined };
const mobileStyles = readFileSync(new URL("./app.css", import.meta.url), "utf8");

describe("portrait mobile navigation", () => {
  it("renders an accessible quick-add button and invokes its action", () => {
    const onAdd = vi.fn();
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(MobileQuickAddButton, { ...props, onAdd })); });
    const button = tree.root.findByType("button");
    expect(button.props["aria-label"]).toBe("快速添加任务");
    expect(button.props.className).toBe("df-mobile-quick-add-fab");
    act(() => { button.props.onClick(); });
    expect(onAdd).toHaveBeenCalledOnce();
    act(() => { tree.unmount(); });
  });

  it.each([
    { compactLayout: false }, { productPresentation: true }, { drawerOpen: true },
    { notificationCenterOpen: true }, { utilityPanelOpen: true }, { aiOpen: true },
  ])("hides quick-add when an obstructing workspace state is active: %j", (patch) => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(MobileQuickAddButton, { ...props, ...patch })); });
    expect(tree.toJSON()).toBeNull();
    act(() => { tree.unmount(); });
  });

  it("keeps AI and Settings in dismissible task-detail-sized sheets", () => {
    expect(mobileStyles).toContain("#root .df-app .df-ai-panel-reference {");
    expect(mobileStyles).toContain("#root .df-app .df-utility-panel {");
    expect(mobileStyles).toContain("inset: 4dvh 0 0;");
    expect(mobileStyles).toContain("border-radius: 18px 18px 0 0;");
  });

  it("uses an iOS-sized switch while keeping the active theme accent", () => {
    expect(mobileStyles).toContain("width: 51px;");
    expect(mobileStyles).toContain("height: 31px;");
    expect(mobileStyles).toContain("background: var(--accent-active);");
  });
});
