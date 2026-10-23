import { afterEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ActionDisclosure, Button } from "./UiPrimitives";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.unstubAllGlobals());

describe("action disclosure dismissal", () => {
  it("allows a touch click after blur without a related target and still dismisses outside", () => {
    const listeners = new Map<string, (event: { target: unknown }) => void>();
    const removeEventListener = vi.fn();
    vi.stubGlobal("document", {
      addEventListener: (type: string, listener: (event: { target: unknown }) => void) => listeners.set(type, listener),
      removeEventListener,
    });
    const inside = {}, outside = {};
    const focus = vi.fn();
    const disclosure = { open: true, contains: (target: unknown) => target === inside, querySelector: () => ({ focus }) };
    const onAction = vi.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<ActionDisclosure label="More"><Button onClick={onAction}>Template</Button></ActionDisclosure>, {
        createNodeMock: (element) => element.type === "details" ? disclosure : null,
      });
    });
    const details = tree.root.findByType("details");
    // Safari can send this blur between pointerdown and click on a button.
    act(() => details.props.onBlur({ currentTarget: disclosure, relatedTarget: null }));
    expect(disclosure.open).toBe(true);
    act(() => tree.root.findByType("button").props.onClick());
    expect(onAction).toHaveBeenCalledOnce();
    act(() => listeners.get("pointerdown")!({ target: inside }));
    expect(disclosure.open).toBe(true);
    act(() => listeners.get("pointerdown")!({ target: outside }));
    expect(disclosure.open).toBe(false);

    disclosure.open = true;
    act(() => details.props.onBlur({ currentTarget: disclosure, relatedTarget: inside }));
    expect(disclosure.open).toBe(true);
    act(() => details.props.onBlur({ currentTarget: disclosure, relatedTarget: outside }));
    expect(disclosure.open).toBe(false);

    disclosure.open = true;
    const stopPropagation = vi.fn();
    act(() => details.props.onKeyDown({ key: "Escape", currentTarget: disclosure, stopPropagation }));
    expect(disclosure.open).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    act(() => tree.unmount());
    expect(removeEventListener).toHaveBeenCalledWith("pointerdown", listeners.get("pointerdown"));
  });
});
