import "./MonthView.css";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Language, Project, Task } from "./types";
import { TaskBlock, TaskBlockContent } from "./components/TaskBlock";
import { IconButton } from "./components/UiPrimitives";
import { UiPlusIcon } from "./components/UiIcons";
import { useUnifiedDrag } from "./useUnifiedDrag";
import { autoScrollAtDragEdge } from "./utils/dragAutoScroll";
import { addIsoDays, layoutMonthWeeks, monthScrollTopForDate, monthWeekAtOffset, visibleMonthWeekRange } from "./utils/monthWindow";
import { buildMonthTaskBuckets } from "./utils/monthTasks";

export default function MonthView({ weeks, tasks, schedules, projects, selectedDate, today, lang, weekStartsOn,
  compact, dragging, dropDate, scrollRef, projectColor, isEvent, onSelectDate, onOpenDate, onEditTask,
  onMoveTask, onReturnTask, onAddTask, onDragActivate, onDragFinish, quickAddDate, renderQuickAdd }: {
  weeks: string[][]; tasks: Task[]; schedules: Task[]; projects: Project[];
  selectedDate: string; today: string; lang: Language; weekStartsOn: 0 | 1; compact: boolean;
  dragging: boolean; dropDate: string; scrollRef: RefObject<HTMLDivElement | null>;
  projectColor: (task: Task) => string; isEvent: (task: Task) => boolean;
  onSelectDate: (date: string) => void; onOpenDate: (date: string, tasks: Task[]) => void;
  onEditTask: (task: Task) => void; onMoveTask: (task: Task, date: string) => void;
  onReturnTask?: (task: Task, point: { x: number; y: number }) => void;
  onAddTask: (date: string) => void; onDragActivate: () => void; onDragFinish: () => void;
  quickAddDate?: string;
  renderQuickAdd: (date: string) => ReactNode;
}) {
  const [focus, setFocus] = useState(selectedDate.slice(0, 7));
  const [pointerDropDate, setPointerDropDate] = useState("");
  const [focusedWeek, setFocusedWeek] = useState<string>();
  const [{ first, last }, setVisibleRange] = useState({ first: 0, last: -1 });
  const anchorRef = useRef<{ date: string; offset: number } | null>(null);
  const monthDrag = useUnifiedDrag();
  const buckets = useMemo(() => buildMonthTaskBuckets(tasks, schedules, new Set(weeks.flat())), [tasks, schedules, weeks]);
  const { rows, totalHeight } = useMemo(
    () => layoutMonthWeeks(weeks, (date) => buckets.get(date)?.length ?? 0, compact),
    [weeks, buckets, compact],
  );
  const previousLayout = useRef<{ rows: typeof rows; weeks: typeof weeks; selectedDate: string } | null>(null);
  const activeDrag = dragging || monthDrag.isDragging;
  const sourceWeek = monthDrag.snapshot?.sourceElement.closest<HTMLElement>("[data-week-anchor]")?.dataset.weekAnchor;
  const visibleRows = rows.filter(({ dates, index }) => (index >= first && index <= last)
    || dates[0] === sourceWeek || dates[0] === focusedWeek || (quickAddDate !== undefined && dates.includes(quickAddDate)));
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "full" }), [lang]);

  const measureViewport = useCallback((element: HTMLDivElement) => {
    const range = visibleMonthWeekRange(rows, element.scrollTop, element.clientHeight);
    setVisibleRange((current) => current.first === range.first && current.last === range.last ? current : range);
  }, [rows]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const previous = previousLayout.current;
    const selectionChanged = !previous || previous.selectedDate !== selectedDate || previous.weeks !== weeks;
    let nextTop: number | undefined;
    if (selectionChanged) {
      const anchor = anchorRef.current;
      anchorRef.current = null;
      if (anchor) nextTop = monthScrollTopForDate(rows, anchor.date, anchor.offset);
      if (nextTop === undefined) {
        nextTop = monthScrollTopForDate(rows, selectedDate, container.clientHeight * 0.32);
        setFocus(selectedDate.slice(0, 7));
      }
    } else {
      const currentTop = container.scrollTop;
      const row = previous.rows[monthWeekAtOffset(previous.rows, currentTop)];
      if (row) nextTop = monthScrollTopForDate(rows, row.dates[0], row.top - currentTop);
    }
    if (nextTop !== undefined && nextTop !== container.scrollTop) container.scrollTop = nextTop;
    previousLayout.current = { rows, weeks, selectedDate };
    measureViewport(container);
  }, [rows, selectedDate, weeks, scrollRef, measureViewport]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measureViewport(container));
    observer.observe(container);
    return () => observer.disconnect();
  }, [scrollRef, measureViewport]);

  const dateAtPointer = (pointer: { x: number; y: number }) =>
    document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>(".df-month-cell[data-date]")?.dataset.date || "";

  return <div className="df-month-view">
    <div className="df-month-header"><div className="df-month-title"><span className="df-month-name">
      {new Date(`${focus}-01T00:00:00`).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "long", year: "numeric" })}
    </span></div></div>
    <div className="df-month-body">
      <div className="df-month-weekdays">{Array.from({ length: 7 }, (_, index) => (index + weekStartsOn) % 7).map((day) =>
        <span key={day}>{(lang === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"])[day]}</span>)}</div>
      <div className="df-month-scroll" ref={scrollRef} onScroll={(event) => {
        const element = event.currentTarget;
        measureViewport(element);
        const focused = rows[monthWeekAtOffset(rows, element.scrollTop + element.clientHeight * 0.35)];
        if (!focused) return;
        setFocus(focused.dates[0].slice(0, 7));
        if (!activeDrag && !anchorRef.current && (element.scrollTop < 160 || element.scrollTop + element.clientHeight > element.scrollHeight - 160)) {
          anchorRef.current = { date: focused.dates[0], offset: focused.top - element.scrollTop };
          onSelectDate(addIsoDays(selectedDate, element.scrollTop < 160 ? -140 : 140));
        }
      }}>
        <div className="df-month-week-spacer" style={{ height: totalHeight }}>
          {visibleRows.map(({ dates: week, index, top, height }) => <div key={week[0]} data-week-anchor={week[0]}
            data-first-week={index === 0 ? "" : undefined} data-week-parity={index % 2 === 0 ? "odd" : "even"}
            className="df-month-week-row" style={{ top, height }}
            onFocusCapture={() => setFocusedWeek(week[0])}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setFocusedWeek((current) => current === week[0] ? undefined : current);
              }
            }}>
          {week.map((date) => {
            const dayTasks = buckets.get(date) || [];
            const dateObj = new Date(`${date}T00:00:00`);
            const open = () => { if (!activeDrag) onOpenDate(date, dayTasks); };
            return <div key={date} data-date={date} className={`df-month-cell${date.slice(0, 7) === focus ? " focus-month" : " muted"}${date === today ? " today" : ""}${activeDrag ? " drag-active" : ""}${(pointerDropDate || dropDate) === date ? " drag-hover" : ""}`}
              onClick={(event) => { if (!(event.target as HTMLElement).closest("button,input,.df-quick-add-input-box")) open(); }}>
              <div className="df-month-cell-header">
                <button type="button" className="df-month-cell-strong" aria-label={dateFormatter.format(dateObj)} aria-current={date === today ? "date" : undefined}
                  onClick={(event) => { event.stopPropagation(); open(); }}>{dateObj.getDate()}</button>
                <IconButton className="df-month-add" label={lang === "zh" ? `在 ${date} 添加任务` : `Add task on ${date}`} icon={<UiPlusIcon size={12} />}
                  onClick={(event) => { event.stopPropagation(); onAddTask(date); }} />
              </div>
              <div className="df-month-cell-tasks">
                {dayTasks.map((task) => <TaskBlock key={task.id} as="button" type="button" variant="compact" appearance="calm" checked={!isEvent(task) && task.completed}
                  projectColor={projects.find((project) => project.id === task.projectId)?.color || projectColor(task)}
                  className={`df-month-task${isEvent(task) ? " is-event" : ""}`} dataAttrs={{ kind: isEvent(task) ? "event" : "task", "task-id": task.id }}
                  ariaLabel={`${task.scheduledStart || ""} ${task.title}`} title={task.title}
                  onClick={(event) => { event.stopPropagation(); onEditTask(task); }}
                  onPointerDown={(event) => {
                    if (isEvent(task)) return;
                    monthDrag.beginDrag(event, { taskId: task.id, requireHoldMs: 360, onActivate: onDragActivate,
                      onMove: (pointer) => { autoScrollAtDragEdge(pointer.x, pointer.y, [scrollRef.current]); setPointerDropDate(dateAtPointer(pointer)); },
                      onDrop: (pointer) => { const date = dateAtPointer(pointer); if (date) onMoveTask(task, date); else onReturnTask?.(task, pointer); setPointerDropDate(""); onDragFinish(); },
                      onCancel: () => { setPointerDropDate(""); onDragFinish(); } });
                  }}
                  main={<TaskBlockContent title={task.title}>{task.scheduledStart ? <time>{task.scheduledStart}</time> : isEvent(task) ? <small>{lang === "zh" ? "事件" : "Event"}</small> : null}</TaskBlockContent>}
                />)}
                {!activeDrag && renderQuickAdd(date)}
              </div>
            </div>;
          })}
          </div>)}
        </div>
      </div>
    </div>
    {monthDrag.overlay}
  </div>;
}
