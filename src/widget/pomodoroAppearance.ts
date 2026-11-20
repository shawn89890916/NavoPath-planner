export const POMODORO_EXTENSION_KEY = "official:pomodoro";

export const pomodoroClockFonts = [
  { value: "serif", zh: "经典衬线", en: "Classic serif" },
  { value: "sans", zh: "简洁无衬线", en: "Clean sans" },
  { value: "mono", zh: "等宽数字", en: "Monospace" },
] as const;

export type PomodoroClockFont = typeof pomodoroClockFonts[number]["value"];

export function normalizePomodoroClockFont(value: unknown): PomodoroClockFont {
  return pomodoroClockFonts.find(font => font.value === value)?.value ?? "serif";
}
