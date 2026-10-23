import { useEffect, useState } from "react";
import { MOTION, scheduleMotionCommit } from "./motion";

/** Keep an exiting surface mounted; reopening cancels its pending removal. */
export function useMotionPresence(open: boolean, duration: number = MOTION.fade) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const exit = scheduleMotionCommit(() => setMounted(false), duration);
    return exit.cancel;
  }, [open, mounted, duration]);
  return { present: open || mounted, closing: !open && mounted };
}
