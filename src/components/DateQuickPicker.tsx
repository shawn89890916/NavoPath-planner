import type { Language } from "../types";
import { useEffect, useRef, useState } from "react";
import { useMotionPresence } from "../useMotionPresence";
import { monthTitle } from "../i18n";
import { localIsoDate } from "../utils/localDate";
import { UiChevronLeftIcon, UiChevronRightIcon } from "./UiIcons";

export type DateQuickPickerProps = {
  open?: boolean;
  month: string;
  selectedDate: string;
  today: string;
  minDate?: string;
  maxDate?: string;
  weekStartsOn: 0 | 1;
  lang: Language;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
};

export function DateQuickPicker({ open = true, month, selectedDate, today, minDate, maxDate, weekStartsOn, lang, onMonthChange, onSelect }: DateQuickPickerProps) {
  const presence = useMotionPresence(open);
  const monthTarget = useRef(month);
  const monthButton = useRef<HTMLButtonElement>(null);
  const [direction, setDirection] = useState("forward");
  const [mode, setMode] = useState<"days" | "months" | "years">("days");
  useEffect(() => { monthTarget.current = month; }, [month]);
  useEffect(() => { if (open) setMode("days"); }, [open]);
  if (!presence.present) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const zh = lang === "zh";
  const monthLabels = Array.from({ length: 12 }, (_, index) => monthTitle(lang, year, index + 1).replace(zh ? `${year}年` : ` ${year}`, ""));
  const firstYear = Math.floor(year / 12) * 12;
  const first = new Date(year, monthNumber - 1, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const weekdayLabels = lang === "zh"
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const orderedWeekdays = Array.from({ length: 7 }, (_, index) => weekdayLabels[(index + weekStartsOn) % 7]);
  const moveMonth = (delta: number) => {
    const [targetYear, targetMonth] = monthTarget.current.split("-").map(Number);
    const date = new Date(targetYear, targetMonth - 1 + delta, 1);
    monthTarget.current = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    setDirection(delta < 0 ? "backward" : "forward");
    onMonthChange(monthTarget.current);
  };
  const selectPeriod = (nextYear: number, nextMonth: number) => {
    moveMonth((nextYear - year) * 12 + nextMonth - monthNumber);
    setMode(mode === "years" ? "months" : "days");
    monthButton.current?.focus();
  };
  const outsideRange = (start: string, end = start) => Boolean((minDate && end < minDate) || (maxDate && start > maxDate));
  const navigationStep = mode === "days" ? 1 : mode === "months" ? 12 : 144;
  const navigationLabels = {
    days: zh ? ["上个月", "下个月"] : ["Previous month", "Next month"],
    months: zh ? ["上一年", "下一年"] : ["Previous year", "Next year"],
    years: zh ? ["上一组年份", "下一组年份"] : ["Previous years", "Next years"],
  }[mode];
  const periodLabel = (period: "months" | "years") => period === "months" ? (zh ? "选择月份" : "Choose month") : (zh ? "选择年份" : "Choose year");

  return (
    <section className="df-mobile-date-picker" data-motion-closing={presence.closing || undefined} inert={presence.closing} aria-label={lang === "zh" ? "快速选择日期" : "Quick date picker"}>
      <header>
        <button type="button" onClick={() => moveMonth(-navigationStep)} aria-label={navigationLabels[0]}><UiChevronLeftIcon size={18} /></button>
        <div className="df-mobile-date-heading">{(zh ? ["years", "months"] as const : ["months", "years"] as const).map((period) => <button key={period} ref={period === "months" ? monthButton : undefined} type="button" aria-label={periodLabel(period)} aria-pressed={mode === period} onClick={() => setMode(mode === period ? "days" : period)}>{period === "months" ? monthLabels[monthNumber - 1] : `${mode === "years" ? `${firstYear}–${firstYear + 11}` : year}${zh ? "年" : ""}`}</button>)}</div>
        <button type="button" onClick={() => moveMonth(navigationStep)} aria-label={navigationLabels[1]}><UiChevronRightIcon size={18} /></button>
      </header>
      {mode === "days" && <div className="df-mobile-date-weekdays" aria-hidden="true">
        {orderedWeekdays.map((label) => <span key={label}>{label}</span>)}
      </div>}
      <div key={`${mode}-${month}`} className="df-mobile-date-grid" data-selection-mode={mode === "days" ? undefined : mode} data-motion-direction={direction} role="group" aria-label={mode === "days" ? undefined : periodLabel(mode)}>
        {Array.from({ length: mode === "days" ? 42 : 12 }, (_, index) => {
          const optionYear = mode === "years" ? firstYear + index : year;
          const optionMonth = mode === "years" ? 0 : mode === "months" ? index : monthNumber - 1;
          const date = localIsoDate(new Date(optionYear, optionMonth, mode === "days" ? index - offset + 1 : 1));
          const end = mode === "days" ? date : localIsoDate(new Date(optionYear, mode === "years" ? 12 : index + 1, 0));
          const selected = mode === "days" ? date === selectedDate : mode === "years" ? optionYear === year : index + 1 === monthNumber;
          const isToday = mode === "days" && date === today;
          return <button
            key={date}
            data-date={mode === "days" ? date : undefined}
            type="button"
            className={`${mode === "days" && date.slice(0, 7) !== month ? "outside" : ""}${selected ? " selected" : ""}${isToday ? " today" : ""}`}
            aria-pressed={selected}
            aria-label={mode === "days" ? date : undefined}
            disabled={outsideRange(date, end)}
            onClick={() => mode === "days" ? onSelect(date) : selectPeriod(optionYear, mode === "years" ? monthNumber : index + 1)}
          >{mode === "days" ? Number(date.slice(8, 10)) : mode === "years" ? optionYear : monthLabels[index]}</button>;
        })}
      </div>
    </section>
  );
}
