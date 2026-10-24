import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { useMobileSheetGesture } from "./useMobileSheetGesture";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setup() {
  const panel = { classList: { add: vi.fn(), remove: vi.fn() }, style: { setProperty: vi.fn(), removeProperty: vi.fn() } };
  const header = { parentElement: panel, setPointerCapture: vi.fn(), hasPointerCapture: () => false, releasePointerCapture: vi.fn() };
  const onSwipeUp = vi.fn();
  const onSwipeDown = vi.fn();
  function Harness({ enabled = true }: { enabled?: boolean }) {
    return <div {...useMobileSheetGesture({ enabled, onSwipeUp, onSwipeDown })} />;
  }
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<Harness />); });
  const event = (type: string, y: number, time: number, x = 0) => ({
    type, pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, timeStamp: time,
    nativeEvent: { pointerId: 1, clientX: x, clientY: y, timeStamp: time },
    currentTarget: header, target: { closest: () => null }, preventDefault: vi.fn(), stopPropagation: vi.fn(),
  });
  const send = (handler: string, type: string, y: number, time: number, x = 0) => {
    const next = event(type, y, time, x);
    act(() => tree.root.findByType("div").props[handler](next));
    return next;
  };
  return { panel, header, onSwipeUp, onSwipeDown, tree, Harness, send };
}

describe("sheet header gestures", () => {
  it.each([[-32, "onSwipeUp"], [32, "onSwipeDown"]] as const)("accepts a fast %ipx flick", (distance, callback) => {
    const s = setup();
    s.send("onPointerDownCapture", "pointerdown", 100, 0);
    s.send("onPointerMoveCapture", "pointermove", 100 + distance, 30);
    s.send("onPointerUpCapture", "pointerup", 100 + distance, 40);
    expect(s[callback]).toHaveBeenCalledOnce();
    expect(s.panel.style.removeProperty).toHaveBeenCalledWith("--mobile-sheet-drag-y");
    act(() => s.tree.unmount());
  });

  it("recognizes a fast release after holding the header", () => {
    const s = setup();
    s.send("onPointerDownCapture", "pointerdown", 100, 0);
    s.send("onPointerMoveCapture", "pointermove", 92, 500);
    s.send("onPointerMoveCapture", "pointermove", 65, 530);
    s.send("onPointerUpCapture", "pointerup", 65, 540);
    expect(s.onSwipeUp).toHaveBeenCalledOnce();
    act(() => s.tree.unmount());
  });

  it.each([[-60, "onSwipeUp"], [100, "onSwipeDown"]] as const)("accepts a deliberate %ipx drag", (distance, callback) => {
    const s = setup();
    s.send("onPointerDownCapture", "pointerdown", 100, 0);
    s.send("onPointerMoveCapture", "pointermove", 100 + distance, 500);
    s.send("onPointerUpCapture", "pointerup", 100 + distance, 1000);
    expect(s[callback]).toHaveBeenCalledOnce();
    act(() => s.tree.unmount());
  });

  it("leaves taps and tiny jitter available to controls", () => {
    const s = setup();
    s.send("onPointerDownCapture", "pointerdown", 100, 0);
    s.send("onPointerMoveCapture", "pointermove", 103, 1);
    s.send("onPointerUpCapture", "pointerup", 103, 2);
    const click = { detail: 1, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    s.tree.root.findByType("div").props.onClickCapture(click);
    expect(click.preventDefault).not.toHaveBeenCalled();
    expect(s.header.setPointerCapture).not.toHaveBeenCalled();
    expect(s.onSwipeUp).not.toHaveBeenCalled();
    expect(s.onSwipeDown).not.toHaveBeenCalled();
    act(() => s.tree.unmount());
  });

  it("suppresses the click after dragging but permits keyboard activation and the next tap", () => {
    const s = setup();
    s.send("onPointerDownCapture", "pointerdown", 100, 0);
    s.send("onPointerMoveCapture", "pointermove", 80, 100);
    s.send("onPointerUpCapture", "pointerup", 80, 200);
    const click = { detail: 1, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    s.tree.root.findByType("div").props.onClickCapture(click);
    expect(click.preventDefault).toHaveBeenCalledOnce();
    click.preventDefault.mockClear();
    s.tree.root.findByType("div").props.onClickCapture({ ...click, detail: 0 });
    expect(click.preventDefault).not.toHaveBeenCalled();
    s.send("onPointerDownCapture", "pointerdown", 100, 300);
    s.send("onPointerUpCapture", "pointerup", 100, 350);
    s.tree.root.findByType("div").props.onClickCapture(click);
    expect(click.preventDefault).not.toHaveBeenCalled();
    act(() => s.tree.unmount());
  });

  it("ignores horizontal movement, cancellation and gestures while closed", () => {
    const s = setup();
    s.send("onPointerDownCapture", "pointerdown", 100, 0);
    s.send("onPointerMoveCapture", "pointermove", 100, 10, 30);
    s.send("onPointerUpCapture", "pointerup", 0, 30, 30);
    s.send("onPointerDownCapture", "pointerdown", 100, 100);
    s.send("onPointerMoveCapture", "pointermove", 200, 120);
    s.send("onPointerCancelCapture", "pointercancel", 200, 130);
    act(() => s.tree.update(<s.Harness enabled={false} />));
    s.send("onPointerDownCapture", "pointerdown", 100, 200);
    s.send("onPointerMoveCapture", "pointermove", 0, 220);
    s.send("onPointerUpCapture", "pointerup", 0, 230);
    expect(s.onSwipeUp).not.toHaveBeenCalled();
    expect(s.onSwipeDown).not.toHaveBeenCalled();
    expect(s.panel.classList.remove).toHaveBeenCalledWith("is-sheet-dragging");
    act(() => s.tree.unmount());
  });
});
