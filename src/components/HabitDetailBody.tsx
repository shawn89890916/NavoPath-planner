import { useCallback, useEffect, useRef, useState } from "react";
import type { Habit, HabitDailyState, HabitTrackingType } from "../types";
import { habitStartDate, isHabitDueOnDate, isHabitWithinDateRange } from "../utils/habits";
import { addDays } from "../utils/recurrence";
import { ActionDisclosure, Button } from "./UiPrimitives";
import { SettingToggle } from "./SettingsControls";
import { DateQuickPicker } from "./DateQuickPicker";
import "./habit-detail.css";

const STEP_MINUTES = 15;

type HabitDetailBodyProps = {
  habit: Habit;
  dailyStates: HabitDailyState[];
  today: string;
  zh: boolean;
  weekdays: string[];
  onSave: (patch: Partial<Habit>) => void;
  onArchive: (archived: boolean) => void;
  onToggleDay: (date: string, completed: boolean) => void;
  onDelete: () => void;
  onBack: () => void;
  onConvertTo: (targetType: "task" | "project") => void;
};

export default function HabitDetailBody({ habit, dailyStates, today, zh, weekdays, onSave, onArchive, onToggleDay, onDelete, onBack, onConvertTo }: HabitDetailBodyProps) {
  const [title, setTitle] = useState(habit.title);
  const [notes, setNotes] = useState(habit.notes || "");
  const [duration, setDuration] = useState(String(habit.defaultDurationMinutes || 15));
  const [startDate, setStartDate] = useState(habitStartDate(habit));
  const [endDate, setEndDate] = useState(habit.endDate || "");
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>(habit.activeWeekdays ?? [1, 2, 3, 4, 5]);
  const [targetCount, setTargetCount] = useState(String(habit.targetCount || ""));
  const [trackingType, setTrackingType] = useState<HabitTrackingType>(habit.trackingType || "click-counter");
  const [enabled, setEnabled] = useState(!habit.archived);
  const [weekOffset, setWeekOffset] = useState(0);
  const [windowStartOffset, setWindowStartOffset] = useState(-1);
  const [windowDayCount, setWindowDayCount] = useState(14);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [todayHighlighted, setTodayHighlighted] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(today.slice(0, 7));
  const [visibleRange, setVisibleRange] = useState<[string, string]>(() => [addDays(today, -1), addDays(today, 5)]);
  const progressDaysRef = useRef<HTMLDivElement>(null);
  const todayHighlightTimerRef = useRef<number | undefined>(undefined);
  const windowStartOffsetRef = useRef(-1);
  const prependScrollWidthRef = useRef<number | null>(null);
  const prependPendingRef = useRef(false);
  const appendPendingRef = useRef(false);
  const ignoreProgrammaticScrollRef = useRef(false);

  const updateVisibleRange = useCallback(() => {
    const container = progressDaysRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const visible = Array.from(container.querySelectorAll<HTMLButtonElement>(".df-habit-detail-progress-day"))
      .filter((day) => {
        const rect = day.getBoundingClientRect();
        return rect.left >= containerRect.left - 1 && rect.right <= containerRect.right + 1;
      });
    if (visible.length === 0) return;
    const first = addDays(today, Number(visible[0].dataset.dayOffset));
    const last = addDays(today, Number(visible[visible.length - 1].dataset.dayOffset));
    setVisibleRange((current) => current[0] === first && current[1] === last ? current : [first, last]);
  }, [today]);

  useEffect(() => {
    setTitle(habit.title);
    setNotes(habit.notes || "");
    setDuration(String(habit.defaultDurationMinutes || 15));
    setStartDate(habitStartDate(habit));
    setEndDate(habit.endDate || "");
    setActiveWeekdays(habit.activeWeekdays ?? [1, 2, 3, 4, 5]);
    setTargetCount(String(habit.targetCount || ""));
    setTrackingType(habit.trackingType || "click-counter");
    setEnabled(!habit.archived);
    setWeekOffset(0);
    windowStartOffsetRef.current = -1;
    prependPendingRef.current = false;
    appendPendingRef.current = false;
    prependScrollWidthRef.current = null;
    setWindowStartOffset(-1);
    setWindowDayCount(14);
    setDatePickerOpen(false);
    setConfirmDelete(false);
  }, [habit.id]);

  useEffect(() => {
    if (!prependPendingRef.current) return;
    const container = progressDaysRef.current;
    const previousWidth = prependScrollWidthRef.current;
    if (!container || previousWidth === null) return;
    container.scrollLeft += container.scrollWidth - previousWidth;
    prependScrollWidthRef.current = null;
    updateVisibleRange();
    window.setTimeout(() => { prependPendingRef.current = false; }, 240);
  }, [windowStartOffset, updateVisibleRange]);

  useEffect(() => {
    appendPendingRef.current = false;
  }, [windowDayCount]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (progressDaysRef.current) progressDaysRef.current.scrollLeft = 0;
      updateVisibleRange();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [habit.id, updateVisibleRange]);

  useEffect(() => () => window.clearTimeout(todayHighlightTimerRef.current), []);

  const toggleWeekday = (day: number) => setActiveWeekdays((days) => days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort());
  const positionDateAtSecond = (date: string) => {
    const dateOffset = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    const weekStart = addDays(date, -((new Date(`${date}T00:00:00`).getDay() + 6) % 7));
    const todayWeekStart = addDays(today, -((new Date(`${today}T00:00:00`).getDay() + 6) % 7));
    const nextWeekOffset = Math.round((Date.parse(`${weekStart}T00:00:00Z`) - Date.parse(`${todayWeekStart}T00:00:00Z`)) / 604800000);
    windowStartOffsetRef.current = dateOffset - 1;
    prependPendingRef.current = false;
    appendPendingRef.current = false;
    prependScrollWidthRef.current = null;
    setWeekOffset(nextWeekOffset);
    setWindowStartOffset(dateOffset - 1);
    setWindowDayCount(14);
    setVisibleRange([addDays(today, dateOffset - 1), addDays(today, dateOffset + 5)]);
    setDatePickerOpen(false);
    ignoreProgrammaticScrollRef.current = true;
    window.requestAnimationFrame(() => {
      const container = progressDaysRef.current;
      if (container) {
        container.scrollLeft = 0;
        updateVisibleRange();
      }
      window.requestAnimationFrame(() => { ignoreProgrammaticScrollRef.current = false; });
    });
  };
  const goToToday = () => {
    window.clearTimeout(todayHighlightTimerRef.current);
    const todayIsInRange = isHabitWithinDateRange(rangeHabit, today);
    setTodayHighlighted(todayIsInRange);
    if (todayIsInRange) todayHighlightTimerRef.current = window.setTimeout(() => setTodayHighlighted(false), 900);
    positionDateAtSecond(today);
  };
  const navigateWeek = (direction: -1 | 1) => {
    const nextOffset = weekOffset + direction;
    positionDateAtSecond(addDays(today, nextOffset * 7));
  };
  const handleProgressScroll = () => {
    const container = progressDaysRef.current;
    if (!container) return;
    updateVisibleRange();
    if (ignoreProgrammaticScrollRef.current) return;
    const midpoint = container.getBoundingClientRect().left + container.clientWidth / 2;
    const dates = Array.from(container.querySelectorAll<HTMLButtonElement>(".df-habit-detail-progress-day"));
    const centerDay = dates.reduce<HTMLButtonElement | null>((closest, item) => {
      if (!closest) return item;
      return Math.abs(item.getBoundingClientRect().left + item.offsetWidth / 2 - midpoint) < Math.abs(closest.getBoundingClientRect().left + closest.offsetWidth / 2 - midpoint) ? item : closest;
    }, null);
    if (centerDay) {
      const dateOffset = Number(centerDay.dataset.dayOffset);
      const date = addDays(today, dateOffset);
      const currentWeekStart = addDays(today, -((new Date(`${today}T00:00:00`).getDay() + 6) % 7));
      const centerWeekStart = addDays(date, -((new Date(`${date}T00:00:00`).getDay() + 6) % 7));
      const nextWeekOffset = Math.round((Date.parse(`${centerWeekStart}T00:00:00Z`) - Date.parse(`${currentWeekStart}T00:00:00Z`)) / 604800000);
      setWeekOffset((current) => current === nextWeekOffset ? current : nextWeekOffset);
    }
    if (container.scrollLeft < 220 && !prependPendingRef.current) {
      prependScrollWidthRef.current = container.scrollWidth;
      prependPendingRef.current = true;
      const nextStart = windowStartOffsetRef.current - 28;
      windowStartOffsetRef.current = nextStart;
      setWindowStartOffset(nextStart);
      setWindowDayCount((count) => count + 28);
    }
    if (container.scrollLeft + container.clientWidth > container.scrollWidth - 220 && !appendPendingRef.current) {
      appendPendingRef.current = true;
      setWindowDayCount((count) => count + 28);
    }
  };
  const saveChanges = () => {
    const parsedDuration = Number(duration);
    const parsedTarget = Number(targetCount);
    const savedStartDate = startDate || habitStartDate(habit);
    onSave({
      title: title.trim() || habit.title,
      notes,
      trackingType,
      defaultDurationMinutes: parsedDuration >= STEP_MINUTES && parsedDuration <= 480 && parsedDuration % STEP_MINUTES === 0 ? parsedDuration : (habit.defaultDurationMinutes || 15),
      startDate: savedStartDate,
      endDate: endDate && endDate >= savedStartDate ? endDate : undefined,
      activeWeekdays,
      targetCount: targetCount.trim() && parsedTarget >= 0 ? parsedTarget : undefined,
      archived: !enabled,
    });
  };
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const baseDay = addDays(today, weekOffset * 7);
  const weekStart = addDays(baseDay, -((new Date(`${baseDay}T00:00:00`).getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const progressDays = Array.from({ length: windowDayCount }, (_, index) => {
    const dayOffset = windowStartOffset + index;
    return { date: addDays(today, dayOffset), dayOffset };
  });
  const rangeHabit = { ...habit, startDate: startDate || habitStartDate(habit), endDate: endDate || undefined };
  const dueDays = weekDays.filter((date) => isHabitDueOnDate(rangeHabit, date));
  const completedDates = new Set(dailyStates.filter((state) => state.habitId === habit.id && state.completed).map((state) => state.date));
  const startYear = visibleRange[0].slice(0, 4);
  const endYear = visibleRange[1].slice(0, 4);
  const range = `${startYear !== endYear ? `${startYear}/` : ""}${visibleRange[0].slice(5).replace("-", "/")} - ${startYear !== endYear ? `${endYear}/` : ""}${visibleRange[1].slice(5).replace("-", "/")}`;

  return <>
    <section className="df-habit-detail-progress" aria-label={zh ? "习惯完成情况" : "Habit completion"}>
      <header><div><button type="button" className="df-habit-detail-progress-range" aria-expanded={datePickerOpen} onClick={() => { setDatePickerMonth(visibleRange[0].slice(0, 7)); setDatePickerOpen((open) => !open); }}>{range}<span className="df-date-title-chevron" aria-hidden="true">⌄</span></button><span>{zh ? `本周完成 ${dueDays.filter((date) => completedDates.has(date)).length}/${dueDays.length}` : `${dueDays.filter((date) => completedDates.has(date)).length}/${dueDays.length} complete this week`}</span></div><div className="df-habit-detail-progress-actions"><button type="button" aria-label={zh ? "上一周" : "Previous week"} onClick={() => navigateWeek(-1)}>‹</button><button type="button" onClick={goToToday}>{zh ? "今天" : "Today"}</button><button type="button" aria-label={zh ? "下一周" : "Next week"} onClick={() => navigateWeek(1)}>›</button></div></header>
      {datePickerOpen && <DateQuickPicker month={datePickerMonth} selectedDate={visibleRange[0]} today={today} minDate={rangeHabit.startDate} maxDate={rangeHabit.endDate} weekStartsOn={1} lang={zh ? "zh" : "en"} onMonthChange={setDatePickerMonth} onSelect={positionDateAtSecond} />}
      <div className="df-habit-detail-progress-days" ref={progressDaysRef} onScroll={handleProgressScroll}>{progressDays.map(({ date, dayOffset }) => {
        const day = new Date(`${date}T00:00:00`).getDay();
        const due = isHabitDueOnDate(rangeHabit, date);
        const completed = due && completedDates.has(date);
        const label = `${zh ? `周${weekdays[day]}` : weekdays[day]} ${date.slice(8)}`;
        return <button key={date} data-day-offset={dayOffset} type="button" className={`df-habit-detail-progress-day${due ? " is-due" : ""}${completed ? " is-complete" : ""}${date === today ? " is-today" : ""}${date === today && todayHighlighted ? " is-highlighted" : ""}`} title={label} aria-label={`${label}: ${completed ? (zh ? "已完成" : "Completed") : due ? (zh ? "未完成" : "Not completed") : (zh ? "无需检查" : "Not scheduled")}`} aria-pressed={completed} disabled={!due} onClick={() => onToggleDay(date, !completed)}><b>{zh ? `周${weekdays[day]}` : weekdays[day]}</b><small>{date.slice(8)}</small><i aria-hidden="true">{completed && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.5 2.5L10 3" /></svg>}</i></button>;
      })}</div>
    </section>
    <section className="df-habit-settings-form">
      <label className="df-habit-setting-field df-habit-setting-field-title"><span>{zh ? "标题" : "Title"}</span><input type="text" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <div className="df-habit-setting-field df-habit-setting-toggle"><span>{zh ? "启用" : "Enabled"}</span><SettingToggle checked={enabled} ariaLabel={zh ? "启用习惯" : "Enable habit"} onChange={(next) => { setEnabled(next); onSave({ archived: !next }); }} /></div>
      <div className="df-habit-setting-field df-habit-type-field"><span>{zh ? "类型" : "Type"}</span><div className="df-habit-type-options" role="group" aria-label={zh ? "习惯类型" : "Habit type"}><button type="button" className={trackingType === "click-counter" ? "is-selected" : ""} aria-pressed={trackingType === "click-counter"} onClick={() => setTrackingType("click-counter")}>{zh ? "点击计数" : "Click Counter"}</button><button type="button" className={trackingType === "duration" ? "is-selected" : ""} aria-pressed={trackingType === "duration"} onClick={() => setTrackingType("duration")}>{zh ? "累积时长" : "Duration"}</button></div></div>
      {trackingType === "click-counter" ? <label className="df-habit-setting-field"><span>{zh ? "目标次数" : "Target Count"}</span><input type="number" min={0} value={targetCount} onChange={(event) => setTargetCount(event.target.value)} /></label> : <label className="df-habit-setting-field"><span>{zh ? "时长" : "Duration"}</span><input type="number" min={STEP_MINUTES} max={480} step={STEP_MINUTES} value={duration} onChange={(event) => setDuration(event.target.value)} /><small>{zh ? "以 15 分钟为单位" : "Set in 15-minute increments"}</small></label>}
      <label className="df-habit-setting-field df-habit-date-field"><span>{zh ? "开始于" : "Start From"}</span><input type="date" value={startDate} onChange={(event) => { const next = event.target.value; setStartDate(next); if (endDate && next && endDate < next) setEndDate(""); }} /></label>
      <label className="df-habit-setting-field df-habit-date-field"><span>{zh ? "截止于" : "Till"}</span><input type="date" value={endDate} min={rangeHabit.startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <div className="df-habit-setting-field df-habit-weekday-field"><span>{zh ? "检查连续的星期几 *" : "Weekdays to check *"}</span><div className="df-habit-weekday-checks">{weekOrder.map((day) => <button key={day} type="button" className={`df-habit-weekday-check${activeWeekdays.includes(day) ? " is-selected" : ""}`} onClick={() => toggleWeekday(day)} aria-pressed={activeWeekdays.includes(day)}><i aria-hidden="true">{activeWeekdays.includes(day) && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.5 2.5L10 3" /></svg>}</i><strong>{zh ? `星期${weekdays[day]}` : weekdays[day]}</strong></button>)}</div></div>
      <label className="df-habit-setting-field"><span>{zh ? "备注" : "Notes"}</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </section>
    <section className="df-habit-detail-actions"><button type="button" className="df-habit-back-btn" onClick={onBack}>{zh ? "返回总览" : "Back to overview"}</button><button type="button" className="df-habit-save-btn" onClick={saveChanges}>{zh ? "保存" : "Save"}</button><ActionDisclosure label={zh ? "更多习惯操作" : "More habit actions"}><Button onClick={() => onArchive(!habit.archived)}>{habit.archived ? (zh ? "恢复习惯" : "Restore Habit") : (zh ? "归档习惯" : "Archive Habit")}</Button><Button variant="danger" aria-pressed={confirmDelete} onClick={() => { if (confirmDelete) onDelete(); else setConfirmDelete(true); }}>{confirmDelete ? (zh ? "确认" : "Confirm") : (zh ? "永久删除" : "Delete permanently")}</Button></ActionDisclosure><span className="df-habit-delete-status" role="status">{confirmDelete ? (zh ? "再次点击以永久删除此习惯" : "Click Confirm to permanently delete this habit") : ""}</span></section>
    <section className="df-habit-settings-form df-habit-convert-section"><label className="df-habit-setting-field df-habit-convert-field"><span>{zh ? "转换为" : "Convert to"}</span><select value="" onChange={(event) => { const target = event.target.value as "task" | "project" | ""; if (target) onConvertTo(target); }}><option value="">{zh ? "选择类型…" : "Choose a type…"}</option><option value="task">{zh ? "任务" : "Task"}</option><option value="project">{zh ? "项目" : "Project"}</option></select></label></section>
  </>;
}
