import { createDragProjection } from "./motion/dragProjection";
import { rememberDragLanding } from "./motion/layout";
import "./PlanningView.css";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMotionPresence } from "./useMotionPresence";
import { useTaskLayoutMotion } from "./motion/useTaskLayoutMotion";
import { PLANNING_MOTION_SELECTOR } from "./motion/layout";
import type { PlannerData, Project, Settings, Subtask, Task, WorkflowStatus } from "./types";
import { t, type Language } from "./i18n";
import { useInAppDialog } from "./InAppDialog";
import { hasActiveTaskSchedule } from "./utils/timelineRecords";
import { localIsoDate } from "./utils/localDate";
import { highlightTaskLocation } from "./utils/highlightTaskLocation";
import { projectColorInk } from "./utils/presentationColor";
import { buildTaskMetaBadges } from "./utils/taskMetaBadges";
import { autoScrollAtDragEdge } from "./utils/dragAutoScroll";
import { kanbanGroups, WORKFLOW_LABELS } from "./utils/productivity";
import { normalizeTaskCheckTone, normalizeWorkflowStatus, workflowStatusForPatch, type UiWorkflowStatus, type StateFilterValue } from "./utils/productivityModel";
import { findSubtaskInTree, addSubtaskToTree, countSubtasks, countDoneSubtasks, canMoveTreeNode, treeDropPosition } from "./utils/treeOrder";
import { TaskActions, TaskBlockContent, TaskBlockDuration, TaskCheckbox, TaskSubtaskShelf } from "./components/TaskBlock";
import { EmptyState } from "./components/EmptyState";
import { Button, IconButton } from "./components/UiPrimitives";
import { UiCalendarCheckIcon, UiCheckIcon, UiFilterIcon } from "./components/UiIcons";
import { TaskDragLayer } from "./unifiedDrag";
import { bindHeldTouchScroll } from "./useUnifiedDrag";
import type { MetricCompletionFilter, MetricDisplayMetric, MetricGroupBy, MetricHabitMode, MetricRangePreset } from "./metrics/timeAllocation";
import type { MetricsQuery } from "./metrics/savedViews";
const MetricsInsights=React.lazy(()=>import("./metrics/MetricsInsights").then(m=>({default:m.MetricsInsights})));
import type { NativePlanningViewMode } from "./extensions/types";
import { CandidateSubtaskItem, CandidateTaskCard, categories, formatDuration, isEventDisplayTask } from "./WorkspacePresentation";

type TreeNodeKind = "project" | "task" | "subtask";
type TreeDragNode = { kind: TreeNodeKind; id: string };
type DropPosition = "before" | "inside" | "after";
type TreeDropTarget = TreeDragNode & { position: DropPosition; element: HTMLElement };

const DEFAULT_PROJECT_COLOR = "var(--accent-active)";
const DRAG_START_THRESHOLD_PX = 5;
const SUPPRESS_CLICK_AFTER_DRAG_MS = 220;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function todayIso() {
  return localIsoDate();
}

function truncate(text: string, max: number) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function alphaColor(color: string, alpha: number) {
  color = color.trim() || DEFAULT_PROJECT_COLOR;
  const hex = color;
  if (/^#([0-9a-f]{3}){1,2}$/i.test(hex)) {
    const value = hex.slice(1);
    const full = value.length === 3
      ? value.split("").map((ch) => ch + ch).join("")
      : value;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
}

function localDateTimeLabel(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isIncompletePlanningSubtask(subtask: Subtask) {
  return !subtask.completed && !subtask.done;
}

function createProjectShell(title: string): Project {
  return {
    id: "__unassigned__",
    title,
    category: "project",
    notes: "",
    completed: false,
    color: "#7B8191",
    createdAt: "",
    updatedAt: "",
  };
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? <path d="M4 6.5 8 10.5 12 6.5" /> : <path d="M6 4 10 8 6 12" />}
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}


function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <circle cx="3" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="13" cy="8" r="1.3" />
    </svg>
  );
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

function useTooltip() {
  const [tip, setTip] = useState<TooltipState | null>(null);

  const showTip = useCallback((text: string, target: HTMLElement) => {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    const rect = target.getBoundingClientRect();
    setTip({ text, x: rect.left + rect.width / 2, y: rect.top - 10 });
  }, []);

  const hideTip = useCallback(() => {
    tooltipTimer = setTimeout(() => setTip(null), 80);
  }, []);

  const tooltipEl = tip
    ? createPortal(
        <span className="df-tree-tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </span>,
        document.body,
      )
    : null;

  return { tooltipEl, showTip, hideTip };
}

