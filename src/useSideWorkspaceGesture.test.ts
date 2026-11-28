import { describe, expect, it } from "vitest";
import { sideWorkspaceSwipe } from "./useSideWorkspaceGesture";

describe("side workspace touch intent", () => {
  it("opens to the right and closes to the left", () => {
    expect(sideWorkspaceSwipe(false, 85, 0, 250)).toBe(true);
    expect(sideWorkspaceSwipe(true, -85, 0, 250)).toBe(true);
    expect(sideWorkspaceSwipe(false, -85, 0, 250)).toBe(false);
    expect(sideWorkspaceSwipe(true, 85, 0, 250)).toBe(false);
  });
  it("cancels short drags but recognizes a deliberate flick", () => {
    expect(sideWorkspaceSwipe(false, 30, 0.1, 250)).toBe(false);
    expect(sideWorkspaceSwipe(false, 30, 0.7, 250)).toBe(true);
    expect(sideWorkspaceSwipe(true, -30, -0.7, 250)).toBe(true);
    expect(sideWorkspaceSwipe(true, -15, -1, 250)).toBe(false);
  });
});
