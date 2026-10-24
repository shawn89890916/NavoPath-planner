import type { Language } from "../types";
import { useEffect, useRef, useState } from "react";
import { useMotionPresence } from "../useMotionPresence";
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
  const monthLabels = Array.from({ length: 12 }, (_, index) => zh ? `${index + 1}月` : new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2024, index, 1)));
  const firstYear = Math.floor(year / 12) * 12;
  const years = Array.from({ length: 12 }, (_, index) => firstYear + index);
  const first = new Date(year, monthNumber - 1, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const days = Array.from({ length: 42 }, (_, index) => localIsoDate(new Date(year, monthNumber - 1, index - offset + 1)));
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
    const next = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
    setDirection(next < month ? "backward" : "forward");
    monthTarget.current = next;
    onMonthChange(next);
    setMode(mode === "years" ? "months" : "days");
    monthButton.current?.focus();
  };
  const outsideRange = (start: string, end: string) => Boolean((minDate && end < minDate) || (maxDate && start > maxDate));
  const navigationStep = mode === "days" ? 1 : mode === "months" ? 12 : 144;
  const previousLabel = mode === "days" ? (zh ? "上个月" : "Previous month") : mode === "months" ? (zh ? "上一年" : "Previous year") : (zh ? "上一组年份" : "Previous years");
  const nextLabel = mode === "days" ? (zh ? "下个月" : "Next month") : mode === "months" ? (zh ? "下一年" : "Next year") : (zh ? "下一组年份" : "Next years");
  const monthControl = <button ref={monthButton} type="button" aria-label={zh ? "选择月份" : "Choose month"} aria-pressed={mode === "months"} onClick={() => setMode(mode === "months" ? "days" : "months")}>{monthLabels[monthNumber - 1]}</button>;
  const yearControl = <button type="button" aria-label={zh ? "选择年份" : "Choose year"} aria-pressed={mode === "years"} onClick={() => setMode(mode === "years" ? "days" : "years")}>{mode === "years" ? `${firstYear}–${firstYear + 11}` : year}{zh ? "年" : ""}</button>;

  return (
    <section className="df-mobile-date-picker" data-motion-closing={presence.closing || undefined} inert={presence.closing} aria-label={lang === "zh" ? "快速选择日期" : "Quick date picker"}>
      <header>
        <button type="button" onClick={() => moveMonth(-navigationStep)} aria-label={previousLabel}><UiChevronLeftIcon size={18} /></button>
        <div className="df-mobile-date-heading">{zh ? <>{yearControl}{monthControl}</> : <>{monthControl}{yearControl}</>}</div>
        <button type="button" onClick={() => moveMonth(navigationStep)} aria-label={nextLabel}><UiChevronRightIcon size={18} /></button>
      </header>
      {mode === "days" ? <><div className="df-mobile-date-weekdays" aria-hidden="true">
        {orderedWeekdays.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div key={month} className="df-mobile-date-grid" data-motion-direction={direction}>
        {days.map((date) => {
          const currentMonth = date.slice(0, 7) === month;
          const selected = date === selectedDate;
          const isToday = date === today;
          const outsideRange = Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
          return <button
            key={date}
            data-date={date}
            type="button"
            className={`${currentMonth ? "" : "outside"}${selected ? " selected" : ""}${isToday ? " today" : ""}`}
            aria-pressed={selected}
            aria-label={date}
            disabled={outsideRange}
            onClick={() => onSelect(date)}
          >{Number(date.slice(8, 10))}</button>;
        })}
      </div></> : <div key={`${mode}-${mode === "years" ? firstYear : year}`} className="df-mobile-date-grid" data-selection-mode={mode} data-motion-direction={direction} role="group" aria-label={mode === "months" ? (zh ? "选择月份" : "Choose month") : (zh ? "选择年份" : "Choose year")}>
        {mode === "months" ? monthLabels.map((label, index) => {
          const period = `${year}-${String(index + 1).padStart(2, "0")}`;
          return <button key={period} type="button" className={index + 1 === monthNumber ? "selected" : ""} aria-pressed={index + 1 === monthNumber} disabled={outsideRange(`${period}-01`, localIsoDate(new Date(year, index + 1, 0)))} onClick={() => selectPeriod(year, index + 1)}>{label}</button>;
        }) : years.map((value) => <button key={value} type="button" className={value === year ? "selected" : ""} aria-pressed={value === year} disabled={outsideRange(`${value}-01-01`, `${value}-12-31`)} onClick={() => selectPeriod(value, monthNumber)}>{value}</button>)}
      </div>}
    </section>
  );
}
