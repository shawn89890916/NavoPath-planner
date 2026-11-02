import type { WidgetAction, WidgetSnapshot } from "../types";

export interface TimerOwner {
  isOwner(): boolean; sendAction(action: WidgetAction): void;
  publish(snapshot: WidgetSnapshot): void; dispose(): void;
}
/** A device-local clock lease. Account sync never transfers a running session. */
export function createTimerOwner(options: {
  accountId: string; onOwnershipChange(owner: boolean): void;
  onAction(action: WidgetAction): void; onSnapshot(snapshot: WidgetSnapshot): void;
}): TimerOwner {
  const id = crypto.randomUUID(), name = `navopath-timer:${options.accountId}`;
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(name);
  const leaseKey = name + ":owner", seenKey = name + ":handled";
  const pending = new Map<string, WidgetAction>();
  const abort = new AbortController();
  let owner = false, closed = false, release: (() => void) | undefined;
  let lastSnapshot: WidgetSnapshot | undefined, confirmation: ReturnType<typeof setTimeout> | undefined;
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  const send = (message: object) => { if (!closed) channel?.postMessage({ ...message, from: id }); };
  const readLease = (): { id: string; expires: number } | null => { try { return JSON.parse(localStorage.getItem(leaseKey) || "null"); } catch { return null; } };
  const isOwner = () => !closed && owner && (!!locks || (readLease()?.id === id && (readLease()?.expires || 0) > Date.now()));
  const setOwner = (value: boolean) => { if (owner === value || closed) return; owner = value; options.onOwnershipChange(value); if (value) { send({ type: "owner" }); if (lastSnapshot) send({ type: "snapshot", snapshot: lastSnapshot }); } };
  const run = (actionId: string, action: WidgetAction) => {
    if (!isOwner()) return;
    // Record before delivery. A takeover must not repeat an already delivered
    // stop/save command if its ACK was lost while the old window was closing.
    let handled: string[] = [];
    try { handled = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch { /* optional replay protection */ }
    if (!handled.includes(actionId)) {
      try { localStorage.setItem(seenKey, JSON.stringify([...handled.slice(-255), actionId])); } catch { /* live owner still deduplicates through pending ACKs */ }
      options.onAction(action);
    }
    send({ type: "ack", actionId });
  };
  const flush = () => { for (const [actionId, action] of pending) { if (isOwner()) { run(actionId, action); pending.delete(actionId); } else send({ type: "action", actionId, action }); } };
  if (channel) channel.onmessage = event => {
    const message = event.data;
    if (closed || !message || message.from === id) return;
    if (message.type === "hello" && isOwner()) { send({ type: "owner" }); if (lastSnapshot) send({ type: "snapshot", snapshot: lastSnapshot }); }
    if (message.type === "owner") flush();
    if (message.type === "snapshot" && !isOwner()) { lastSnapshot = message.snapshot; options.onSnapshot(message.snapshot); flush(); }
    if (message.type === "action" && typeof message.actionId === "string") run(message.actionId, message.action);
    if (message.type === "ack") pending.delete(message.actionId);
  };
  const acquireFallback = () => {
    if (closed) return;
    const lease = readLease();
    if (lease?.id === id && lease.expires > Date.now()) {
      try { localStorage.setItem(leaseKey, JSON.stringify({ id, expires: Date.now() + 4000 })); } catch { setOwner(false); return; }
      if (isOwner()) flush(); return;
    }
    setOwner(false);
    if (lease && lease.expires > Date.now()) return;
    try { localStorage.setItem(leaseKey, JSON.stringify({ id, expires: Date.now() + 4000 })); } catch { return; }
    if (confirmation) clearTimeout(confirmation);
    confirmation = setTimeout(() => { if (readLease()?.id === id) { setOwner(true); flush(); } }, 50);
  };
  if (locks) {
    void locks.request(name, { signal: abort.signal }, async () => {
      if (closed) return;
      setOwner(true); flush();
      await new Promise<void>(resolve => { release = resolve; if (closed) resolve(); });
    }).catch(error => { if (!closed) console.warn("[timer] ownership", error); });
  } else acquireFallback();
  const interval = setInterval(() => { if (!locks) acquireFallback(); flush(); if (!isOwner()) send({ type: "hello" }); }, 1000);
  send({ type: "hello" });
  const api: TimerOwner = {
    isOwner,
    sendAction(action) { const actionId = crypto.randomUUID(); if (isOwner()) run(actionId, action); else { pending.set(actionId, action); flush(); } },
    publish(snapshot) { if (!isOwner()) return; lastSnapshot = snapshot; send({ type: "snapshot", snapshot }); },
    dispose() {
      if (closed) return;
      if (!locks && readLease()?.id === id) { try { localStorage.removeItem(leaseKey); } catch { /* unavailable storage */ } }
      closed = true; owner = false; abort.abort(); release?.(); clearInterval(interval); if (confirmation) clearTimeout(confirmation); channel?.close(); pending.clear();
      window.removeEventListener("pagehide", api.dispose);
    },
  };
  window.addEventListener("pagehide", api.dispose);
  return api;
}
