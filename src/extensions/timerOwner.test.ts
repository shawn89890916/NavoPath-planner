import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimerOwner, type TimerOwner } from "./timerOwner";
import type { WidgetSnapshot } from "../types";

class Channel {
  static groups = new Map<string, Set<Channel>>();
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(public name: string) { const group = Channel.groups.get(name) || new Set(); group.add(this); Channel.groups.set(name, group); }
  postMessage(data: unknown) { for (const peer of Channel.groups.get(this.name) || []) if (peer !== this) queueMicrotask(() => peer.onmessage?.({ data })); }
  close() { Channel.groups.get(this.name)?.delete(this); this.onmessage = null; }
}
const instances: TimerOwner[] = [];
function fixture(accountId = "alice") {
  const changed = vi.fn(), action = vi.fn(), snapshot = vi.fn();
  const owner = createTimerOwner({ accountId, onOwnershipChange: changed, onAction: action, onSnapshot: snapshot }); instances.push(owner);
  return { owner, changed, action, snapshot };
}
beforeEach(() => {
  vi.useFakeTimers(); const values = new Map<string,string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) || null, setItem: (key: string,value:string) => values.set(key,value), removeItem: (key:string)=>values.delete(key) });
  vi.stubGlobal("navigator", {}); vi.stubGlobal("window", new EventTarget()); vi.stubGlobal("BroadcastChannel", Channel);
});
afterEach(() => { instances.splice(0).forEach(instance => instance.dispose()); Channel.groups.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("single-device timer ownership", () => {
  it("elects one clock and delivers follower actions once, including queued startup commands", async () => {
    const a = fixture(), b = fixture();
    b.owner.sendAction({ type: "timerPause" });
    await vi.advanceTimersByTimeAsync(60);
    expect(Number(a.owner.isOwner()) + Number(b.owner.isOwner())).toBe(1);
    const active = a.owner.isOwner() ? a : b, follower = a.owner.isOwner() ? b : a;
    expect(active.action).toHaveBeenCalledTimes(1); expect(active.action).toHaveBeenCalledWith({type:"timerPause"});
    follower.owner.sendAction({type:"timerStop"}); await vi.advanceTimersByTimeAsync(5);
    expect(active.action).toHaveBeenCalledTimes(2); await vi.advanceTimersByTimeAsync(1200); expect(active.action).toHaveBeenCalledTimes(2);
    expect(follower.action).not.toHaveBeenCalled();
  });
  it("mirrors snapshots and hands ownership to a surviving window", async () => {
    const a = fixture(), b = fixture(); await vi.advanceTimersByTimeAsync(60);
    const active = a.owner.isOwner() ? a : b, follower = a.owner.isOwner() ? b : a;
    const snapshot = { elapsedSeconds: 12, timerSnapshotAt: Date.now() } as WidgetSnapshot;
    active.owner.publish(snapshot); await vi.advanceTimersByTimeAsync(1); expect(follower.snapshot).toHaveBeenCalledWith(snapshot);
    active.owner.dispose(); await vi.advanceTimersByTimeAsync(1100); expect(follower.owner.isOwner()).toBe(true);
    follower.owner.sendAction({type:"timerResume"}); expect(follower.action).toHaveBeenCalledTimes(1);
  });
  it("keeps accounts independent and disposes every channel", async () => {
    const a = fixture("alice"), b = fixture("bob"); await vi.advanceTimersByTimeAsync(60);
    expect(a.owner.isOwner()).toBe(true); expect(b.owner.isOwner()).toBe(true);
    a.owner.publish({elapsedSeconds:9} as WidgetSnapshot); await vi.advanceTimersByTimeAsync(1); expect(b.snapshot).not.toHaveBeenCalled();
    a.owner.dispose(); a.owner.sendAction({type:"timerStop"}); expect(a.action).not.toHaveBeenCalled();
  });
  it("holds a Web Lock until disposal without attempting a competing storage lease", async () => {
    let releaseSeen = false;
    const request = vi.fn(async (_name, _options, callback) => { await callback(); releaseSeen = true; });
    vi.stubGlobal("navigator", { locks: { request } });
    const a = fixture(); expect(a.owner.isOwner()).toBe(true); expect(request).toHaveBeenCalledTimes(1);
    a.owner.dispose(); await Promise.resolve(); await Promise.resolve(); expect(releaseSeen).toBe(true);
  });
});
