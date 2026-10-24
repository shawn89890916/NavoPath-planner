import { useRef } from "react";
import { flushSync } from "react-dom";
import { runMotionTransition, type MotionDirection, type MotionScope } from "./motion";

/** Absolute navigation keeps the latest request, including before React commits. */
export function useMotionSelection<T extends string>(value: T, commit: (next: T) => void, scope: MotionScope, order: readonly T[] | ((previous: T, next: T) => MotionDirection)) {
  const pendingRef = useRef<{ value: T } | null>(null);
  return (next: T) => {
    const previous = pendingRef.current?.value ?? value;
    if (next === previous) return;
    const pending = { value: next };
    pendingRef.current = pending;
    void runMotionTransition(() => flushSync(() => commit(next)), {
      scope, key: pendingRef, direction: typeof order === "function" ? order(previous, next) : order.indexOf(next) < order.indexOf(previous) ? "backward" : "forward",
    }).finally(() => { if (pendingRef.current === pending) pendingRef.current = null; });
  };
}
