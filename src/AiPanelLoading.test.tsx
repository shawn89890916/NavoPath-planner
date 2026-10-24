import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { AiPanelLoading } from "./WorkspacePresentation";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AI dialog while its module loads", () => {
  it("provides a close button and Escape before the full panel is available", () => {
    const onClose = vi.fn();
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(AiPanelLoading, { lang: "en", docked: false, onClose })); });
    const panel = tree.root.findByType("aside");
    expect(panel.props["aria-busy"]).toBe("true");
    expect(tree.root.findByProps({ role: "status" }).children).toEqual(["Opening Navo AI…"]);
    act(() => { tree.root.findByProps({ "aria-label": "Close" }).props.onClick(); });
    act(() => { panel.props.onKeyDown({ key: "Escape" }); });
    expect(onClose).toHaveBeenCalledTimes(2);
    act(() => { tree.unmount(); });
  });

  it("retains exit state and panel geometry when closed before loading completes", () => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(AiPanelLoading, { lang: "zh", docked: true, embedded: true, closing: true, onClose: vi.fn() })); });
    const panel = tree.root.findByType("aside");
    expect(panel.props.inert).toBe(true);
    expect(panel.props["data-motion-closing"]).toBe(true);
    expect(panel.props.className).toContain("is-embedded is-docked");
    expect(tree.root.findAllByProps({ className: "df-mobile-sheet-dismiss-handle" })).toHaveLength(0);
    act(() => { tree.unmount(); });
  });
});
