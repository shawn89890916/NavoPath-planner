import { afterEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ActionDisclosure, Button } from "./UiPrimitives";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("action disclosure dismissal", () => {
  it("cancels an exiting menu when its trigger is pressed again", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const disclosure = { querySelector: vi.fn() };
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<ActionDisclosure label="More">Action</ActionDisclosure>, { createNodeMock: (element) => element.type === "details" ? disclosure : null }); });
    const summary = tree.root.findByType("summary");
    act(() => summary.props.onClick({ preventDefault: vi.fn() }));
    expect(tree.root.findByType("details").props.open).toBe(true);
    act(() => summary.props.onClick({ preventDefault: vi.fn() }));
    expect(tree.root.findByProps({ className: "ui-popover ui-action-disclosure-panel" }).props.inert).toBe(true);
    act(() => summary.props.onClick({ preventDefault: vi.fn() }));
    act(() => { vi.advanceTimersByTime(140); });
    expect(tree.root.findByType("details").props.open).toBe(true);
    expect(tree.root.findByProps({ className: "ui-popover ui-action-disclosure-panel" }).props.inert).toBe(false);
    act(() => summary.props.onClick({ preventDefault: vi.fn() }));
    act(() => { vi.advanceTimersByTime(140); });
    expect(tree.root.findByType("details").props.open).toBe(false);
    act(() => tree.unmount());
  });

  it("allows a touch click after blur without a related target and still dismisses outside", () => {
    const listeners = new Map<string, (event: { target: unknown }) => void>();
    const removeEventListener = vi.fn();
    vi.stubGlobal("document", {
      addEventListener: (type: string, listener: (event: { target: unknown }) => void) => listeners.set(type, listener),
      removeEventListener,
    });
    const inside = {}, outside = {};
    const focus = vi.fn();
    const disclosure = { contains: (target: unknown) => target === inside, querySelector: () => ({ focus }) };
    const onAction = vi.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<ActionDisclosure label="More"><Button onClick={onAction}>Template</Button></ActionDisclosure>, {
        createNodeMock: (element) => element.type === "details" ? disclosure : null,
      });
    });
    const details = tree.root.findByType("details");
    const openMenu = () => act(() => tree.root.findByType("summary").props.onClick({ preventDefault: vi.fn() }));
    openMenu();
    // Safari can send this blur between pointerdown and click on a button.
    act(() => details.props.onBlur({ currentTarget: disclosure, relatedTarget: null }));
    expect(tree.root.findByType("details").props.open).toBe(true);
    act(() => tree.root.findByType("button").props.onClick());
    expect(onAction).toHaveBeenCalledOnce();
    act(() => listeners.get("pointerdown")!({ target: inside }));
    expect(tree.root.findByType("details").props.open).toBe(true);
    act(() => listeners.get("pointerdown")!({ target: outside }));
    expect(tree.root.findByType("details").props.open).toBe(false);

    openMenu();
    act(() => details.props.onBlur({ currentTarget: disclosure, relatedTarget: inside }));
    expect(tree.root.findByType("details").props.open).toBe(true);
    act(() => details.props.onBlur({ currentTarget: disclosure, relatedTarget: outside }));
    expect(tree.root.findByType("details").props.open).toBe(false);

    openMenu();
    const stopPropagation = vi.fn();
    act(() => details.props.onKeyDown({ key: "Escape", currentTarget: disclosure, stopPropagation }));
    expect(tree.root.findByType("details").props.open).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    act(() => tree.unmount());
    expect(removeEventListener).toHaveBeenCalledWith("pointerdown", listeners.get("pointerdown"));
  });
});
