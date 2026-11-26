export type SavePhase = "idle" | "pending" | "confirmed" | "retrying";
export type SaveFeedback = Record<"data" | "settings", SavePhase>;
export const IDLE_SAVE_FEEDBACK: SaveFeedback = { data: "idle", settings: "idle" };

export function aggregateSavePhase(state: SaveFeedback): SavePhase {
  if (state.data === "retrying" || state.settings === "retrying") return "retrying";
  if (state.data === "pending" || state.settings === "pending") return "pending";
  if (state.data === "confirmed" || state.settings === "confirmed") return "confirmed";
  return "idle";
}

export function saveFeedbackLabel(phase: SavePhase, lang: "zh" | "en", cloud: boolean): string {
  switch (phase) {
    case "pending": return lang === "zh" ? "正在保存…" : "Saving…";
    case "retrying": return lang === "zh" ? "保存未确认 · 正在重试" : "Save unconfirmed · retrying";
    case "confirmed": return lang === "zh" ? (cloud ? "云端保存已确认" : "本机保存已确认") : (cloud ? "Cloud save confirmed" : "Local save confirmed");
    default: return "";
  }
}
