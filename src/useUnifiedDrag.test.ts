import { describe, expect, it } from "vitest";
import { bindHeldTouchScroll } from "./useUnifiedDrag";

function touchMove(source: EventTarget, touches = 1, cancelable = true) {
  const event = new Event("touchmove", { cancelable });
  Object.defineProperty(event, "touches", { value: Array(touches).fill({}) });
  source.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("held-touch scrolling", () => {
  it("preserves swipes before a hold and after cancellation, but keeps a held drag active", () => {
    const source = new EventTarget();
    let ready = false;
    let cancelled = false;
    const release = bindHeldTouchScroll(source as HTMLElement, () => ready && !cancelled);
    expect(touchMove(source)).toBe(false);
    ready = true;
    expect(touchMove(source)).toBe(true);
    cancelled = true;
    expect(touchMove(source)).toBe(false);
    cancelled = false;
    release();
    expect(touchMove(source)).toBe(false);
  });

  it("leaves multi-touch gestures and non-cancelable events alone", () => {
    const source = new EventTarget();
    const release = bindHeldTouchScroll(source as HTMLElement, () => true);
    expect(touchMove(source, 2)).toBe(false);
    expect(touchMove(source, 1, false)).toBe(false);
    release();
  });
});
