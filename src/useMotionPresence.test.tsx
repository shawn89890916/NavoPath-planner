import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMotionPresence } from "./useMotionPresence";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Surface({ open }: { open: boolean }) {
  const presence = useMotionPresence(open, 140);
  return presence.present ? <div data-closing={presence.closing} /> : null;
}
function browser(reduced = false) {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: reduced }),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("motion presence", () => {
  it("retains the exit and cancels stale removal when reopened", () => {
    browser();
    let surface!: ReactTestRenderer;
    act(() => { surface = create(<Surface open />); });
    act(() => surface.update(<Surface open={false} />));
    expect(surface.root.findByType("div").props["data-closing"]).toBe(true);
    act(() => { vi.advanceTimersByTime(80); });
    act(() => surface.update(<Surface open />));
    act(() => { vi.advanceTimersByTime(100); });
    expect(surface.root.findByType("div").props["data-closing"]).toBe(false);
    act(() => surface.update(<Surface open={false} />));
    act(() => { vi.advanceTimersByTime(140); });
    expect(surface.toJSON()).toBeNull();
    act(() => surface.unmount());
  });

  it("removes immediately for reduced motion and cancels timers on unmount", () => {
    browser(true);
    let surface!: ReactTestRenderer;
    act(() => { surface = create(<Surface open />); });
    act(() => surface.update(<Surface open={false} />));
    expect(surface.toJSON()).toBeNull();
    act(() => surface.unmount());
    browser();
    act(() => { surface = create(<Surface open />); });
    act(() => surface.update(<Surface open={false} />));
    act(() => surface.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });
});
