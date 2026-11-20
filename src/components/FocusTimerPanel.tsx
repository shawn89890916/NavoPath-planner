import { useRef, useState } from "react";
import type { Language, Project, Task, WidgetTimerRuntime } from "../types";
import { canLinkPomodoroTask } from "../widget/widgetSchedule";
import { AnchoredNarrowMenu } from "./AnchoredNarrowMenu";
import { Button, IconButton, Input } from "./UiPrimitives";
import { UiChevronDownIcon, UiPlusIcon } from "./UiIcons";

type PomodoroControls = {
  runtime: WidgetTimerRuntime;
  started: boolean;
  longBreakEvery: number;
  taskChoice?: string;
  tasks: Task[];
  projects: Project[];
  onTaskChoice: (id?: string) => void;
  onCreateTask: () => Promise<void>;
  onEnd: () => void;
};

type FocusTimerPanelProps = {
  lang: Language;
  mode: string;
  modes: { mode: string; zh: string; en: string }[];
  onModeChange: (mode: string) => void;
  clock: string;
  note?: string;
  task?: Task | null;
  project?: Project;
  running: boolean;
  canStart: boolean;
  canSave: boolean;
  canReset: boolean;
  resuming: boolean;
  pomodoro?: PomodoroControls;
  onToggle: () => void;
  onSave: () => void;
  onReset: () => void;
};

function PomodoroTaskMenu({ lang, controls }: { lang: Language; controls: PomodoroControls }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);
  const zh = lang === "zh";
  const label = zh ? "选择专注任务" : "Choose focus task";
  const close = () => {
    setOpen(false);
    setSearch("");
  };
  const select = (id?: string) => {
    controls.onTaskChoice(id);
    close();
    anchorRef.current?.focus();
  };
  const query = search.trim().toLocaleLowerCase();
  const projects = new Map(controls.projects.map(project => [project.id, project.title]));
  const matches = open ? controls.tasks.filter(task => canLinkPomodoroTask(task) &&
    (!query || task.title.toLocaleLowerCase().includes(query) || projects.get(task.projectId || "")?.toLocaleLowerCase().includes(query))) : [];

  return <>
    <IconButton ref={anchorRef} icon={<UiChevronDownIcon />} label={label} aria-expanded={open} onClick={() => open ? close() : setOpen(true)} />
    <AnchoredNarrowMenu open={open} anchorRef={anchorRef} onClose={close} placement="below" label={label} focusOnOpen>
      <Button variant="ghost" aria-pressed={controls.taskChoice === undefined} onClick={() => select()}>
        {zh ? "自动关联当前任务" : "Auto-link current task"}
      </Button>
      <Button variant="ghost" onClick={() => {
        close();
        anchorRef.current?.focus();
        void controls.onCreateTask();
      }}><UiPlusIcon />{zh ? "添加任务" : "Add task"}</Button>
      <label>
        <Input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label={zh ? "搜索任务" : "Search tasks"} placeholder={zh ? "搜索任务" : "Search tasks"} />
      </label>
      {matches.map(task => (
        <Button key={task.id} variant="ghost" aria-pressed={controls.taskChoice === task.id} onClick={() => select(task.id)}>
          <span className="df-focus-menu-task">
            <span>{task.title}</span>
            {task.projectId && projects.get(task.projectId) && <small>{projects.get(task.projectId)}</small>}
          </span>
        </Button>
      ))}
      {matches.length === 0 && <p className="df-focus-menu-empty" role="status">{zh ? "没有匹配的任务" : "No matching tasks"}</p>}
    </AnchoredNarrowMenu>
  </>;
}

export function FocusTimerPanel({
  lang, mode, modes, onModeChange, clock, note, task, project, running, canStart, canSave, canReset, resuming, pomodoro, onToggle, onSave, onReset,
}: FocusTimerPanelProps) {
  const zh = lang === "zh";
  let status = note;
  let toggleLabel = running ? (zh ? "暂停" : "Pause") : resuming ? (zh ? "继续" : "Resume") : (zh ? "开始" : "Start");

  if (pomodoro) {
    const { runtime, started } = pomodoro;
    const resting = runtime.phase === "break";
    const overrun = runtime.phase === "overrun";
    const waitsForPhase = runtime.pausedAt === runtime.phaseStartedAt && !overrun;
    const plannedBreak = runtime.plan?.[runtime.phaseIndex ?? 0]?.type;
    const longBreak = plannedBreak ? plannedBreak === "long-break" : runtime.round % pomodoro.longBreakEvery === 0;
    status = resting ? (longBreak ? (zh ? "长休息" : "Long break") : (zh ? "短休息" : "Short break"))
      : overrun ? (zh ? "超时" : "Overtime")
      : (zh ? "专注 · 第 " + runtime.round + " 轮" : "Focus · Round " + runtime.round);
    if (started && !running && !waitsForPhase) status += zh ? " · 已暂停" : " · Paused";
    if (!running) {
      toggleLabel = !started || (waitsForPhase && !resting) ? (zh ? "开始专注" : "Start focus")
        : waitsForPhase ? (zh ? "开始休息" : "Start break") : (zh ? "继续" : "Resume");
    }
  }

  const canEndUnlinked = pomodoro?.started && pomodoro.runtime.unlinked;
  return <div className="df-focus-panel">
    <div className="df-focus-mode-switch ui-choice-list ui-choice-list--inline" role="group" aria-label={zh ? "计时模式" : "Timer mode"}>
      {modes.map(item => <Button key={item.mode} className="ui-choice-item" variant="ghost" aria-pressed={mode === item.mode} onClick={() => onModeChange(item.mode)}>{item[lang]}</Button>)}
    </div>
    <div className="df-focus-clock">
      <div className="df-focus-timer-display" role="timer">{clock}</div>
      {status && <div className="df-focus-mode-note" role="status">{status}</div>}
    </div>
    <div className="df-focus-controls">
      <Button variant="primary" onClick={onToggle} disabled={!canStart}>{toggleLabel}</Button>
      {canSave && <Button onClick={onSave}>{pomodoro ? (zh ? "结束并记录" : "End and log") : (zh ? "保存" : "Save")}</Button>}
      {canEndUnlinked && <Button onClick={pomodoro.onEnd}>{zh ? "结束计时" : "End timer"}</Button>}
      {canReset && !canEndUnlinked && <Button variant="ghost" onClick={onReset}>{zh ? "重置" : "Reset"}</Button>}
    </div>
    <div className="df-focus-task-row">
      <div className="df-focus-task-info">
        <span className="df-focus-task-label">{zh ? "关联任务" : "Linked task"}</span>
        <span className="df-focus-task-name">{task?.title || (zh ? "未关联任务" : "No linked task")}</span>
        {project && <span className="df-focus-task-project">{project.title}</span>}
      </div>
      {pomodoro && !pomodoro.started && <PomodoroTaskMenu lang={lang} controls={pomodoro} />}
    </div>
  </div>;
}
