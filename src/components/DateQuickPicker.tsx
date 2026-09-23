import type { Language } from "../types";
import { monthTitle } from "../i18n";
import { localIsoDate } from "../utils/localDate";

export type DateQuickPickerProps = {
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

export function DateQuickPicker({ month, selectedDate, today, minDate, maxDate, weekStartsOn, lang, onMonthChange, onSelect }: DateQuickPickerProps) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const days = Array.from({ length: 42 }, (_, index) => localIsoDate(new Date(year, monthNumber - 1, index - offset + 1)));
  const weekdayLabels = lang === "zh"
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const orderedWeekdays = Array.from({ length: 7 }, (_, index) => weekdayLabels[(index + weekStartsOn) % 7]);
  const moveMonth = (delta: number) => {
    const date = new Date(year, monthNumber - 1 + delta, 1);
    onMonthChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <section className="df-mobile-date-picker" aria-label={lang === "zh" ? "快速选择日期" : "Quick date picker"}>
      <header>
        <button type="button" onClick={() => moveMonth(-1)} aria-label={lang === "zh" ? "上个月" : "Previous month"}>‹</button>
        <strong>{monthTitle(lang, year, monthNumber)}</strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label={lang === "zh" ? "下个月" : "Next month"}>›</button>
      </header>
      <div className="df-mobile-date-weekdays" aria-hidden="true">
        {orderedWeekdays.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="df-mobile-date-grid">
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
            disabled={outsideRange}
            onClick={() => onSelect(date)}
          >{Number(date.slice(8, 10))}</button>;
        })}
      </div>
    </section>
  );
}
