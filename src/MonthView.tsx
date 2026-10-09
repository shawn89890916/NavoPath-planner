import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Language, Project, Task } from "./types";
import { TaskBlock, TaskBlockContent } from "./components/TaskBlock";
import { IconButton } from "./components/UiPrimitives";
import { UiPlusIcon } from "./components/UiIcons";
import { useUnifiedDrag } from "./useUnifiedDrag";
import { autoScrollAtDragEdge } from "./utils/dragAutoScroll";
import { addIsoDays } from "./utils/monthWindow";
import { buildMonthTaskBuckets } from "./utils/monthTasks";

export default function MonthView({ weeks, tasks, schedules, projects, selectedDate, today, lang, weekStartsOn,
  compact, dragging, dropDate, scrollRef, projectColor, isEvent, onSelectDate, onOpenDate, onEditTask,
  onMoveTask, onAddTask, onDragActivate, onDragFinish, renderQuickAdd }: {
  weeks: string[][]; tasks: Task[]; schedules: Task[]; projects: Project[];
  selectedDate: string; today: string; lang: Language; weekStartsOn: 0 | 1; compact: boolean;
  dragging: boolean; dropDate: string; scrollRef: RefObject<HTMLDivElement | null>;
  projectColor: (task: Task) => string; isEvent: (task: Task) => boolean;
  onSelectDate: (date: string) => void; onOpenDate: (date: string, tasks: Task[]) => void;
  onEditTask: (task: Task) => void; onMoveTask: (task: Task, date: string) => void;
  onAddTask: (date: string) => void; onDragActivate: () => void; onDragFinish: () => void;
  renderQuickAdd: (date: string) => ReactNode;
}) {
  const [focus, setFocus] = useState(selectedDate.slice(0, 7));
  const [pointerDropDate, setPointerDropDate] = useState("");
  const anchorRef = useRef<{ date: string; top: number } | null>(null);
  const monthDrag = useUnifiedDrag();
  const buckets = buildMonthTaskBuckets(tasks, schedules, new Set(weeks.flat()));
  const activeDrag = dragging || monthDrag.isDragging;

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const previous = anchorRef.current;
    if (previous) {
      anchorRef.current = null;
      const anchor = container.querySelector<HTMLElement>(`[data-week-anchor="${previous.date}"]`);
      if (anchor) container.scrollTop += anchor.getBoundingClientRect().top - previous.top;
      return;
    }
    const week = container.querySelector<HTMLElement>(`.df-month-cell[data-date="${selectedDate}"]`)?.closest<HTMLElement>("[data-week-anchor]");
    if (week) container.scrollTop = Math.max(0, container.scrollTop + week.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientHeight * 0.32);
    setFocus(selectedDate.slice(0, 7));
  }, [selectedDate, weeks, scrollRef]);

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
        const probeY = element.getBoundingClientRect().top + element.clientHeight * 0.35;
        const focused = Array.from(element.querySelectorAll<HTMLElement>(".df-month-cell[data-date]")).find((cell) => {
          const rect = cell.getBoundingClientRect(); return rect.top <= probeY && rect.bottom >= probeY;
        });
        if (focused?.dataset.date) setFocus(focused.dataset.date.slice(0, 7));
        if (!activeDrag && (element.scrollTop < 160 || element.scrollTop + element.clientHeight > element.scrollHeight - 160)) {
          const anchor = focused?.closest<HTMLElement>("[data-week-anchor]");
          if (anchor?.dataset.weekAnchor) anchorRef.current = { date: anchor.dataset.weekAnchor, top: anchor.getBoundingClientRect().top };
          onSelectDate(addIsoDays(selectedDate, element.scrollTop < 160 ? -140 : 140));
        }
      }}>
        {weeks.map((week) => <div key={week[0]} data-week-anchor={week[0]} className="df-month-week-row"
          style={{ height: 72 + Math.max(...week.map((date) => buckets.get(date)?.length || 0), 1) * ((compact ? 44 : 40) + 6) }}>
          {week.map((date) => {
            const dayTasks = buckets.get(date) || [];
            const dateObj = new Date(`${date}T00:00:00`);
            const open = () => { if (!activeDrag) onOpenDate(date, dayTasks); };
            return <div key={date} data-date={date} className={`df-month-cell${date.slice(0, 7) === focus ? " focus-month" : " muted"}${date === today ? " today" : ""}${activeDrag ? " drag-active" : ""}${(pointerDropDate || dropDate) === date ? " drag-hover" : ""}`}
              onClick={(event) => { if (!(event.target as HTMLElement).closest("button,input,.df-quick-add-input-box")) open(); }}>
              <div className="df-month-cell-header">
                <button type="button" className="df-month-cell-strong" aria-label={new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "full" }).format(dateObj)} aria-current={date === today ? "date" : undefined}
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
                      onDrop: (pointer) => { const date = dateAtPointer(pointer); if (date) onMoveTask(task, date); setPointerDropDate(""); onDragFinish(); },
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
    {monthDrag.overlay}
  </div>;
}
