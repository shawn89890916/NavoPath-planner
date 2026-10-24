import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it } from "vitest";
import { DailyTimelineGrid } from "./ExecutionSharedLayout";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("time-axis rendering", () => {
  it("keeps every visible hour and day boundary without hidden quarter-hour nodes", () => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<DailyTimelineGrid slotCount={672} dayStartHour={0} slotHeight={20} anchorDate="2026-10-23" />); });
    const hours = tree.root.findAllByType("div");
    expect(hours).toHaveLength(168);
    expect(hours[24].props.style.top).toBe("1920px");
    expect(hours[24].findByType("span").children).toEqual(["10.24 0:00"]);
    act(() => tree.unmount());
  });

  it("preserves hour alignment for half-hour day starts and zoom changes", () => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<DailyTimelineGrid slotCount={96} dayStartHour={9.5} slotHeight={10} anchorDate="2026-10-23" />); });
    expect(tree.root.findAllByType("div")).toHaveLength(24);
    expect(tree.root.findAllByType("div")[0].props.style.top).toBe("20px");
    expect(tree.root.findAllByType("span")[0].children).toEqual(["10:00"]);
    act(() => tree.update(<DailyTimelineGrid slotCount={96} dayStartHour={9.5} slotHeight={30} anchorDate="2026-10-23" />));
    expect(tree.root.findAllByType("div")[0].props.style.top).toBe("60px");
    act(() => tree.unmount());
  });

  it.each([9 + 10 / 60, 9 + 1 / 60, 23 + 59 / 60])("positions all hours for an arbitrary day boundary (%s)", (dayStartHour) => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<DailyTimelineGrid slotCount={97} dayStartHour={dayStartHour} slotHeight={20} anchorDate="2026-10-23" />); });
    const hours = tree.root.findAllByType("div");
    expect(hours).toHaveLength(24);
    const startMinutes = Math.round(dayStartHour * 60);
    expect(parseFloat(hours[0].props.style.top)).toBeCloseTo((60 - startMinutes % 60) / 15 * 20);
    const midnight = hours.find((node) => node.findByType("span").children.join("") === "10.24 0:00");
    expect(midnight).toBeDefined();
    expect(parseFloat(midnight!.props.style.top)).toBeCloseTo((1440 - startMinutes) / 15 * 20);
    act(() => tree.unmount());
  });
});
