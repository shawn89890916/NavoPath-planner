import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BetaUpdatePreference } from "./DesktopUpdateSettings";

let renderer: ReactTestRenderer | undefined;
afterEach(async () => { if (renderer) await act(async () => renderer!.unmount()); renderer = undefined; vi.unstubAllGlobals(); });

describe("Beta update preference", () => {
  it("uses the native device choice and saves only the acknowledged channel", async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    let acknowledge!: (value: boolean) => void;
    const setter = vi.fn(() => new Promise<boolean>(resolve => { acknowledge = resolve; }));
    vi.stubGlobal("window", { desktopApi: { getAcceptBetaUpdates: async () => false, setAcceptBetaUpdates: setter } });
    const onSave = vi.fn();
    await act(async () => { renderer = create(<BetaUpdatePreference lang="en" onSave={onSave} />); });
    const toggle = () => renderer!.root.findByProps({ role: "switch" });
    expect(toggle().props["aria-checked"]).toBe(false);
    await act(async () => toggle().props.onClick());
    expect(setter).toHaveBeenCalledWith(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(toggle().props.disabled).toBe(true);
    await act(async () => acknowledge(true));
    expect(toggle().props["aria-checked"]).toBe(true);
    expect(onSave).toHaveBeenCalledWith({ acceptBetaUpdates: true });
  });
  it("keeps the existing channel when native persistence fails", async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("window", { desktopApi: { getAcceptBetaUpdates: async () => false, setAcceptBetaUpdates: async () => { throw new Error("Disk unavailable"); } } });
    const onSave = vi.fn();
    await act(async () => { renderer = create(<BetaUpdatePreference lang="en" onSave={onSave} />); });
    await act(async () => renderer!.root.findByProps({ role: "switch" }).props.onClick());
    expect(renderer!.root.findByProps({ role: "switch" }).props["aria-checked"]).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer!.toJSON())).toContain("Could not save update preferences");
  });
});
