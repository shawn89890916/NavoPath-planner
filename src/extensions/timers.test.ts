import { describe, expect, it, vi } from "vitest";
import { provider } from "../../community-plugins/pomodoro/main";
import { getTimerMode, onTimerModeOpening, openTimerMode, registerTimerMode } from "./timers";

describe("public timer launcher", () => {
  it("opens the registered host controls without creating or advancing a timer", () => {
    const createRuntime = vi.fn(provider.createRuntime);
    const advance = vi.fn(provider.advance);
    const remove = registerTimerMode({ ...provider, createRuntime, advance } as any);
    const launch = vi.fn(); const off = onTimerModeOpening(launch);
    try {
      openTimerMode("pomodoro"); expect(launch).toHaveBeenCalledExactlyOnceWith("pomodoro");
      expect(createRuntime).not.toHaveBeenCalled(); expect(advance).not.toHaveBeenCalled();
      remove(); expect(getTimerMode("pomodoro")).toBeUndefined();
      expect(() => openTimerMode("pomodoro")).toThrow("not enabled");
      expect(launch).toHaveBeenCalledTimes(1);
    } finally { off(); remove(); }
  });
  it("explains when host controls are unavailable and releases the launcher", () => {
    const remove = registerTimerMode(provider as any);
    const off = onTimerModeOpening(() => {}); off();
    try { expect(() => openTimerMode("pomodoro")).toThrow("not available in this window"); }
    finally { remove(); }
  });
});
