import { useEffect, useState } from "react";
import type { Language } from "../types";
import { calculateTimelineRecordEnd, calendarDateTimeSpanMinutes } from "../utils/timelineRecords";
import { workspaceNow } from "../workspaceEnvironment";
import { DateQuickPicker } from "./DateQuickPicker";
import { UiCalendarDaysIcon, UiTimerIcon } from "./UiIcons";
import { Button, Input, Modal } from "./UiPrimitives";

export type TaskScheduleRange = { date: string; start: string; endDate: string; end: string };
type Edge = "start" | "end";
type Panel = "date" | "time";

export function TaskDetailSchedule({ range, today, weekStartsOn, lang, countdown, onSave }: {
  range: TaskScheduleRange;
  today: string;
  weekStartsOn: 0 | 1;
  lang: Language;
  countdown: boolean;
  onSave: (source: TaskScheduleRange, range: TaskScheduleRange, duration: number) => string | undefined;
}) {
  const zh = lang === "zh";
  const locale = zh ? "zh-CN" : "en-US";
  const [editor, setEditor] = useState<{ edge: Edge; source: TaskScheduleRange } | null>(null);
  const edge = editor?.edge;
  const [panel, setPanel] = useState<Panel>("date");
  const [date, setDate] = useState(range.date);
  const [time, setTime] = useState(range.start);
  const [month, setMonth] = useState(range.date.slice(0, 7));
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => workspaceNow().getTime());
  const duration = calendarDateTimeSpanMinutes(range.date, range.start, range.endDate, range.end);
  const startAt = new Date(`${range.date}T${range.start}`).getTime();
  const endAt = new Date(`${range.endDate}T${range.end}`).getTime();
  const left = countdown && now >= startAt ? Math.max(0, Math.ceil((endAt - now) / 60_000)) : 0;
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
    ...(value.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
  }).format(new Date(`${value}T00:00:00Z`));
  const formatTime = (value: string) => new Intl.DateTimeFormat(locale, {
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  }).format(new Date(`2000-01-01T${value}Z`));
  const formatSpan = (minutes: number) => [
    minutes >= 60 ? `${Math.floor(minutes / 60)}${zh ? "小时" : " h"}` : "",
    minutes % 60 || !minutes ? `${minutes % 60}${zh ? "分钟" : " min"}` : "",
  ].filter(Boolean).join(zh ? "" : " ");
  const startLabel = formatDate(range.date) + (zh ? " " : ", ") + formatTime(range.start);
  const endLabel = (range.date !== range.endDate ? formatDate(range.endDate) + (zh ? " " : ", ") : "") + formatTime(range.end);
  const startTitle = zh ? "编辑开始日期和时间" : "Edit start date and time";
  const endTitle = zh ? "编辑结束日期和时间" : "Edit end date and time";

  useEffect(() => {
    if (!countdown || now >= endAt) return;
    const timer = window.setTimeout(() => setNow(workspaceNow().getTime()), 15_000);
    return () => window.clearTimeout(timer);
  }, [countdown, endAt, now]);

  function openEditor(nextEdge: Edge) {
    const isStart = nextEdge === "start";
    const selected = isStart ? range.date : range.endDate;
    setDate(selected);
    setMonth(selected.slice(0, 7));
    setTime(isStart ? range.start : range.end);
    setPanel(isStart ? "date" : "time");
    setError("");
    setEditor({ edge: nextEdge, source: range });
  }

  function save() {
    if (!editor) return;
    const { edge, source } = editor;
    if (!time) {
      setPanel("time");
      setError(zh ? "请输入时间。" : "Enter a time.");
      return;
    }
    const nextDuration = edge === "start"
      ? calendarDateTimeSpanMinutes(source.date, source.start, source.endDate, source.end)
      : calendarDateTimeSpanMinutes(source.date, source.start, date, time);
    if (nextDuration <= 0) {
      setError(zh ? "结束时间必须晚于开始时间。" : "The end must be after the start.");
      return;
    }
    const nextEnd = edge === "start" ? calculateTimelineRecordEnd(date, time, nextDuration) : { scheduledEndDate: date, scheduledEnd: time };
    const next = { date: edge === "start" ? date : source.date, start: edge === "start" ? time : source.start, endDate: nextEnd.scheduledEndDate!, end: nextEnd.scheduledEnd };
    const message = next.date === source.date && next.start === source.start && next.endDate === source.endDate && next.end === source.end
      ? undefined : onSave(source, next, nextDuration);
    if (message) setError(message);
    else setEditor(null);
  }

  return <>
    <div className="df-task-schedule-summary">
      <div className="df-task-schedule-range">
        <Button variant="ghost" aria-label={`${startTitle} · ${startLabel}`} aria-haspopup="dialog" onClick={() => openEditor("start")}>{startLabel}</Button>
        <span aria-hidden="true">–</span>
        <Button variant="ghost" aria-label={`${endTitle} · ${endLabel}`} aria-haspopup="dialog" onClick={() => openEditor("end")}>{endLabel}</Button>
        <span>· {formatSpan(duration)}</span>
      </div>
      {left > 0 && <p>{zh ? `剩余 ${formatSpan(left)}` : `${formatSpan(left)} left`}</p>}
    </div>
    <Modal open={!!editor} portalContainer={document.querySelector(".df-app")} className="df-dialog df-task-schedule-editor" label={edge === "end" ? endTitle : startTitle} onClose={() => setEditor(null)} onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); setEditor(null); }
    }}>
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <h2>{edge === "end" ? endTitle : startTitle}</h2>
        <div className="df-task-schedule-panels" role="group" aria-label={zh ? "选择日期或时间" : "Choose date or time"}>
          <Button variant="text" aria-pressed={panel === "date"} onClick={() => setPanel("date")}><UiCalendarDaysIcon />{formatDate(date)}</Button>
          <Button variant="text" aria-pressed={panel === "time"} onClick={() => setPanel("time")}><UiTimerIcon />{time ? formatTime(time) : (zh ? "时间" : "Time")}</Button>
        </div>
        <div className="df-task-schedule-picker">
          {panel === "date" ? <DateQuickPicker month={month} selectedDate={date} today={today} weekStartsOn={weekStartsOn} lang={lang} minDate={edge === "end" ? editor?.source.date : undefined} onMonthChange={setMonth} onSelect={(value) => { setDate(value); setMonth(value.slice(0, 7)); setError(""); }} />
            : <label>{zh ? "时间" : "Time"}<Input type="time" value={time} onChange={(event) => { setTime(event.target.value); setError(""); }} /></label>}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="df-task-schedule-footer">
          <Button variant="text" onClick={() => setEditor(null)}>{zh ? "取消" : "Cancel"}</Button>
          <Button variant="primary" type="submit">{zh ? "确认" : "Confirm"}</Button>
        </div>
      </form>
    </Modal>
  </>;
}
