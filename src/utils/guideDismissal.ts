type DismissibleGuide = "planning" | "schedule";

const storageKey = (guide: DismissibleGuide) => `navopath-dismissed-${guide}-guide-v1`;

export function isGuideDismissed(guide: DismissibleGuide): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(storageKey(guide)) === "1"; }
  catch { return false; }
}

export function dismissGuide(guide: DismissibleGuide): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(storageKey(guide), "1"); }
  catch { /* The guide still closes for this session when storage is unavailable. */ }
}