function TreeMenu(props: {
  open: boolean;
  onClose: () => void;
  actions: Array<{ label: string; danger?: boolean; onClick: () => void }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const presence = useMotionPresence(props.open);

  useEffect(() => {
    if (!props.open) return;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current?.contains(event.target as Node) || triggerRef.current?.contains(event.target as Node)) return;
      props.onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      triggerRef.current?.focus();
      props.onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [props.open]);

  if (!presence.present) return null;
  return (
    <div className="df-tree-menu" data-motion-closing={presence.closing || undefined} inert={presence.closing} ref={ref} onClick={(event) => event.stopPropagation()}>
      {props.actions.map((action) => (
        <button
          key={action.label}
          className={action.danger ? "danger" : ""}
          onClick={() => {
            triggerRef.current?.focus();
            action.onClick();
            props.onClose();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function PlanningSubtaskNode(props: {
  demo?: boolean;
  lang: Language;
  subtask: Subtask;
  onToggle: (subtaskId: string) => void;
  onSchedule?: (subtaskId: string) => void;
  onRename: (subtaskId: string) => void;
  onSetDate: (subtaskId: string) => void;
  onMoveProject: (subtaskId: string) => void;
  onDelete: (subtaskId: string) => void;
  onAddSubtask: (parentId: string) => void;
  onDragStart: (event: React.PointerEvent, subtaskId: string) => void;
  draggingSubtaskId?: string;
}) {
  return (
    <CandidateSubtaskItem
      subtask={props.subtask}
      lang={props.lang}
      planningTree
      draggingSubtaskId={props.draggingSubtaskId}
      onToggleSubtask={props.onToggle}
      onSubtaskDragStart={props.onDragStart}
      renderTrailingAction={props.demo ? undefined : ({ subtask, menuOpen, toggleMenu }) => (
        <span className="df-plan-subtask-menu-anchor">
          <button
            type="button"
            className="df-candidate-subtask-toggle"
            onClick={(event) => {
              event.stopPropagation();
              event.currentTarget.focus();
              toggleMenu();
            }}
            aria-label={t(props.lang, "planning.more")}
          ><MoreIcon /></button>
          <TreeMenu
            open={menuOpen}
            onClose={toggleMenu}
            actions={[
              ...(props.onSchedule ? [{ label: props.lang === "zh" ? "安排" : "Schedule", onClick: () => props.onSchedule?.(subtask.id) }] : []),
              { label: t(props.lang, "planning.editName"), onClick: () => props.onRename(subtask.id) },
              { label: t(props.lang, "planning.addSubtask"), onClick: () => props.onAddSubtask(subtask.id) },
              { label: t(props.lang, "planning.setDate"), onClick: () => props.onSetDate(subtask.id) },
              { label: t(props.lang, "planning.moveToProject"), onClick: () => props.onMoveProject(subtask.id) },
              { label: t(props.lang, "planning.delete"), danger: true, onClick: () => props.onDelete(subtask.id) },
            ]}
          />
        </span>
      )}
    />
  );
}

function PlanningCandidateCard({ task, lang, meta, actions, onToggle, children, ...props }:
  Omit<React.ComponentPropsWithoutRef<typeof CandidateTaskCard>, "row"> & {
    meta?: React.ReactNode;
    actions?: React.ReactNode;
    onToggle?: () => void;
  }) {
  const isEvent = isEventDisplayTask(task);
  const done = !isEvent && normalizeWorkflowStatus(task) === "done";
  return <CandidateTaskCard {...props} task={task} lang={lang} checked={done} title={task.title} row={<>
    {isEvent ? <span className="df-task-block-check df-candidate-kind" aria-hidden="true" /> : <TaskCheckbox lang={lang} checked={done} tone={normalizeTaskCheckTone(task)} priority={task.priority}
      ariaLabel={t(lang || "en", done ? "planning.markIncomplete" : "planning.markComplete")}
      onClick={onToggle && ((event) => { event.stopPropagation(); onToggle(); })} />}
    <TaskBlockContent className="df-candidate-main" title={task.title}>{isEvent ? <span className="df-candidate-kind">EVENT</span> : meta}</TaskBlockContent>
    {!isEvent && <>
      <TaskBlockDuration>{task.estimatedHours !== 0 ? <span className="df-duration-pill">{formatDuration(task.estimatedHours || 0.5)}</span> : null}</TaskBlockDuration>
      {actions}
    </>}
  </>}>{children}</CandidateTaskCard>;
}

function PlanningTaskNode(props: {
  demo?: boolean;
  lang: Language;
  task: Task;
  projectColor: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpen: () => void;
  onSchedule?: () => void;
  onRename: () => void;
  onAddSubtask: () => void;
  onSetDate: () => void;
  onMoveProject: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  subtaskContent?: React.ReactNode;
  dragging?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasSubtasks = (props.task.subtasks || []).some(isIncompletePlanningSubtask);
  const doneCount = countDoneSubtasks(props.task.subtasks);
  const totalCount = countSubtasks(props.task.subtasks);
  const metaBadges = buildTaskMetaBadges(props.task, props.lang);

  return (
      <div
        className="df-plan-task-node"
        data-node-id={props.task.id}
        data-node-type="task"
        aria-grabbed={props.dragging}
        style={{ "--project-color": projectColorInk(props.projectColor), "--task-project-color": projectColorInk(props.projectColor) } as React.CSSProperties}
      >
        <PlanningCandidateCard
          as="div"
          task={props.task}
          lang={props.lang}
          projectColor={props.projectColor}
          className="df-task-node-inner"
          dragState={props.dragging ? "source-placeholder" : undefined}
          dataAttrs={{ "planning-drag-card": props.task.id }}
          ariaGrabbed={props.dragging}
          onClick={props.onOpen}
          onToggle={props.onToggleComplete}
          meta={metaBadges.length > 0 && <span className="df-task-meta-badges" aria-label="Task status">
            {metaBadges.map((badge) => <span key={badge.key} className={badge.className}>{badge.label}</span>)}
          </span>}
          actions={<TaskActions className="df-task-node-actions">
            {props.onSchedule && <IconButton className="df-tree-icon-button" icon={<UiCalendarCheckIcon size={16} />} label={props.lang === "zh" ? "安排" : "Schedule"} onClick={(event) => { event.stopPropagation(); props.onSchedule?.(); }} />}
            {!props.demo && <button className="df-tree-icon-button" onClick={(event) => {
              event.stopPropagation();
              event.currentTarget.focus();
              setMenuOpen((open) => !open);
            }} aria-label={t(props.lang, "planning.more")}><MoreIcon /></button>}
          </TaskActions>}
        >
          {hasSubtasks && <TaskSubtaskShelf
            label={props.lang === "zh" ? "子任务" : "Subtasks"}
            progress={`${doneCount}/${totalCount}`}
            expanded={!props.collapsed}
            expandLabel={t(props.lang, "planning.expandSubtasks")}
            collapseLabel={t(props.lang, "planning.collapseSubtasks")}
            onToggle={props.onToggleCollapse}
          />}
          {props.subtaskContent}
          <TreeMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            actions={[
              { label: t(props.lang, "planning.editName"), onClick: props.onRename },
              { label: t(props.lang, "planning.addSubtask"), onClick: props.onAddSubtask },
              { label: t(props.lang, "planning.setDate"), onClick: props.onSetDate },
              { label: t(props.lang, "planning.moveToProject"), onClick: props.onMoveProject },
              { label: t(props.lang, "planning.delete"), danger: true, onClick: props.onDelete },
            ]}
          />
        </PlanningCandidateCard>
      </div>
  );
}

function PlanningProjectNode(props: {
  demo?: boolean;
  lang: Language;
  project: Project;
  taskCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpen: () => void;
  onAddTask: () => void;
  onComplete?: () => void;
  dragging?: boolean;
}) {
  const { tooltipEl, showTip, hideTip } = useTooltip();
  const titleRef = useRef<HTMLSpanElement>(null);
  const color = props.project.color || DEFAULT_PROJECT_COLOR;

  return (
    <>
      {tooltipEl}
      <div
        className={`df-plan-project-node ${props.collapsed ? "collapsed" : ""}${props.dragging ? " is-dragging-source" : ""}`}
        data-node-id={props.project.id}
        data-node-type="project"
        data-planning-drag-card={props.project.id}
        aria-grabbed={props.dragging}
        style={{
          "--project-color": projectColorInk(color),
          "--project-color-soft": alphaColor(projectColorInk(color), 0.16),
          "--project-color-border": alphaColor(projectColorInk(color), 0.34),
        } as React.CSSProperties}
      >
        <span
          className="df-project-name"
          ref={titleRef}
          onClick={props.onOpen}
          onMouseEnter={() => {
            if (titleRef.current && titleRef.current.scrollWidth > titleRef.current.clientWidth) {
              showTip(props.project.title, titleRef.current);
            }
          }}
          onMouseLeave={hideTip}
        >
          {props.project.title}
        </span>
        <span className="df-project-badge">{props.taskCount}</span>
        <div className="df-project-node-actions">
          {props.onComplete && !props.project.completed && (
            <button
              className="df-tree-icon-button df-project-complete-btn"
              onClick={(event) => {
                event.stopPropagation();
                props.onComplete?.();
              }}
              aria-label={props.lang === "zh" ? "完成项目" : "Complete project"}
            >
              <UiCheckIcon size={12} strokeWidth={4.4} />
            </button>
          )}
          {!props.demo && <button className="df-tree-icon-button df-project-add-btn" onClick={props.onAddTask} aria-label={t(props.lang, "planning.addTask")}>
            <PlusIcon />
          </button>}
          <button className="df-tree-icon-button df-collapse-btn" onClick={props.onToggleCollapse} aria-label={props.collapsed ? t(props.lang, "planning.expandProject") : t(props.lang, "planning.collapseProject")}>
            <ChevronIcon open={!props.collapsed} />
          </button>
        </div>
      </div>
    </>
  );
}

function useTreeLines(
  treeRef: React.RefObject<HTMLDivElement | null>,
  projects: Project[],
  tasks: Task[],
  collapsedProjects: Record<string, boolean>,
  collapsedSubtasks: Record<string, boolean>,
) {
  const [lines, setLines] = useState<React.ReactNode>(null);

  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;

    let frame = 0;
    const render = () => {
      const treeRect = tree.getBoundingClientRect();
      const paths: React.ReactNode[] = [];

      projects.forEach((project) => {
        if (collapsedProjects[project.id]) return;

        const projectEl = tree.querySelector(
          `[data-node-id="${CSS.escape(project.id)}"][data-node-type="project"]`,
        ) as HTMLElement | null;
        if (!projectEl) return;

        const projectRect = projectEl.getBoundingClientRect();
        const projectColor = project.color || DEFAULT_PROJECT_COLOR;
        const projectTaskList = tasks.filter(
          (t) => String(t.projectId || "") === String(project.id) && !t.completed,
        );
        if (projectTaskList.length === 0) return;

        // Simplified tree lines: subtle, minimal.
        // Collect task positions
        const taskPositions: Array<{
          id: string;
          top: number;
          bottom: number;
          centerY: number;
          left: number;
        }> = [];

        projectTaskList.forEach((task) => {
          const taskEl = tree.querySelector(
            `[data-node-id="${CSS.escape(task.id)}"][data-node-type="task"]`,
          ) as HTMLElement | null;
          if (!taskEl) return;
          const r = taskEl.getBoundingClientRect();
          taskPositions.push({
            id: task.id,
            top: r.top - treeRect.top,
            bottom: r.bottom - treeRect.top,
            centerY: r.top + r.height / 2 - treeRect.top,
            left: r.left - treeRect.left,
          });
        });

        if (taskPositions.length === 0) return;

        // Trunk x-position relative to tree: 28px indent from project left.
        const trunkX = 28;
        const projBottom = projectRect.bottom - treeRect.top;

        const firstCenterY = Math.min(...taskPositions.map((t) => t.centerY));
        const lastCenterY = Math.max(...taskPositions.map((t) => t.centerY));

        const colMain = alphaColor(projectColor, 0.08);
        const colBranch = alphaColor(projectColor, 0.05);

        // 1. Trunk: short vertical from project bottom to first task.
        paths.push(
          <path
            key={`trunk-${project.id}`}
            d={`M ${trunkX} ${projBottom + 8} L ${trunkX} ${firstCenterY}`}
            className="df-tree-line trunk"
            style={{ stroke: colMain }}
          />,
        );

        // 2. Vertical trunk connecting multiple tasks
        if (taskPositions.length > 1) {
          paths.push(
            <path
              key={`vtrunk-${project.id}`}
              d={`M ${trunkX} ${firstCenterY} L ${trunkX} ${lastCenterY}`}
              className="df-tree-line trunk"
              style={{ stroke: colMain }}
            />,
          );
        }

        // 3. Horizontal branches from trunk to each task (elbow connectors)
        taskPositions.forEach((tp) => {
          const endX = tp.left - 8;
          if (endX > trunkX + 8) {
            paths.push(
              <path
                key={`branch-${project.id}-${tp.id}`}
                d={`M ${trunkX} ${tp.centerY} L ${endX} ${tp.centerY}`}
                className="df-tree-line branch"
                style={{ stroke: colBranch }}
              />,
            );
          }
        });

        // 4. Subtask connectors (very subtle)
        projectTaskList.forEach((task) => {
          if (collapsedSubtasks[task.id]) return;
          const subs = task.subtasks || [];
          if (subs.length === 0) return;

          const subPositions: Array<{
            id: string;
            centerY: number;
            left: number;
          }> = [];

          subs.forEach((sub) => {
            const subEl = tree.querySelector(
              `[data-node-id="${CSS.escape(sub.id)}"][data-node-type="subtask"]`,
            ) as HTMLElement | null;
            if (!subEl) return;
            const r = subEl.getBoundingClientRect();
            subPositions.push({
              id: sub.id,
              centerY: r.top + r.height / 2 - treeRect.top,
              left: r.left - treeRect.left,
            });
          });

          if (subPositions.length === 0) return;

          const taskPos = taskPositions.find((tp) => tp.id === task.id);
          if (!taskPos) return;

          const subTrunkX = taskPos.left + 18;
          const taskBottom = taskPos.bottom;
          const subFirstCenterY = Math.min(...subPositions.map((s) => s.centerY));

          // Short drop line from task bottom to first subtask
          paths.push(
            <path
              key={`sub-conn-${task.id}`}
              d={`M ${subTrunkX} ${taskBottom + 4} L ${subTrunkX} ${subFirstCenterY}`}
              className="df-tree-line subtask-line"
              style={{ stroke: alphaColor(projectColor, 0.05) }}
            />,
          );
        });
      });

      setLines(
        <svg
          className="df-tree-svg"
          style={{ width: Math.max(tree.scrollWidth, 1), height: Math.max(tree.scrollHeight, 1) }}
        >
          {paths}
        </svg>,
      );
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(tree);
    tree.querySelectorAll("[data-node-type]").forEach((el) => ro.observe(el));
    tree.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      tree.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [projects, tasks, collapsedProjects, collapsedSubtasks, treeRef]);

  return lines;
}

export type PlanningViewSession = {
  collapsedSubtasks: Record<string, boolean>;
  includeCompleted: boolean;
  filterProjects: string[];
  filterWorkflows: UiWorkflowStatus[];
  filterImportances: StateFilterValue[];
  filterUrgencies: StateFilterValue[];
  filterDueDate: "overdue" | "this-week" | "no-date" | null;
  filterScheduled: "scheduled" | "unscheduled" | null;
  scrollTop: number;
};

export default function PlanningView(props: {
  analyticsScope?: string;
  weekStartsOn?: 0|1;
  session?: React.RefObject<PlanningViewSession | null>;
  focusTaskId?: string | null;
  onFocusHandled?: () => void;
  presentationNote?: React.ReactNode;
  demo?: boolean;
  lang: Language;
  referenceDate?: string;
  viewMode: NativePlanningViewMode;
  filterAnchor?: HTMLElement | null;
  onScheduleTask?: (task: Task) => void;
  onScheduleSubtask?: (task: Task, subtaskId: string) => void;
  onTouchScheduleDrag?: (event: React.PointerEvent, task: Task, subtaskId?: string) => void;
  onTimelineDrag?: (task: Task, point: { x: number; y: number } | null, subtaskId?: string) => void;
  showCompleted?: boolean;
  onTimelineDrop?: (task: Task, point: { x: number; y: number }, subtaskId?: string) => boolean;
  data: PlannerData;
  projects: Project[];
  tasks: Task[];
  compact: boolean;
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onProjectEdit: (project: Project) => void;
  onProjectComplete?: (projectId: string) => void;
  onTaskEdit: (task: Task) => void;
  onTaskUpdate: (taskId: string, patch: Partial<Task>) => void;
  onTaskCreate: (projectId: string) => void;
  onProjectCreate?: () => void;
  onOpenTimeline?: () => void;
  onTaskDelete: (taskId: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
  onDataChange: (data: PlannerData) => void;
  onTreeMove: (source: TreeDragNode, target: Omit<TreeDropTarget, "element">) => void;
  engagementEnabled?: boolean;
  dayStartTime?: string;
  metricsRangePreset?: MetricRangePreset;
  metricsGroupBy?: MetricGroupBy;
  metricsDisplayMetric?: MetricDisplayMetric;
  metricsIncludeHabits?: MetricHabitMode;
  metricsCompletionFilter?: MetricCompletionFilter;
  metricsCustomStart?: string;
  metricsCustomEnd?: string;
  onMetricsSettingsChange?: (patch: Partial<Settings>) => void;
}) {
  const safeProjects = Array.isArray(props.projects) ? props.projects : [];
  const safeTasks = Array.isArray(props.tasks) ? props.tasks : [];
  const { session } = props;
  const [collapsedSubtasks, setCollapsedSubtasks] = useState<Record<string, boolean>>(() => session?.current?.collapsedSubtasks ?? {});
  const [dragNode, setDragNode] = useState<TreeDragNode | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const releaseDragRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => () => releaseDragRef.current?.(), []);
  const dialog = useInAppDialog(props.lang);
  const { viewMode } = props;
  const [metricsRangePreset, setMetricsRangePreset] = useState<MetricRangePreset>(props.metricsRangePreset || "today");
  const [metricsGroupBy, setMetricsGroupBy] = useState<MetricGroupBy>(props.metricsGroupBy || "project");
  const [metricsDisplayMetric, setMetricsDisplayMetric] = useState<MetricDisplayMetric>(props.metricsDisplayMetric || "percentage");
  const [metricsHabitMode, setMetricsHabitMode] = useState<MetricHabitMode>(props.metricsIncludeHabits || "include");
  const [metricsCompletion, setMetricsCompletion] = useState<MetricCompletionFilter>(props.metricsCompletionFilter || "all");
  const [metricsCustomStart, setMetricsCustomStart] = useState(props.metricsCustomStart || todayIso());
  const [metricsCustomEnd, setMetricsCustomEnd] = useState(props.metricsCustomEnd || todayIso());
  const [metricsFilterOpen, setMetricsFilterOpen] = useState(false);
  const [metricsFilterCategory, setMetricsFilterCategory] = useState<"range" | "group" | "habit" | "completion" | "metric" | "project">("range");
  const [metricsProjectFilter, setMetricsProjectFilter] = useState<string[]>([]);
  const [includeCompleted, setIncludeCompleted] = useState(() => session?.current?.includeCompleted ?? false);
  const [filterProjects, setFilterProjects] = useState<string[]>(() => session?.current?.filterProjects ?? []);
  const [filterWorkflows, setFilterWorkflows] = useState<UiWorkflowStatus[]>(() => session?.current?.filterWorkflows ?? []);
  const [filterImportances, setFilterImportances] = useState<StateFilterValue[]>(() => session?.current?.filterImportances ?? []);
  const [filterUrgencies, setFilterUrgencies] = useState<StateFilterValue[]>(() => session?.current?.filterUrgencies ?? []);
  const [filterOpen, setFilterOpen] = useState(false);
  useEffect(() => {
    if (!filterOpen || !props.filterAnchor) return;
    const anchor = props.filterAnchor;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.contains(event.target)) setFilterOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFilterOpen(false);
      anchor.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [filterOpen, props.filterAnchor]);
  const [filterExpandedCategory, setFilterExpandedCategory] = useState<string | null>(null);
  const [filterDueDate, setFilterDueDate] = useState<PlanningViewSession["filterDueDate"]>(() => session?.current?.filterDueDate ?? null);
  const [filterScheduled, setFilterScheduled] = useState<PlanningViewSession["filterScheduled"]>(() => session?.current?.filterScheduled ?? null);
  useLayoutEffect(() => {
    if (!session) return;
    session.current = { collapsedSubtasks, includeCompleted, filterProjects, filterWorkflows, filterImportances, filterUrgencies,
      filterDueDate, filterScheduled, scrollTop: session.current?.scrollTop ?? 0 };
  }, [session, collapsedSubtasks, includeCompleted, filterProjects, filterWorkflows, filterImportances, filterUrgencies, filterDueDate, filterScheduled]);
  useLayoutEffect(() => {
    const scroll = viewRef.current?.closest<HTMLElement>("[data-shelf-scroll]");
    if (!session?.current || !scroll) return;
    scroll.scrollTop = session.current.scrollTop;
    const saveScroll = () => { if (session.current) session.current.scrollTop = scroll.scrollTop; };
    scroll.addEventListener("scroll", saveScroll, { passive: true });
    return () => scroll.removeEventListener("scroll", saveScroll);
  }, [session]);
  const [planningDragTask, setPlanningDragTask] = useState<{
    task: Task;
    sourceRect: { width: number; height: number };
    offset: { x: number; y: number };
    pointer: { x: number; y: number };
  } | null>(null);
  useTaskLayoutMotion({
    root: () => viewRef.current,
    selector: PLANNING_MOTION_SELECTOR,
    scope: viewMode,
    revision: [props.data, props.collapsed, collapsedSubtasks, includeCompleted, props.showCompleted, filterProjects, filterWorkflows, filterImportances, filterUrgencies, filterDueDate, filterScheduled],
    blocked: Boolean(dragNode || planningDragTask),
  });
  const suppressClickUntilRef = useRef(0);

  const suppressPostDragClick = useCallback(() => {
    suppressClickUntilRef.current = Date.now() + SUPPRESS_CLICK_AFTER_DRAG_MS;
  }, []);

  const shouldSuppressTaskClick = useCallback(() => Date.now() < suppressClickUntilRef.current, []);

  const openTaskFromPlanning = useCallback((task: Task) => {
    if (shouldSuppressTaskClick()) return;
    props.onTaskEdit(task);
  }, [props, shouldSuppressTaskClick]);

  const today = props.referenceDate || todayIso();

  useEffect(() => setMetricsRangePreset(props.metricsRangePreset || "today"), [props.metricsRangePreset]);
  useEffect(() => setMetricsGroupBy(props.metricsGroupBy || "project"), [props.metricsGroupBy]);
  useEffect(() => setMetricsDisplayMetric(props.metricsDisplayMetric || "percentage"), [props.metricsDisplayMetric]);
  useEffect(() => setMetricsHabitMode(props.metricsIncludeHabits || "include"), [props.metricsIncludeHabits]);
  useEffect(() => setMetricsCompletion(props.metricsCompletionFilter || "all"), [props.metricsCompletionFilter]);
  useEffect(() => setMetricsCustomStart(props.metricsCustomStart || todayIso()), [props.metricsCustomStart]);
  useEffect(() => setMetricsCustomEnd(props.metricsCustomEnd || todayIso()), [props.metricsCustomEnd]);

  const renameTask = useCallback(async (task: Task) => {
    const title = await dialog.prompt(t(props.lang, "planning.editName"), task.title);
    if (!title?.trim()) return;
    props.onTaskUpdate(task.id, { title: title.trim() });
  }, [dialog, props]);

  const addSubtask = useCallback(async (task: Task, parentId?: string) => {
    const title = await dialog.prompt(t(props.lang, "planning.addSubtask"));
    if (!title?.trim()) return;
    const nextSubtask: Subtask = {
      id: uid("subtask"),
      title: title.trim(),
      completed: false,
      done: false,
      order: Date.now(),
      subtasks: [],
      createdAt: new Date().toISOString(),
    };
    props.onTaskUpdate(task.id, {
      subtasks: addSubtaskToTree(task.subtasks || [], nextSubtask, parentId),
    });
  }, [dialog, props]);

  const setTaskDate = useCallback(async (task: Task) => {
    const date = await dialog.prompt(props.lang === "zh" ? "Set date YYYY-MM-DD" : "Set date YYYY-MM-DD", task.dueDate || todayIso());
    if (!date?.trim()) return;
    props.onTaskUpdate(task.id, { dueDate: date.trim() });
  }, [dialog, props]);

  const moveTaskProject = useCallback(async (task: Task) => {
    const options = safeProjects.map((project, index) => `${index + 1}. ${project.title}`).join("\n");
    const choice = await dialog.prompt(
      props.lang === "zh" ? "Move to project" : "Move to project",
      "0",
      { message: `0. ${t(props.lang, "planning.unassigned")}${options ? `\n${options}` : ""}` },
    );
    if (choice === null) return;
    const index = Number(choice) - 1;
    props.onTaskUpdate(task.id, { projectId: index >= 0 ? safeProjects[index]?.id : undefined });
  }, [dialog, props, safeProjects]);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    const task = safeTasks.find((item) => item.id === taskId);
    if (!task) return;
    const toggleRecursive = (subtasks: Subtask[]): Subtask[] =>
      subtasks.map((subtask) =>
        subtask.id === subtaskId
          ? { ...subtask, completed: !(subtask.completed || subtask.done), done: !(subtask.completed || subtask.done) }
          : { ...subtask, subtasks: subtask.subtasks ? toggleRecursive(subtask.subtasks) : subtask.subtasks }
      );
    props.onTaskUpdate(taskId, { subtasks: toggleRecursive(task.subtasks || []) });
  }, [props, safeTasks]);

  const renameSubtask = useCallback(async (subtaskId: string) => {
    const title = await dialog.prompt(t(props.lang, "planning.editName"));
    if (!title?.trim()) return;
    for (const task of safeTasks) {
      if (findSubtaskInTree(task.subtasks || [], subtaskId)) {
        const recurse = (subtasks: Subtask[]): Subtask[] =>
          subtasks.map((s) =>
            s.id === subtaskId ? { ...s, title: title.trim() } : { ...s, subtasks: s.subtasks ? recurse(s.subtasks) : s.subtasks }
          );
        props.onTaskUpdate(task.id, { subtasks: recurse(task.subtasks || []) });
        return;
      }
    }
  }, [dialog, safeTasks, props]);

  const deleteSubtask = useCallback(async (subtaskId: string) => {
    const confirmed = await dialog.confirm(props.lang === "zh" ? "Delete this subtask?" : "Delete this subtask?");
    if (!confirmed) return;
    props.onDeleteSubtask(subtaskId);
  }, [dialog, props]);

  const setSubtaskDate = useCallback(async (subtaskId: string) => {
    for (const task of safeTasks) {
      const subtask = findSubtaskInTree(task.subtasks || [], subtaskId);
      if (subtask) {
        const date = await dialog.prompt(props.lang === "zh" ? "Set date YYYY-MM-DD" : "Set date YYYY-MM-DD", task.dueDate || todayIso());
        if (!date?.trim()) return;
        const updateRecursive = (subtasks: Subtask[]): Subtask[] => subtasks.map((item) =>
          item.id === subtaskId
            ? { ...item, title: `${item.title} ? ${date.trim()}` }
            : { ...item, subtasks: item.subtasks ? updateRecursive(item.subtasks) : item.subtasks },
        );
        props.onTaskUpdate(task.id, { subtasks: updateRecursive(task.subtasks || []) });
        return;
      }
    }
  }, [dialog, safeTasks, props]);

  const moveSubtaskProject = useCallback(async (subtaskId: string) => {
    for (const task of safeTasks) {
      if (findSubtaskInTree(task.subtasks || [], subtaskId)) {
        const options = safeProjects.map((p, i) => `${i + 1}. ${p.title}`).join("\n");
        const choice = await dialog.prompt(
          props.lang === "zh"
            ? "\u5c06\u7236\u4efb\u52a1\u79fb\u5230\u54ea\u4e2a\u9879\u76ee\uff1f"
            : "Move parent task to project",
          "0",
          { message: `0. ${t(props.lang, "planning.unassigned")}${options ? `\n${options}` : ""}` },
        );
        if (choice === null) return;
        const index = Number(choice) - 1;
        props.onTaskUpdate(task.id, { projectId: index >= 0 ? safeProjects[index]?.id : undefined });
        return;
      }
    }
  }, [dialog, safeTasks, safeProjects, props]);

  const subtaskOwner = useCallback((subtaskId: string) =>
    safeTasks.find((task) => findSubtaskInTree(task.subtasks || [], subtaskId)), [safeTasks]);

  const taskFromSubtask = useCallback((subtask: Subtask, projectId?: string): Task => ({
    id: uid("task"),
    title: subtask.title,
    dueDate: today,
    category: "personal",
    priority: "medium",
    notes: "",
    goalId: "",
    completed: Boolean(subtask.completed || subtask.done),
    projectId,
    order: Date.now(),
    subtasks: subtask.subtasks || [],
    timelineRecords: [],
    createdAt: subtask.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [today]);

  const viewFilteredTasks = useMemo(() => {
    return safeTasks.filter((task) => {
      if ((viewMode === "tree" || viewMode === "list") && !includeCompleted && task.completed && task.id !== props.focusTaskId) return false;
      if (filterProjects.length > 0 && !filterProjects.includes(String(task.projectId || ""))) return false;
      const uiStatus = normalizeWorkflowStatus(task);
      if (filterWorkflows.length > 0 && !filterWorkflows.includes(uiStatus)) return false;
      if (filterImportances.length > 0) {
        const imp = task.importance || null;
        const matches = filterImportances.some((f) => f === "empty" ? !imp : imp === f);
        if (!matches) return false;
      }
      if (filterUrgencies.length > 0) {
        const urg = task.urgency || null;
        const matches = filterUrgencies.some((f) => f === "empty" ? !urg : urg === f);
        if (!matches) return false;
      }
      if (filterDueDate) {
        const due = task.dueDate;
        if (filterDueDate === "no-date") { if (due) return false; }
        else if (filterDueDate === "overdue") { if (!due || due >= today) return false; }
        else if (filterDueDate === "this-week") {
          if (!due) return false;
          const dueTime = new Date(due + "T00:00:00").getTime();
          const now = new Date(today + "T00:00:00").getTime();
          if (dueTime < now || dueTime > now + 6 * 86400000) return false;
        }
      }
      if (filterScheduled) {
        const hasSchedule = hasActiveTaskSchedule(task);
        if (filterScheduled === "scheduled" && !hasSchedule) return false;
        if (filterScheduled === "unscheduled" && hasSchedule) return false;
      }
      return true;
    });
  }, [safeTasks, filterProjects, filterWorkflows, filterImportances, filterUrgencies, filterDueDate, filterScheduled, viewMode, includeCompleted, props.focusTaskId]);
  const orderPlanningTasks = useCallback((items: Task[]) => {
    return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt));
  }, []);

  const visibleProjects = useMemo(
    () => safeProjects
      .map((project) => ({
        project,
        tasks: viewFilteredTasks.filter((task) => String(task.projectId || "") === String(project.id)),
      }))
      .filter(({ project }) => filterProjects.length === 0 || filterProjects.includes(String(project.id))),
    [safeProjects, viewFilteredTasks, filterProjects],
  );
  const unassigned = useMemo(
    () => viewFilteredTasks.filter((task) => task && !task.projectId),
    [viewFilteredTasks],
  );

  const svgLines = useTreeLines(treeRef, safeProjects, viewFilteredTasks, props.collapsed, collapsedSubtasks);

  // This entry note stays dismissed after the user closes it.

  const renderTaskSubtasks = (task: Task) => {
    if (collapsedSubtasks[task.id] || !(task.subtasks || []).some(isIncompletePlanningSubtask)) return null;
    return (
      <div className="df-candidate-subtasks df-plan-subtask-list" data-parent-id={task.id}>
        {(task.subtasks || []).filter(isIncompletePlanningSubtask).map((subtask) => (
          <React.Fragment key={subtask.id}>
            <PlanningSubtaskNode
              demo={props.demo}
              lang={props.lang}
              subtask={subtask}
              onToggle={(subtaskId) => toggleSubtask(task.id, subtaskId)}
              onSchedule={props.onScheduleSubtask ? (subtaskId) => props.onScheduleSubtask?.(task, subtaskId) : undefined}
              onRename={renameSubtask}
              onSetDate={setSubtaskDate}
              onMoveProject={moveSubtaskProject}
              onDelete={deleteSubtask}
              onAddSubtask={(parentId) => addSubtask(task, parentId)}
              draggingSubtaskId={dragNode?.kind === "subtask" ? dragNode.id : undefined}
              onDragStart={(event, subtaskId) => {
                if (event.pointerType === "touch" && props.onTouchScheduleDrag) props.onTouchScheduleDrag(event, task, subtaskId);
                else beginTreeDrag(event, { kind: "subtask", id: subtaskId });
              }}
            />
          </React.Fragment>
        ))}
      </div>
    );
  };

  const projectColor = useCallback((projectId?: string) => {
    if (!projectId) return DEFAULT_PROJECT_COLOR;
    const project = safeProjects.find((p) => String(p.id) === String(projectId));
    return project?.color || DEFAULT_PROJECT_COLOR;
  }, [safeProjects]);

  const projectName = useCallback((projectId?: string) => {
    if (!projectId) return (props.lang === "zh" ? "Unassigned" : "Unassigned");
    const project = safeProjects.find((p) => String(p.id) === String(projectId));
    return project?.title || (props.lang === "zh" ? "Unassigned" : "Unassigned");
  }, [safeProjects, props.lang]);

  const reorderPlanningTasks = useCallback((dragId: string, targetTaskId: string, position: "before" | "after", sequence: Task[]) => {
    if (!dragId || dragId === targetTaskId) {
      return;
    }
    const ordered = [...sequence].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt));
    const dragged = ordered.find((t) => t.id === dragId);
    if (!dragged) return;
    const without = ordered.filter((t) => t.id !== dragId);
    const targetIdx = without.findIndex((t) => t.id === targetTaskId);
    if (targetIdx < 0) {
      return;
    }
    const insertAt = position === "before" ? targetIdx : targetIdx + 1;
    without.splice(insertAt, 0, dragged);
    const nextOrder = new Map(without.map((task, idx) => [task.id, idx * 10]));
    const now = new Date().toISOString();
    props.onDataChange({
      ...props.data,
      tasks: props.data.tasks.map((task) => (
        nextOrder.has(task.id)
          ? { ...task, order: nextOrder.get(task.id), updatedAt: now }
          : task
      )),
    });
  }, [props]);

  const kanbanStatus = (task: Task) => normalizeWorkflowStatus(task) === "done" ? "done" : "backlog";
  const matrixQuadrant = (task: Task) => task.importance === "high"
    ? task.urgency === "high" ? "q1" : "q2"
    : task.urgency === "high" ? "q3" : "q4";
  const planningContainer = (task: Task) => viewMode === "list" ? "list" : viewMode === "kanban" ? kanbanStatus(task) : matrixQuadrant(task);

  const beginPlanningDrag = (event: React.PointerEvent, task: Task) => {
    if (event.button !== 0 || isEventDisplayTask(task)) return;
    if (event.pointerType === "touch" && props.onTouchScheduleDrag) {
      props.onTouchScheduleDrag(event, task);
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a,[contenteditable='true']")) return;
    const dragElement = event.currentTarget as HTMLElement;
    const surface = dragElement.closest(".df-shelf-view");
    const scroll = dragElement.closest<HTMLElement>("[data-shelf-scroll]");
    const sourceContainer = planningContainer(task);
    let marker: HTMLElement | undefined;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let holdReady = !(props.compact && event.pointerType === "touch");
    let holdCancelled = false;
    const holdTimer = holdReady ? undefined : window.setTimeout(() => {
      holdReady = true;
      dragElement.classList.add("is-drag-armed");
      window.navigator.vibrate?.(8);
    }, 260);

    const releaseHeldTouch = event.pointerType === "touch"
      ? bindHeldTouchScroll(dragElement, () => holdReady && !holdCancelled)
      : undefined;
    let projection: ReturnType<typeof createDragProjection> | undefined;
    const cleanup = () => {
      projection?.close();
      window.removeEventListener("blur", cancel);
      if (releaseDragRef.current === cleanup) releaseDragRef.current = null;
      releaseHeldTouch?.();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      document.body.classList.remove("df-unified-dragging");
      dragElement.classList.remove("is-dragging-source", "is-drag-armed");
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      if (active) props.onTimelineDrag?.(task, null);
      marker?.removeAttribute("data-planning-drop");
      setPlanningDragTask(null);
      if (dragElement.hasPointerCapture(pointerId)) {
        try { dragElement.releasePointerCapture(pointerId); } catch { /* ignore */ }
      }
    };

    const readDropTarget = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !surface?.contains(hit)) return;
      const group = hit.closest<HTMLElement>("[data-planning-group]");
      if (!group) return;
      const container = group.dataset.planningGroup!;
      const card = hit.closest<HTMLElement>("[data-planning-task-id]");
      if (card?.dataset.planningTaskId === task.id || card?.dataset.kind === "event") return;
      if (!card || sourceContainer !== container) return { container, element: group, position: "inside" as const };
      const rect = card.getBoundingClientRect();
      return { container, element: card, taskId: card.dataset.planningTaskId,
        position: y < rect.top + rect.height / 2 ? "before" as const : "after" as const };
    };
    const getDropTarget = (x: number, y: number) => projection ? projection.logical(() => readDropTarget(x, y)) : readDropTarget(x, y);

    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      const distance = Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY);
      if (!holdReady) {
        if (distance >= 9) {
          holdCancelled = true;
          if (holdTimer !== undefined) window.clearTimeout(holdTimer);
          dragElement.classList.remove("is-drag-armed");
        }
        return;
      }
      if (holdCancelled) return;
      if (!active && distance < DRAG_START_THRESHOLD_PX) return;
      if (!active) {
        active = true;
        pointerEvent.preventDefault();
        try { dragElement.setPointerCapture(pointerId); } catch { /* ignore */ }
        document.body.classList.add("df-unified-dragging");
        dragElement.classList.add("is-dragging-source");
        projection = createDragProjection(dragElement);
        const rect = dragElement.getBoundingClientRect();
        const offX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        const offY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
        setPlanningDragTask({ task, sourceRect: { width: rect.width, height: rect.height }, offset: { x: offX, y: offY }, pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY } });
      }
      pointerEvent.preventDefault();
      setPlanningDragTask((current) => current ? { ...current, pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY } } : current);
      const { clientX, clientY } = pointerEvent;
      autoScrollAtDragEdge(clientX, clientY, [scroll]);
      const drop = getDropTarget(clientX, clientY);
      if (marker !== drop?.element) marker?.removeAttribute("data-planning-drop");
      marker = drop?.element;
      if (drop) drop.element.dataset.planningDrop = drop.position;
      projection?.update(drop?.element, drop?.position);
      props.onTimelineDrag?.(task, { x: pointerEvent.clientX, y: pointerEvent.clientY });
    };

    const up = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      if (active) {
        suppressPostDragClick();
        if (props.onTimelineDrop?.(task, { x: pointerEvent.clientX, y: pointerEvent.clientY })) {
          rememberDragLanding(task.id, "schedule");
          cleanup();
          return;
        }
        const drop = getDropTarget(pointerEvent.clientX, pointerEvent.clientY);
        if (drop?.container === sourceContainer) {
          const sequence = viewFilteredTasks.filter((item) => !isEventDisplayTask(item) && planningContainer(item) === sourceContainer);
          const targetId = drop.taskId || orderPlanningTasks(sequence).filter((item) => item.id !== task.id).at(-1)?.id;
          if (targetId) { rememberDragLanding(task.id, "planning"); reorderPlanningTasks(task.id, targetId, drop.position === "before" ? "before" : "after", sequence); }
        } else if (drop && viewMode !== "list") {
          rememberDragLanding(task.id, "planning");
          if (viewMode === "kanban") {
            props.onTaskUpdate(task.id, workflowStatusForPatch(drop.container === "done" ? "done" : "backlog"));
          } else {
            props.onTaskUpdate(task.id, {
              importance: drop.container === "q1" || drop.container === "q2" ? "high" : "low",
              urgency: drop.container === "q1" || drop.container === "q3" ? "high" : "low",
            });
          }
        }
      }
      cleanup();
    };

    const cancel = () => cleanup();
    const keydown = (kb: KeyboardEvent) => { if (kb.key === "Escape") cancel(); };

    releaseDragRef.current?.();
    releaseDragRef.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
    window.addEventListener("blur", cancel);
  };

  const beginTreeDrag = useCallback((event: React.PointerEvent, node: TreeDragNode) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a,[contenteditable='true']")) return;
    const sourceNodeEl = target.closest<HTMLElement>("[data-node-type][data-node-id]");
    if (!sourceNodeEl || node.id === "__unassigned__") return;
    const sourceNode = node;
    const tree = treeRef.current;
    const scroll = tree?.closest<HTMLElement>("[data-shelf-scroll]") || tree?.parentElement;
    const task = sourceNode.kind === "task" ? safeTasks.find((item) => item.id === sourceNode.id)
      : sourceNode.kind === "subtask" ? subtaskOwner(sourceNode.id) : undefined;
    const subtaskId = sourceNode.kind === "subtask" ? sourceNode.id : undefined;
    const subtask = subtaskId && task ? findSubtaskInTree(task.subtasks || [], subtaskId) : undefined;
    let marker: HTMLElement | undefined;
    let expandTimer: number | undefined;
    let expandKey = "";
    const clearExpand = () => {
      if (expandTimer !== undefined) window.clearTimeout(expandTimer);
      expandTimer = undefined;
      expandKey = "";
    };
    let scrollFrame = 0;
    let x = event.clientX;
    let y = event.clientY;
    const dragElement = sourceNodeEl;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let holdReady = !(props.compact && event.pointerType === "touch");
    let holdCancelled = false;
    const holdTimer = holdReady ? undefined : window.setTimeout(() => {
      holdReady = true;
      dragElement.classList.add("is-drag-armed");
      window.navigator.vibrate?.(8);
    }, 260);

    const releaseHeldTouch = event.pointerType === "touch"
      ? bindHeldTouchScroll(dragElement, () => holdReady && !holdCancelled)
      : undefined;
    let projection: ReturnType<typeof createDragProjection> | undefined;
    const cleanup = () => {
      projection?.close();
      window.removeEventListener("blur", cancel);
      clearExpand();
      if (releaseDragRef.current === cleanup) releaseDragRef.current = null;
      releaseHeldTouch?.();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      document.body.classList.remove("df-unified-dragging");
      dragElement.classList.remove("is-dragging-source", "is-drag-armed");
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      window.cancelAnimationFrame(scrollFrame);
      marker?.removeAttribute("data-planning-drop");
      if (active && task) props.onTimelineDrag?.(task, null, subtaskId);
      setDragNode(null);
      setPlanningDragTask(null);
      if (dragElement.hasPointerCapture(pointerId)) {
        try { dragElement.releasePointerCapture(pointerId); } catch { /* ignore */ }
      }
    };

    const readDropTarget = (): TreeDropTarget | undefined => {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !tree?.contains(hit)) return;
      const node = hit.closest<HTMLElement>("[data-node-type][data-node-id]");
      const empty = hit.closest<HTMLElement>("[data-empty-project-drop]");
      if (!node) {
        if (sourceNode.kind !== "project" && empty) {
          const target: TreeDropTarget = { kind: "project", id: empty.dataset.emptyProjectDrop!, position: "inside", element: empty };
          return canMoveTreeNode(props.data, sourceNode, target) ? target : undefined;
        }
        return;
      }
      const kind = node.dataset.nodeType as TreeNodeKind;
      const id = node.dataset.nodeId!;
      const row = kind === "task" ? node.querySelector<HTMLElement>(".df-task-node-inner > .df-task-block-row") || node : node;
      const rect = row.getBoundingClientRect();
      const position = sourceNode.kind !== "project" && kind === "task" && y > rect.bottom + 4
        ? "inside" : treeDropPosition(sourceNode.kind, kind, y - rect.top, rect.height);
      if (!position) return;
      const element = sourceNode.kind === "project" ? node.closest<HTMLElement>("[data-project-id]") || node
        : position !== "inside" && kind === "subtask" ? node.closest<HTMLElement>(".df-candidate-subtask-item") || node
        : position !== "inside" && kind === "task" ? node : row;
      const target: TreeDropTarget = { kind, id, position, element };
      return canMoveTreeNode(props.data, sourceNode, target) ? target : undefined;
    };
    const getDropTarget = () => projection ? projection.logical(readDropTarget) : readDropTarget();

    const updateDropTarget = () => {
      const drop = getDropTarget();
      if (marker !== drop?.element) marker?.removeAttribute("data-planning-drop");
      marker = drop?.element;
      if (drop) drop.element.dataset.planningDrop = drop.position;
      projection?.update(drop?.element, drop?.position);
      const key = drop?.position === "inside" ? drop.kind + ":" + drop.id : "";
      if (key !== expandKey) {
        clearExpand();
        if (drop && key) {
          expandKey = key;
          expandTimer = window.setTimeout(() => {
            if (drop.kind === "project") {
              const id = drop.id === "__unassigned__" ? "unassigned" : drop.id;
              props.setCollapsed(current => current[id] ? { ...current, [id]: false } : current);
            } else if (drop.kind === "task") {
              setCollapsedSubtasks(current => current[drop.id] ? { ...current, [drop.id]: false } : current);
            } else {
              drop.element.querySelector<HTMLButtonElement>(".df-candidate-subtask-toggle[aria-expanded='false']")?.click();
            }
          }, 550);
        }
      }
      if (task) props.onTimelineDrag?.(task, { x, y }, subtaskId);
    };
    const scrollAtEdge = () => {
      scrollFrame = 0;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !scroll?.contains(hit) || !autoScrollAtDragEdge(x, y, [scroll])) return;
      updateDropTarget();
      scrollFrame = window.requestAnimationFrame(scrollAtEdge);
    };

    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      const distance = Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY);
      if (!holdReady) {
        if (distance >= 9) {
          holdCancelled = true;
          if (holdTimer !== undefined) window.clearTimeout(holdTimer);
          dragElement.classList.remove("is-drag-armed");
        }
        return;
      }
      if (holdCancelled) return;
      if (!active && distance < DRAG_START_THRESHOLD_PX) return;
      if (!active) {
        active = true;
        pointerEvent.preventDefault();
        try { dragElement.setPointerCapture(pointerId); } catch { /* ignore */ }
        document.body.classList.add("df-unified-dragging");
        dragElement.classList.add("is-dragging-source");
        projection = createDragProjection(dragElement);
        setDragNode(sourceNode);
        const sourceCard = sourceNodeEl.querySelector<HTMLElement>("[data-planning-drag-card]") || sourceNodeEl;
        const rect = sourceCard.getBoundingClientRect();
        const offX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        const offY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
        let overlayTask = subtask ? taskFromSubtask(subtask, task?.projectId) : task;
        if (sourceNode.kind === "project") {
          const project = safeProjects.find((item) => item.id === sourceNode.id);
          overlayTask = project ? {
            id: project.id,
            title: project.title,
            category: "personal",
            priority: null,
            notes: project.notes || "",
            goalId: "",
            completed: Boolean(project.completed),
            dueDate: "",
            projectId: project.id === "__unassigned__" ? undefined : project.id,
            estimatedHours: 0,
            createdAt: project.createdAt || "",
            updatedAt: project.updatedAt || "",
          } : undefined;
        }
        if (overlayTask) {
          setPlanningDragTask({
            task: overlayTask,
            sourceRect: { width: rect.width, height: rect.height },
            offset: { x: offX, y: offY },
            pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY },
          });
        }
      }
      pointerEvent.preventDefault();
      setPlanningDragTask((current) => current ? { ...current, pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY } } : current);
      x = pointerEvent.clientX;
      y = pointerEvent.clientY;
      updateDropTarget();
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(scrollAtEdge);
    };

    const up = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      if (active) {
        suppressPostDragClick();
        x = pointerEvent.clientX;
        y = pointerEvent.clientY;
        if (!task || !props.onTimelineDrop?.(task, { x, y }, subtaskId)) {
          const drop = getDropTarget();
          if (drop) { rememberDragLanding(sourceNode.id, "planning"); props.onTreeMove(sourceNode, { kind: drop.kind, id: drop.id, position: drop.position }); }
        } else rememberDragLanding(subtaskId || task!.id, "schedule");
      }
      cleanup();
    };

    const cancel = () => { if (active) suppressPostDragClick(); cleanup(); };
    const keydown = (kb: KeyboardEvent) => { if (kb.key === "Escape") cancel(); };

    releaseDragRef.current?.();
    releaseDragRef.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
    window.addEventListener("blur", cancel);
  }, [props.compact, props.onTimelineDrag, props.onTimelineDrop, props.data, props.onTreeMove, props.setCollapsed, safeProjects, safeTasks, subtaskOwner, suppressPostDragClick, taskFromSubtask]);

  const hasActiveFilters = includeCompleted || filterProjects.length > 0 || filterWorkflows.length > 0 || filterImportances.length > 0 || filterUrgencies.length > 0 || !!filterDueDate || !!filterScheduled;

  const toggleArray = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, value: T) => {
    setter((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  };

  const filterChips: Array<{
    key: string;
    label: string;
    selected: string[];
    options: Array<{ value: string; label: string; checked: boolean; onToggle: () => void }>;
  }> = [
    {
      key: "project",
      label: props.lang === "zh" ? "Project" : "Project",
      selected: filterProjects.map((id) => safeProjects.find((p) => String(p.id) === id)?.title || id).filter(Boolean),
      options: safeProjects.map((p) => ({
        value: String(p.id),
        label: p.title,
        checked: filterProjects.includes(String(p.id)),
        onToggle: () => toggleArray(setFilterProjects, String(p.id)),
      })),
    },
    {
      key: "status",
      label: props.lang === "zh" ? "Status" : "Status",
      selected: filterWorkflows.map((s) => s === "backlog" ? (props.lang === "zh" ? "To do" : "To do") : s === "doing" ? (props.lang === "zh" ? "Doing" : "Doing") : (props.lang === "zh" ? "已完成" : "Done")),
      options: (["backlog"] as UiWorkflowStatus[]).map((s) => ({
        value: s,
        label: s === "backlog" ? (props.lang === "zh" ? "To do" : "To do") : s === "doing" ? (props.lang === "zh" ? "Doing" : "Doing") : (props.lang === "zh" ? "Done" : "Done"),
        checked: filterWorkflows.includes(s),
        onToggle: () => toggleArray(setFilterWorkflows, s),
      })),
    },
    {
      key: "importance",
      label: props.lang === "zh" ? "Importance" : "Importance",
      selected: filterImportances.map((i) => i === "high" ? (props.lang === "zh" ? "High" : "High") : i === "medium" ? (props.lang === "zh" ? "Medium" : "Medium") : i === "low" ? (props.lang === "zh" ? "Low" : "Low") : (props.lang === "zh" ? "Unset" : "Unset")),
      options: (["high", "medium", "low", "empty"] as StateFilterValue[]).map((i) => ({
        value: i,
        label: i === "high" ? (props.lang === "zh" ? "High" : "High") : i === "medium" ? (props.lang === "zh" ? "Medium" : "Medium") : i === "low" ? (props.lang === "zh" ? "Low" : "Low") : (props.lang === "zh" ? "Unset" : "Unset"),
        checked: filterImportances.includes(i),
        onToggle: () => toggleArray(setFilterImportances, i),
      })),
    },
    {
      key: "urgency",
      label: props.lang === "zh" ? "Urgency" : "Urgency",
      selected: filterUrgencies.map((u) => u === "high" ? (props.lang === "zh" ? "High" : "High") : u === "medium" ? (props.lang === "zh" ? "Medium" : "Medium") : u === "low" ? (props.lang === "zh" ? "Low" : "Low") : (props.lang === "zh" ? "Unset" : "Unset")),
      options: (["high", "medium", "low", "empty"] as StateFilterValue[]).map((u) => ({
        value: u,
        label: u === "high" ? (props.lang === "zh" ? "High" : "High") : u === "medium" ? (props.lang === "zh" ? "Medium" : "Medium") : u === "low" ? (props.lang === "zh" ? "Low" : "Low") : (props.lang === "zh" ? "Unset" : "Unset"),
        checked: filterUrgencies.includes(u),
        onToggle: () => toggleArray(setFilterUrgencies, u),
      })),
    },
  ];

  // Linear-style active filter chips: each active filter becomes a removable chip.
  type ActiveChip = { key: string; label: string; onClear: () => void };
  const stateLabel = (v: StateFilterValue) =>
    v === "high" ? (props.lang === "zh" ? "High" : "High")
    : v === "medium" ? (props.lang === "zh" ? "Medium" : "Medium")
    : v === "low" ? (props.lang === "zh" ? "Low" : "Low")
    : (props.lang === "zh" ? "Unset" : "Unset");
  const workflowLabel = (s: UiWorkflowStatus) =>
    s === "backlog" ? (props.lang === "zh" ? "To do" : "To do")
    : s === "doing" ? (props.lang === "zh" ? "Doing" : "Doing")
    : (props.lang === "zh" ? "Done" : "Done");

  const activeFilterChips: ActiveChip[] = [
    ...filterProjects.map((id) => ({
      key: `project-${id}`,
      label: `${props.lang === "zh" ? "Project" : "Project"}: ${safeProjects.find((p) => String(p.id) === id)?.title || id}`,
      onClear: () => toggleArray(setFilterProjects, id),
    })),
    ...filterWorkflows.map((s) => ({
      key: `status-${s}`,
      label: `${props.lang === "zh" ? "Status" : "Status"}: ${workflowLabel(s)}`,
      onClear: () => toggleArray(setFilterWorkflows, s),
    })),
    ...filterImportances.map((v) => ({
      key: `importance-${v}`,
      label: `${props.lang === "zh" ? "Priority" : "Priority"}: ${stateLabel(v)}`,
      onClear: () => toggleArray(setFilterImportances, v),
    })),
    ...filterUrgencies.map((v) => ({
      key: `urgency-${v}`,
      label: `${props.lang === "zh" ? "Urgency" : "Urgency"}: ${stateLabel(v)}`,
      onClear: () => toggleArray(setFilterUrgencies, v),
    })),
    ...(filterDueDate ? [{
      key: `due-${filterDueDate}`,
      label: `${props.lang === "zh" ? "Due" : "Due"}: ${filterDueDate === "overdue" ? (props.lang === "zh" ? "Overdue" : "Overdue") : filterDueDate === "this-week" ? (props.lang === "zh" ? "This week" : "This week") : (props.lang === "zh" ? "No date" : "No date")}`,
      onClear: () => setFilterDueDate(null),
    }] : []),
    ...(filterScheduled ? [{
      key: `scheduled-${filterScheduled}`,
      label: `${props.lang === "zh" ? "已安排" : "Scheduled"}: ${filterScheduled === "scheduled" ? (props.lang === "zh" ? "已安排" : "Scheduled") : (props.lang === "zh" ? "未安排" : "Unscheduled")}`,
      onClear: () => setFilterScheduled(null),
    }] : []),
  ];

  const clearAllFilters = () => {
    setIncludeCompleted(false);
    setFilterProjects([]);
    setFilterWorkflows([]);
    setFilterImportances([]);
    setFilterUrgencies([]);
    setFilterDueDate(null);
    setFilterScheduled(null);
  };

  useEffect(() => {
    const task = safeTasks.find((item) => item.id === props.focusTaskId);
    if (!task) return;
    clearAllFilters();
    if (task.completed) setIncludeCompleted(true);
    setFilterOpen(false);
    const branch = task.projectId || "unassigned";
    props.setCollapsed((current) => ({ ...current, [branch]: false }));
  }, [props.focusTaskId]);

  useLayoutEffect(() => {
    if (!props.focusTaskId || viewMode !== "tree") return;
    const frame = window.requestAnimationFrame(() => {
      const node = treeRef.current?.querySelector<HTMLElement>(`[data-node-type="task"][data-node-id="${CSS.escape(props.focusTaskId!)}"]`);
      if (!node) return;
      node.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      const block = node.querySelector<HTMLElement>(".df-task-block") || node;
      block.tabIndex = -1;
      block.focus({ preventScroll: true });
      highlightTaskLocation(block);
      props.onFocusHandled?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [props.focusTaskId, viewMode, viewFilteredTasks, props.collapsed]);

  // Linear-style nested filter categories. Level 1 = category list, Level 2 = options.
  const dueDateLabel = (d: "overdue" | "this-week" | "no-date") =>
    d === "overdue" ? (props.lang === "zh" ? "Overdue" : "Overdue")
    : d === "this-week" ? (props.lang === "zh" ? "This week" : "This week")
    : (props.lang === "zh" ? "No date" : "No date");

  type FilterCategory = {
    key: string;
    label: string;
    icon: string;
    activeCount: number;
    summary: string;
  };
  type FilterOption = {
    value: string;
    label: string;
    checked: boolean;
    inputType?: "checkbox" | "radio";
    dotColor?: string;
    onToggle: () => void;
  };
  const filterHasSchedule = hasActiveTaskSchedule;
  const filterDueMatches = (task: Task, value: "overdue" | "this-week" | "no-date") => {
    const due = task.dueDate;
    if (value === "no-date") return !due;
    if (!due) return false;
    if (value === "overdue") return due < today;
    const dueTime = new Date(due + "T00:00:00").getTime();
    const now = new Date(today + "T00:00:00").getTime();
    return dueTime >= now && dueTime <= now + 6 * 86400000;
  };
  const filterOptionsByCategory: Record<string, FilterOption[]> = {
    status: (["backlog"] as UiWorkflowStatus[])
      .filter((s) => filterWorkflows.includes(s) || safeTasks.some((task) => normalizeWorkflowStatus(task) === s))
      .map((s) => ({
        value: s,
        label: workflowLabel(s),
        checked: filterWorkflows.includes(s),
        onToggle: () => toggleArray(setFilterWorkflows, s),
      })),
    importance: (["high", "medium", "low", "empty"] as StateFilterValue[])
      .filter((v) => filterImportances.includes(v) || safeTasks.some((task) => v === "empty" ? !task.importance : task.importance === v))
      .map((v) => ({
        value: v,
        label: stateLabel(v),
        checked: filterImportances.includes(v),
        onToggle: () => toggleArray(setFilterImportances, v),
      })),
    urgency: (["high", "medium", "low", "empty"] as StateFilterValue[])
      .filter((v) => filterUrgencies.includes(v) || safeTasks.some((task) => v === "empty" ? !task.urgency : task.urgency === v))
      .map((v) => ({
        value: v,
        label: stateLabel(v),
        checked: filterUrgencies.includes(v),
        onToggle: () => toggleArray(setFilterUrgencies, v),
      })),
    project: safeProjects
      .filter((project) => filterProjects.includes(String(project.id)) || safeTasks.some((task) => String(task.projectId || "") === String(project.id)))
      .map((project) => ({
        value: String(project.id),
        label: project.title,
        checked: filterProjects.includes(String(project.id)),
        dotColor: projectColorInk(project.color || DEFAULT_PROJECT_COLOR),
        onToggle: () => toggleArray(setFilterProjects, String(project.id)),
      })),
    due: (["overdue", "this-week", "no-date"] as const)
      .filter((d) => filterDueDate === d || safeTasks.some((task) => filterDueMatches(task, d)))
      .map((d) => ({
        value: d,
        label: dueDateLabel(d),
        checked: filterDueDate === d,
        inputType: "radio" as const,
        onToggle: () => setFilterDueDate(filterDueDate === d ? null : d),
      })),
    scheduled: (["scheduled", "unscheduled"] as const)
      .filter((s) => filterScheduled === s || safeTasks.some((task) => s === "scheduled" ? filterHasSchedule(task) : !filterHasSchedule(task)))
      .map((s) => ({
        value: s,
        label: s === "scheduled" ? (props.lang === "zh" ? "已安排" : "Scheduled") : (props.lang === "zh" ? "未安排" : "Unscheduled"),
        checked: filterScheduled === s,
        inputType: "radio" as const,
        onToggle: () => setFilterScheduled(filterScheduled === s ? null : s),
      })),
  };
  const filterCategories: FilterCategory[] = [
    { key: "status", label: props.lang === "zh" ? "Status" : "Status", icon: "circle", activeCount: filterWorkflows.length, summary: filterWorkflows.length > 0 ? filterWorkflows.map(workflowLabel).join(", ") : "" },
    { key: "importance", label: props.lang === "zh" ? "Priority" : "Priority", icon: "flag", activeCount: filterImportances.length, summary: filterImportances.length > 0 ? filterImportances.map(stateLabel).join(", ") : "" },
    { key: "urgency", label: props.lang === "zh" ? "Urgency" : "Urgency", icon: "clock", activeCount: filterUrgencies.length, summary: filterUrgencies.length > 0 ? filterUrgencies.map(stateLabel).join(", ") : "" },
    { key: "project", label: props.lang === "zh" ? "Project" : "Project", icon: "folder", activeCount: filterProjects.length, summary: filterProjects.length > 0 ? filterProjects.map((id) => safeProjects.find((p) => String(p.id) === id)?.title || id).join(", ") : "" },
    { key: "due", label: props.lang === "zh" ? "Due date" : "Due date", icon: "calendar", activeCount: filterDueDate ? 1 : 0, summary: filterDueDate ? dueDateLabel(filterDueDate) : "" },
    { key: "scheduled", label: props.lang === "zh" ? "已安排" : "Scheduled", icon: "layers", activeCount: filterScheduled ? 1 : 0, summary: filterScheduled ? (filterScheduled === "scheduled" ? (props.lang === "zh" ? "已安排" : "Scheduled") : (props.lang === "zh" ? "未安排" : "Unscheduled")) : "" },
  ];
  const effectiveFilterCategories = filterCategories.filter((cat) => (filterOptionsByCategory[cat.key] || []).length > 0);
  const activeFilterCategory = filterExpandedCategory && effectiveFilterCategories.some((cat) => cat.key === filterExpandedCategory)
    ? filterExpandedCategory
    : null;

  const updateMetricsSetting = useCallback((patch: Partial<Settings>) => {
    props.onMetricsSettingsChange?.(patch);
  }, [props]);

  const setMetricRange = useCallback((value: MetricRangePreset) => {
    setMetricsRangePreset(value);
    updateMetricsSetting({ metricsRangePreset: value });
  }, [updateMetricsSetting]);

  const setMetricGroup = useCallback((value: MetricGroupBy) => {
    setMetricsGroupBy(value);
    updateMetricsSetting({ metricsGroupBy: value });
  }, [updateMetricsSetting]);

  const setMetricDisplay = useCallback((value: MetricDisplayMetric) => {
    setMetricsDisplayMetric(value);
    updateMetricsSetting({ metricsDisplayMetric: value });
  }, [updateMetricsSetting]);

  const setMetricHabit = useCallback((value: MetricHabitMode) => {
    setMetricsHabitMode(value);
    updateMetricsSetting({ metricsIncludeHabits: value });
  }, [updateMetricsSetting]);

  const setMetricCompletion = useCallback((value: MetricCompletionFilter) => {
    setMetricsCompletion(value);
    updateMetricsSetting({ metricsCompletionFilter: value });
  }, [updateMetricsSetting]);

  const rangeOptions: Array<{ value: MetricRangePreset; label: string }> = [
    { value: "all", label: props.lang === "zh" ? "\u5168\u90e8" : "All" },
    { value: "today", label: props.lang === "zh" ? "今天" : "Today" },
    { value: "yesterday", label: props.lang === "zh" ? "昨天" : "Yesterday" },
    { value: "thisWeek", label: props.lang === "zh" ? "本周" : "This week" },
    { value: "lastWeek", label: props.lang === "zh" ? "上周" : "Last week" },
    { value: "thisMonth", label: props.lang === "zh" ? "本月" : "This month" },
    { value: "custom", label: props.lang === "zh" ? "自定义" : "Custom" },
  ];
  const groupOptions: Array<{ value: MetricGroupBy; label: string; disabled?: boolean }> = [
    { value: "project", label: props.lang === "zh" ? "项目" : "Project" },
    { value: "importance", label: props.lang === "zh" ? "重要程度" : "Importance" },
    { value: "urgency", label: props.lang === "zh" ? "紧急程度" : "Urgency" },
    { value: "completion", label: props.lang === "zh" ? "完成状态" : "Completion" },
    { value: "taskType", label: props.lang === "zh" ? "任务类型" : "Task type" },
    { value: "customCategory", label: props.lang === "zh" ? "自定义分类（未来）" : "Custom category (later)", disabled: true },
    { value: "tag", label: props.lang === "zh" ? "标签（未来）" : "Tag (later)", disabled: true },
  ];
  const metricActiveChips = [
    metricsGroupBy !== "project" ? { key: "group", label: `${props.lang === "zh" ? "分组" : "Group"}: ${groupOptions.find((item) => item.value === metricsGroupBy)?.label}`, onClear: () => setMetricGroup("project") } : null,
    metricsHabitMode !== "include" ? { key: "habit", label: `${props.lang === "zh" ? "习惯" : "Habits"}: ${metricsHabitMode === "exclude" ? (props.lang === "zh" ? "排除" : "Exclude") : (props.lang === "zh" ? "仅习惯" : "Only habits")}`, onClear: () => setMetricHabit("include") } : null,
    metricsCompletion !== "all" ? { key: "completion", label: `${props.lang === "zh" ? "完成" : "Completion"}: ${metricsCompletion === "completed" ? (props.lang === "zh" ? "已完成" : "Completed") : (props.lang === "zh" ? "未完成" : "Incomplete")}`, onClear: () => setMetricCompletion("all") } : null,
    metricsProjectFilter.length > 0 ? { key: "project", label: `${props.lang === "zh" ? "项目" : "Project"}: ${metricsProjectFilter.length}`, onClear: () => setMetricsProjectFilter([]) } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; onClear: () => void }>;

  const scheduleButton = (task: Task) => props.onScheduleTask && !task.completed && (
    <IconButton className="df-shelf-task-schedule" icon={<UiCalendarCheckIcon size={16} />}
      label={hasActiveTaskSchedule(task) ? (props.lang === "zh" ? "查看安排" : "View schedule") : (props.lang === "zh" ? "安排" : "Schedule")}
      onClick={(event) => { event.stopPropagation(); props.onScheduleTask?.(task); }} />
  );

  const scheduleSubtasks = (task: Task) => {
    if (!(task.subtasks || []).some(isIncompletePlanningSubtask)) return null;
    const expanded = collapsedSubtasks[task.id] === false;
    return <>
      <TaskSubtaskShelf label={props.lang === "zh" ? "子任务" : "Subtasks"}
        progress={`${countDoneSubtasks(task.subtasks)}/${countSubtasks(task.subtasks)}`} expanded={expanded}
        expandLabel={props.lang === "zh" ? "展开子任务" : "Expand subtasks"}
        collapseLabel={props.lang === "zh" ? "收起子任务" : "Collapse subtasks"}
        onToggle={() => setCollapsedSubtasks((current) => ({ ...current, [task.id]: current[task.id] === false }))} />
      {expanded && renderTaskSubtasks(task)}
    </>;
  };

  const projectFilters = (<>
              {(viewMode === "tree" || viewMode === "list") && (
              <div className="df-filter-popover-anchor">
                <button
                  type="button"
                  className={`df-filter-trigger${filterOpen ? " active" : ""}${hasActiveFilters ? " has-active" : ""}`}
                  aria-expanded={filterOpen}
                  aria-label={props.lang === "zh" ? "筛选项目任务" : "Filter project tasks"}
                  title={props.lang === "zh" ? "筛选" : "Filter"}
                  onClick={() => { setFilterOpen((open) => !open); setFilterExpandedCategory(null); }}
                >
                  <UiFilterIcon size={17} />
                  {hasActiveFilters && <b>{activeFilterChips.length + Number(includeCompleted)}</b>}
                </button>
                {filterOpen && (
                  <>
                    <div className="df-filter-panel" onClick={(e) => e.stopPropagation()}>
                      <div className="df-filter-categories">
                        <label className="df-filter-option">
                          <input type="checkbox" checked={includeCompleted} onChange={(event) => setIncludeCompleted(event.target.checked)} />
                          {props.lang === "zh" ? "显示已完成" : "Show completed"}
                        </label>
                        {effectiveFilterCategories.map((cat) => (
                          <button
                            key={cat.key}
                            type="button"
                            className={`df-filter-cat-row${activeFilterCategory === cat.key ? " active" : ""}${cat.activeCount > 0 ? " has-active" : ""}`}
                            onMouseEnter={() => setFilterExpandedCategory(cat.key)}
                            onFocus={() => setFilterExpandedCategory(cat.key)}
                            onClick={() => setFilterExpandedCategory(cat.key)}
                          >
                            <span className="df-filter-cat-icon" aria-hidden="true">
                              {cat.icon === "circle" && <svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>}
                              {cat.icon === "flag" && <svg viewBox="0 0 14 14"><path d="M3 2v10M3 3h8l-1.5 2.5L11 8H3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>}
                              {cat.icon === "clock" && <svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M7 4v3l2 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                              {cat.icon === "folder" && <svg viewBox="0 0 14 14"><path d="M2 4v7h10V5H7L5.5 3.5H2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>}
                              {cat.icon === "calendar" && <svg viewBox="0 0 14 14"><rect x="2" y="3" width="10" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M2 6h10M5 2v2M9 2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                              {cat.icon === "layers" && <svg viewBox="0 0 14 14"><path d="M7 2l5 2.5-5 2.5-5-2.5L7 2zM2 7l5 2.5L12 7M2 9.5L7 12l5-2.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>}
                              {cat.icon === "check" && <svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M4.5 7l1.8 1.8L9.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </span>
                            <span className="df-filter-cat-label">{cat.label}</span>
                            {cat.activeCount > 0 && <span className="df-filter-cat-count">{cat.activeCount}</span>}
                            <svg className="df-filter-cat-chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M2 2l4 5-4 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        ))}
                        {effectiveFilterCategories.length === 0 && <div className="df-filter-empty">{props.lang === "zh" ? "\u6682\u65e0\u53ef\u7528\u7b5b\u9009" : "No filters available"}</div>}
                      </div>
                      {hasActiveFilters && (
                        <button type="button" className="df-filter-reset" onClick={clearAllFilters}>
                          {props.lang === "zh" ? "\u6e05\u9664\u5168\u90e8" : "Clear all"}
                        </button>
                      )}
                      {activeFilterCategory && (
                        <div
                          className="df-filter-flyout-panel"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="df-filter-options-view">
                            <div className="df-filter-options-title">{effectiveFilterCategories.find((cat) => cat.key === activeFilterCategory)?.label}</div>
                            {(filterOptionsByCategory[activeFilterCategory] || []).map((option) => (
                              <label key={option.value} className={`df-filter-option${option.checked ? " checked" : ""}`}>
                                <input type={option.inputType || "checkbox"} checked={option.checked} onChange={option.onToggle} />
                                {option.dotColor && <span className="df-filter-option-dot" style={{ background: option.dotColor }} />}
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              )}
  </>);
  const zh = props.lang === "zh";
  const taskViewEmpty = !props.demo && viewMode !== "metrics" && viewFilteredTasks.length === 0;
  const filtersHideTasks = taskViewEmpty && activeFilterChips.length > 0 && safeTasks.length > 0;
  const clearMetricFilters = () => {
    setMetricRange("today");
    setMetricGroup("project");
    setMetricHabit("include");
    setMetricCompletion("all");
    setMetricsProjectFilter([]);
  };
  return (
    <div ref={viewRef} className={`df-planning df-shelf-view${props.compact ? " compact-layout" : ""}`}>
      <section className={`df-planning-main is-view-${viewMode}`}>
        {props.filterAnchor && createPortal(projectFilters, props.filterAnchor)}
        <div className="df-planning-content">
          {taskViewEmpty && (filtersHideTasks || viewMode !== "tree" || safeProjects.length === 0) && !dragNode && !planningDragTask && (
            <EmptyState announce title={filtersHideTasks ? (zh ? "没有符合筛选条件的任务" : "No tasks match these filters")
              : viewMode === "tree" && props.onProjectCreate && !props.demo
                ? (zh ? "点上方的「+」新建项目" : 'Click "+" above to create a project')
                : (zh ? "这里还没有任务" : "No tasks here yet")}>
              {filtersHideTasks ? <Button onClick={clearAllFilters}>{zh ? "清除筛选" : "Clear filters"}</Button>
                : viewMode !== "tree" && <Button onClick={() => props.onTaskCreate("")}>{zh ? "添加任务" : "Add task"}</Button>}
            </EmptyState>
          )}
              {viewMode === "metrics" && (
                <header className="df-metrics-header">
                  <div className="df-metrics-toolbar">
                    <div className="df-filter-popover-anchor">
                      <button
                        type="button"
                        className={`df-filter-trigger${metricsFilterOpen ? " active" : ""}${metricActiveChips.length > 0 ? " has-active" : ""}`}
                        aria-expanded={metricsFilterOpen}
                        aria-label={props.lang === "zh" ? "指标筛选" : "Metrics filters"}
                        title={props.lang === "zh" ? "指标筛选" : "Metrics filters"}
                        onClick={() => setMetricsFilterOpen((open) => !open)}
                      >
                        <UiFilterIcon size={17} />
                        {metricActiveChips.length > 0 && <b>{metricActiveChips.length}</b>}
                      </button>
                      {metricsFilterOpen && (
                        <>
                          <div className="df-filter-panel df-metrics-filter-panel" onClick={(e) => e.stopPropagation()}>
                            <div className="df-filter-categories">
                              {([
                                ["range", props.lang === "zh" ? "时间范围" : "Range"],
                                ["group", props.lang === "zh" ? "分组方式" : "Group by"],
                                ["project", props.lang === "zh" ? "项目" : "Projects"],
                                ["completion", props.lang === "zh" ? "完成状态" : "Completion"],
                                ["habit", props.lang === "zh" ? "是否包含习惯" : "Habits"],
                                ["metric", props.lang === "zh" ? "显示指标" : "Metric"],
                              ] as Array<[typeof metricsFilterCategory, string]>).map(([key, label]) => (
                                <button
                                  type="button"
                                  key={key}
                                  className={`df-filter-cat-row${metricsFilterCategory === key ? " active" : ""}`}
                                  onMouseEnter={() => setMetricsFilterCategory(key)}
                                  onFocus={() => setMetricsFilterCategory(key)}
                                  onClick={() => setMetricsFilterCategory(key)}
                                >
                                  <span className="df-filter-cat-icon" aria-hidden="true">
                                    <svg viewBox="0 0 14 14"><path d="M3 4h8M4 7h6M5 10h4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                                  </span>
                                  <span className="df-filter-cat-label">{label}</span>
                                  <svg className="df-filter-cat-chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M2 2l4 5-4 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>
                              ))}
                            </div>
                            {metricActiveChips.length > 0 && (
                              <button type="button" className="df-filter-reset" onClick={clearMetricFilters}>
                                {props.lang === "zh" ? "清除全部" : "Clear all"}
                              </button>
                            )}
                            <div className="df-filter-flyout-panel df-metrics-filter-flyout" onClick={(e) => e.stopPropagation()}>
                              <div className="df-filter-options-view">
                                <div className="df-filter-options-title">
                                  {metricsFilterCategory === "range" ? (props.lang === "zh" ? "时间范围" : "Range")
                                    : metricsFilterCategory === "group" ? (props.lang === "zh" ? "分组方式" : "Group by")
                                    : metricsFilterCategory === "project" ? (props.lang === "zh" ? "项目" : "Projects")
                                    : metricsFilterCategory === "completion" ? (props.lang === "zh" ? "完成状态" : "Completion")
                                    : metricsFilterCategory === "habit" ? (props.lang === "zh" ? "是否包含习惯" : "Habits")
                                    : (props.lang === "zh" ? "显示指标" : "Metric")}
                                </div>
                                {metricsFilterCategory === "range" && (
                                  <>
                                    {rangeOptions.map((option) => (
                                      <label key={option.value} className={`df-filter-option${metricsRangePreset === option.value ? " checked" : ""}`}>
                                        <input type="radio" checked={metricsRangePreset === option.value} onChange={() => setMetricRange(option.value)} />
                                        <span>{option.label}</span>
                                      </label>
                                    ))}
                                    {metricsRangePreset === "custom" && (
                                      <div className="df-metrics-custom-dates">
                                        <input type="date" value={metricsCustomStart} onChange={(event) => { setMetricsCustomStart(event.target.value); updateMetricsSetting({ metricsCustomStart: event.target.value }); }} />
                                        <input type="date" value={metricsCustomEnd} onChange={(event) => { setMetricsCustomEnd(event.target.value); updateMetricsSetting({ metricsCustomEnd: event.target.value }); }} />
                                      </div>
                                    )}
                                  </>
                                )}
                                {metricsFilterCategory === "group" && groupOptions.map((option) => (
                                  <label key={option.value} className={`df-filter-option${metricsGroupBy === option.value ? " checked" : ""}${option.disabled ? " disabled" : ""}`}>
                                    <input type="radio" checked={metricsGroupBy === option.value} disabled={option.disabled} onChange={() => !option.disabled && setMetricGroup(option.value)} />
                                    <span>{option.label}</span>
                                  </label>
                                ))}
                                {metricsFilterCategory === "project" && (
                                  <>
                                    <label className={`df-filter-option${metricsProjectFilter.length === 0 ? " checked" : ""}`}>
                                      <input type="checkbox" checked={metricsProjectFilter.length === 0} onChange={() => setMetricsProjectFilter([])} />
                                      <span>{props.lang === "zh" ? "全部项目" : "All projects"}</span>
                                    </label>
                                    {safeProjects.map((project) => (
                                      <label key={project.id} className={`df-filter-option${metricsProjectFilter.includes(project.id) ? " checked" : ""}`}>
                                        <input type="checkbox" checked={metricsProjectFilter.includes(project.id)} onChange={() => toggleArray(setMetricsProjectFilter, project.id)} />
                                        <span className="df-filter-option-dot" style={{ background: projectColorInk(project.color || DEFAULT_PROJECT_COLOR) }} />
                                        <span>{project.title}</span>
                                      </label>
                                    ))}
                                  </>
                                )}
                                {metricsFilterCategory === "completion" && (["all", "completed", "incomplete"] as MetricCompletionFilter[]).map((value) => (
                                  <label key={value} className={`df-filter-option${metricsCompletion === value ? " checked" : ""}`}>
                                    <input type="radio" checked={metricsCompletion === value} onChange={() => setMetricCompletion(value)} />
                                    <span>{value === "all" ? (props.lang === "zh" ? "全部" : "All") : value === "completed" ? (props.lang === "zh" ? "已完成" : "Completed") : (props.lang === "zh" ? "未完成" : "Incomplete")}</span>
                                  </label>
                                ))}
                                {metricsFilterCategory === "habit" && (["include", "exclude", "only"] as MetricHabitMode[]).map((value) => (
                                  <label key={value} className={`df-filter-option${metricsHabitMode === value ? " checked" : ""}`}>
                                    <input type="radio" checked={metricsHabitMode === value} onChange={() => setMetricHabit(value)} />
                                    <span>{value === "include" ? (props.lang === "zh" ? "包含习惯" : "Include habits") : value === "exclude" ? (props.lang === "zh" ? "排除习惯" : "Exclude habits") : (props.lang === "zh" ? "仅习惯" : "Only habits")}</span>
                                  </label>
                                ))}
                                {metricsFilterCategory === "metric" && (["percentage", "duration", "taskCount", "completionRate"] as MetricDisplayMetric[]).map((value) => (
                                  <label key={value} className={`df-filter-option${metricsDisplayMetric === value ? " checked" : ""}`}>
                                    <input type="radio" checked={metricsDisplayMetric === value} onChange={() => setMetricDisplay(value)} />
                                    <span>{value === "percentage" ? (props.lang === "zh" ? "百分比" : "Percentage") : value === "duration" ? (props.lang === "zh" ? "总时长" : "Duration") : value === "taskCount" ? (props.lang === "zh" ? "任务数量" : "Task count") : (props.lang === "zh" ? "完成率" : "Completion rate")}</span>
                                  </label>
                                ))}
                              </div>
                          </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </header>
              )}
            <div className="df-tree-wrap">
          {(viewMode === "tree" || viewMode === "list") && activeFilterChips.length > 0 && (
            <div className="df-active-filter-bar" role="region" aria-label={props.lang === "zh" ? "Active filters" : "Active filters"}>
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="df-active-filter-chip"
                  onClick={chip.onClear}
                  title={props.lang === "zh" ? "\u79fb\u9664\u7b5b\u9009" : "Remove filter"}
                >
                  <span className="df-active-filter-chip-label">{chip.label}</span>
                  <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" /></svg>
                </button>
              ))}
              <button type="button" className="df-active-filter-clear" onClick={clearAllFilters}>
                {props.lang === "zh" ? "\u6e05\u9664\u5168\u90e8" : "Clear all"}
              </button>
            </div>
          )}

          {viewMode === "metrics" && (
            <section className="df-metrics-view" aria-label={props.lang === "zh" ? "时间占比" : "Time allocation metrics"}>
              {props.engagementEnabled && <p className="df-engagement-caption">{props.lang === "zh" ? "已完成任务按时长 × 投入度统计（默认 80%）；未完成安排按原始时长统计。" : "Completed time is weighted by engagement (80% by default); incomplete schedules use their original duration."}</p>}


              {metricActiveChips.length > 0 && (
                <div className="df-active-filter-bar df-metrics-chip-bar" role="region" aria-label={props.lang === "zh" ? "指标筛选" : "Metric filters"}>
                  {metricActiveChips.map((chip) => (
                    <button key={chip.key} type="button" className="df-active-filter-chip" onClick={chip.onClear}>
                      <span className="df-active-filter-chip-label">{chip.label}</span>
                      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" /></svg>
                    </button>
                  ))}
                </div>
              )}

              <React.Suspense fallback={<div className="df-metrics-empty" role="status">{props.lang === "zh" ? "正在加载指标…" : "Loading metrics…"}</div>}>
              <MetricsInsights key={props.analyticsScope || "demo"} scope={props.analyticsScope} data={props.data} referenceDate={props.referenceDate} dayStartTime={props.dayStartTime} weekStartsOn={props.weekStartsOn} engagementEnabled={props.engagementEnabled} projectIds={metricsProjectFilter} habitMode={metricsHabitMode} completion={metricsCompletion} lang={props.lang}
                query={{range:metricsRangePreset,customStart:metricsCustomStart,customEnd:metricsCustomEnd,group:metricsGroupBy,display:metricsDisplayMetric,habit:metricsHabitMode,completion:metricsCompletion,projects:metricsProjectFilter}}
                onApplyQuery={(q:MetricsQuery)=>{setMetricsRangePreset(q.range);setMetricsCustomStart(q.customStart);setMetricsCustomEnd(q.customEnd);setMetricsGroupBy(q.group);setMetricsDisplayMetric(q.display);setMetricsHabitMode(q.habit);setMetricsCompletion(q.completion);setMetricsProjectFilter(q.projects);updateMetricsSetting({metricsRangePreset:q.range,metricsCustomStart:q.customStart,metricsCustomEnd:q.customEnd,metricsGroupBy:q.group,metricsDisplayMetric:q.display,metricsIncludeHabits:q.habit,metricsCompletionFilter:q.completion});}}/>

              </React.Suspense>
            </section>
          )}

          {(viewMode === "kanban" || viewMode === "eisenhower") && (() => {
            const zh = props.lang === "zh";
            const kanban = viewMode === "kanban";
            const groups = kanban
              ? [{ key: "backlog", label: zh ? "任务" : "Tasks" }, ...(props.showCompleted ? [{ key: "done", label: zh ? "已完成" : "Done" }] : [])]
              : [
                  { key: "q1", label: zh ? "立即处理" : "Focus now" },
                  { key: "q2", label: zh ? "安排时间" : "Plan" },
                  { key: "q3", label: zh ? "尽快处理" : "Handle soon" },
                  { key: "q4", label: zh ? "稍后处理" : "Later" },
                ];
            return <div className={kanban ? "df-kanban-board" : "df-eisenhower-grid"}>
              {groups.map(({ key, label }) => {
                const cards = orderPlanningTasks(viewFilteredTasks.filter((task) => planningContainer(task) === key));
                const hours = cards.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
                return <div key={key} className={kanban ? "df-kanban-column" : "df-eisenhower-quadrant"} data-planning-group={key}>
                  <div className={kanban ? "df-kanban-column-header" : "df-eisenhower-quadrant-header"}>
                    <span>{label}</span><small>{cards.length}</small>
                    {hours > 0 && <em className="df-kanban-column-duration">{formatDuration(hours)}</em>}
                  </div>
                  <div className={kanban ? "df-kanban-card-list" : "df-eisenhower-task-list"}>
                    {cards.map((task) => <PlanningCandidateCard key={task.id} as="div" task={task} lang={props.lang}
                      projectColor={isEventDisplayTask(task) ? categories[task.category]?.color : projectColor(task.projectId)}
                      dragState={planningDragTask?.task.id === task.id ? "source-placeholder" : undefined}
                      dataAttrs={{ "planning-task-id": task.id, kind: isEventDisplayTask(task) ? "event" : undefined }}
                      onPointerDown={(event) => beginPlanningDrag(event, task)} onClick={() => openTaskFromPlanning(task)}
                      onToggle={() => props.onTaskUpdate(task.id, workflowStatusForPatch(kanbanStatus(task) === "done" ? "backlog" : "done"))}
                      meta={<span className="df-shelf-task-meta">
                        <span>{projectName(task.projectId)}</span>{task.dueDate && <time dateTime={task.dueDate}>{task.dueDate.slice(5)}</time>}
                      </span>}
                      actions={<TaskActions>{scheduleButton(task)}</TaskActions>}>
                      {scheduleSubtasks(task)}
                    </PlanningCandidateCard>)}
                    {props.demo && cards.length === 0 && <div className="df-eisenhower-empty">{zh ? "暂无任务" : "No tasks"}</div>}
                  </div>
                </div>;
              })}
            </div>;
          })()}

          {viewMode === "list" && <div className="df-kanban-card-list" data-planning-group="list">
            {orderPlanningTasks(viewFilteredTasks).map(task => <PlanningCandidateCard key={task.id} as="div" task={task} lang={props.lang}
              projectColor={isEventDisplayTask(task) ? categories[task.category]?.color : projectColor(task.projectId)}
              dragState={planningDragTask?.task.id === task.id ? "source-placeholder" : undefined}
              dataAttrs={{ "planning-task-id": task.id, kind: isEventDisplayTask(task) ? "event" : undefined }}
              onPointerDown={event => beginPlanningDrag(event, task)} onClick={() => openTaskFromPlanning(task)}
              onToggle={() => props.onTaskUpdate(task.id, workflowStatusForPatch(kanbanStatus(task) === "done" ? "backlog" : "done"))}
              meta={<span className="df-shelf-task-meta"><span>{projectName(task.projectId)}</span>{task.dueDate && <time dateTime={task.dueDate}>{task.dueDate.slice(5)}</time>}</span>}
              actions={<TaskActions>{scheduleButton(task)}</TaskActions>}>
              {scheduleSubtasks(task)}
            </PlanningCandidateCard>)}
          </div>}

          {viewMode === "tree" && (
          <div
            className={`df-tree${dragNode ? " is-tree-dragging" : ""}`}
            ref={treeRef}
            onPointerDown={(event) => {
              const origin = event.target as HTMLElement;
              if (origin.closest("button, input, textarea, select, [contenteditable='true']")) return;
              const node = origin.closest<HTMLElement>("[data-node-type][data-node-id]");
              if (!node) return;
              const source = { kind: node.dataset.nodeType as TreeNodeKind, id: node.dataset.nodeId || "" };
              const task = source.kind === "task" && safeTasks.find((item) => item.id === source.id);
              if (task && event.pointerType === "touch" && props.onTouchScheduleDrag) props.onTouchScheduleDrag(event, task);
              else beginTreeDrag(event, source);
            }}
          >
            {svgLines}
            {visibleProjects.map(({ project, tasks }) => (
              <React.Fragment key={project.id}>
                <div className="df-category-branch" data-project-id={project.id}>
                  <PlanningProjectNode
                demo={props.demo}
                    lang={props.lang}
                    project={project}
                    taskCount={tasks.length}
                    collapsed={Boolean(props.collapsed[project.id])}
                    onToggleCollapse={() => props.setCollapsed((current) => ({ ...current, [project.id]: !current[project.id] }))}
                    onOpen={() => props.onProjectEdit(project)}
                    onAddTask={() => props.onTaskCreate(project.id)}
                    onComplete={props.demo ? undefined : () => props.onProjectComplete?.(project.id)}
                    dragging={dragNode?.kind === "project" && dragNode.id === project.id}
                  />
                  {!props.collapsed[project.id] && (
                    <div className="df-project-tasks" data-empty-project-drop={tasks.length === 0 ? project.id : undefined}>
                      {!props.demo && tasks.length === 0 && activeFilterChips.length === 0 && !dragNode && (
                        <p className="df-tree-empty-hint">{zh ? "点上方的「+」添加待办任务" : 'Click "+" above to add a new open task'}</p>
                      )}
                      {tasks.map((task) => (
                        <div className="df-task-branch" key={task.id}>
                        <PlanningTaskNode
                demo={props.demo}
                          lang={props.lang}
                          task={task}

                          projectColor={project.color || DEFAULT_PROJECT_COLOR}
                          collapsed={Boolean(collapsedSubtasks[task.id])}
                          onToggleCollapse={() => setCollapsedSubtasks((current) => ({ ...current, [task.id]: !current[task.id] }))}
                          onOpen={() => openTaskFromPlanning(task)}
                          onSchedule={props.onScheduleTask ? () => props.onScheduleTask?.(task) : undefined}
                          onRename={() => renameTask(task)}
                          onAddSubtask={() => addSubtask(task)}
                          onSetDate={() => setTaskDate(task)}
                          onMoveProject={() => moveTaskProject(task)}
                          onDelete={() => props.onTaskDelete(task.id)}
                          onToggleComplete={() => props.onTaskUpdate(task.id, workflowStatusForPatch(normalizeWorkflowStatus(task) === "done" ? "backlog" : "done"))}
                          onToggleSubtask={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                          subtaskContent={renderTaskSubtasks(task)}
                          dragging={dragNode?.kind === "task" && dragNode.id === task.id}
                        />
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </React.Fragment>
            ))}

            {(!props.demo || unassigned.length > 0) && (
              <React.Fragment>
                <div className="df-category-branch" data-project-id="__unassigned__">
                <PlanningProjectNode
                demo={props.demo}
                  lang={props.lang}
                  project={createProjectShell(t(props.lang, "planning.unassignedTasks"))}
                  taskCount={unassigned.length}
                  collapsed={Boolean(props.collapsed.unassigned)}
                  onToggleCollapse={() => props.setCollapsed((current) => ({ ...current, unassigned: !current.unassigned }))}
                  onOpen={() => {}}
                  onAddTask={() => props.onTaskCreate("")}
                />
                {!props.collapsed.unassigned && (
                  <div className="df-project-tasks" data-empty-project-drop={unassigned.length === 0 ? "__unassigned__" : undefined}>
                    {unassigned.map((task) => (
                      <div className="df-task-branch" key={task.id}>
                        <PlanningTaskNode
                demo={props.demo}
                          lang={props.lang}
                          task={task}

                          projectColor={DEFAULT_PROJECT_COLOR}
                          collapsed={Boolean(collapsedSubtasks[task.id])}
                          onToggleCollapse={() => setCollapsedSubtasks((current) => ({ ...current, [task.id]: !current[task.id] }))}
                          onOpen={() => openTaskFromPlanning(task)}
                          onSchedule={props.onScheduleTask ? () => props.onScheduleTask?.(task) : undefined}
                          onRename={() => renameTask(task)}
                          onAddSubtask={() => addSubtask(task)}
                          onSetDate={() => setTaskDate(task)}
                          onMoveProject={() => moveTaskProject(task)}
                          onDelete={() => props.onTaskDelete(task.id)}
                          onToggleComplete={() => props.onTaskUpdate(task.id, workflowStatusForPatch(normalizeWorkflowStatus(task) === "done" ? "backlog" : "done"))}
                          onToggleSubtask={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                          subtaskContent={renderTaskSubtasks(task)}
                          dragging={dragNode?.kind === "task" && dragNode.id === task.id}
                        />
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </React.Fragment>
            )}
          </div>
          )}
        </div>
        {props.presentationNote}
        </div>
      </section>

      {planningDragTask && (
        <TaskDragLayer
          pointer={planningDragTask.pointer}
          sourceRect={planningDragTask.sourceRect}
          offset={planningDragTask.offset}
        >
          <PlanningCandidateCard task={planningDragTask.task} lang={props.lang} dragState="overlay"
            projectColor={projectColor(planningDragTask.task.projectId)}
            style={{ width: "100%", height: "100%", minHeight: 0 }} />
        </TaskDragLayer>
      )}
    </div>
  );
}
