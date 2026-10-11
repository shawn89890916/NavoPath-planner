import { normalizeEngagement } from "./utils/engagement";
import React, { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Suspense, lazy } from "react";
import type { AgentAuditEntry, AgentRunState, AiConversation, Category, Language, NullablePriority, Project, RecurrenceFrequency, Settings, Subtask, Task, TaskRecurrence } from "./types";
import { type AiAction, type AiClarification, type AiStep } from "./aiAssistantApi";
import type { ParsedAttachment } from "./fileParser";
import { removeEmptyAiConversations } from "./aiConversationHistory";
import { timeBlockTop, timeBlockHeight, HOUR_HEIGHT, resizedBlockTop } from "./timelineGeometry";
import { t, weekdayName } from "./i18n";
import { term } from "./terminology";
import { candidateReturnedScheduleSummary, candidateScheduleSummary, type CandidateScheduleSummary } from "./utils/candidateSchedule";
import { normalizeTaskCheckTone } from "./utils/productivityModel";
import { addDays, addMonths, hasRecurringRule } from "./utils/recurrence";
import { countSubtasks, countDoneSubtasks } from "./utils/treeOrder";
import { TaskActions, TaskBlock, TaskBlockContent, TaskBlockDuration, TaskBlockPriority, TaskBlockRow, TaskCheckbox, TaskSubtaskShelf, type TaskBlockDragState } from "./components/TaskBlock";
import { CloseButton, IconButton } from "./components/UiPrimitives";
import { AnchoredNarrowMenu } from "./components/AnchoredNarrowMenu";
import { UiCalendarCheckIcon, UiCalendarClockIcon, UiDockSidebarIcon, UiFlagIcon, UiFolderInputIcon, UiReturnIcon, UiTrashIcon } from "./components/UiIcons";
import { clockTimeSpanMinutes } from "./utils/timelineRecords";

// Canonical product presentation: the workspace and isolated demos share these components.
export const COMPACT_LAYOUT_MEDIA_QUERY = "(orientation: portrait), (max-width: 980px) and (orientation: landscape)";

export const SLOT_MINUTES = 15;

export const DURATION_OPTIONS = Array.from({ length: 16 }, (_, index) => (index + 1) * 15);

export const ATTACHMENT_ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";

export const DEFAULT_PROJECT_COLOR = "#584D3D";

export const PROJECT_COLOR_PRESETS = [DEFAULT_PROJECT_COLOR, "#7EA172", "#D7816A", "#0F0326", "#584D3D", "#8B5CF6", "#38BDF8", "#F59E0B", "#EF4444"];

export function taskBlockPriorityFor(priority: NullablePriority | undefined): TaskBlockPriority {
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  if (priority === "low") return "low";
  return "normal";
}

export const categories: Record<Category, { label: string; color: string }> = {
  exam: { label: "考试", color: "#7C3AED" },
  uk: { label: "英国申请", color: "#8B5CF6" },
  us: { label: "美国申请", color: "#A78BFA" },
  essay: { label: "文书", color: "#EC4899" },
  materials: { label: "材料", color: "#22C55E" },
  project: { label: "项目", color: "#38BDF8" },
  personal: { label: "个人", color: "#64748B" }
};

export type AutoScheduleState = "idle" | "generating" | "preview" | "committing" | "error";

export type TimelineFocusSource = "schedule" | "autoschedule" | "recurrence" | "placement" | "now";

export type TimelineFocusTarget = { date: string; startTime?: string; taskId?: string; source: TimelineFocusSource; behavior?: ScrollBehavior; highlight?: boolean };

export const PLACEMENT_PREVIEW_HOVER_DELAY_MS = 300;

export type PlacementPreview = {
  taskId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  source: "candidate-calendar";
} | null;

export type PlacementChoice = NonNullable<PlacementPreview>;

export function isEventDisplayTask(taskOrId: Task | string) {
  const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
  return id.startsWith("event_occ_");
}

export function isExternalCalendarDisplayTask(taskOrId: Task | string) {
  const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
  return id.startsWith("event_occ_external_");
}

export function normalizeHexColor(value: string, fallback: string) {
  const input = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(input)) return input;
  if (/^#[0-9a-f]{3}$/i.test(input)) return `#${input.slice(1).split("").map((ch) => ch + ch).join("")}`;
  return fallback;
}

export function hexToRgb(value: string) {
  const hex = normalizeHexColor(value, "#8B5CF6").slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

export function isLightColor(value: string) {
  const { r, g, b } = hexToRgb(value);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 174;
}

export type ResizePreview = { taskId: string; start: string; end: string; startDate: string } | null;

export type AiAttachmentSnapshot = {
  name: string;
  size: number;
  pageCount?: number;
  truncated?: boolean;
  status: "ready" | "error";
  statusText: string;
  summary: string;
};

export type AiSessionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  saved?: boolean;
  status?: "thinking" | "done" | "error";
  streaming?: boolean;
  attachment?: AiAttachmentSnapshot;
  steps?: AiStep[];
  actions?: AiAction[];
  selectedActions?: Record<number, boolean>;
  actionState?: "pending" | "adopted" | "rejected" | "undone";
  intent?: string;
  plan?: Array<{ taskId?: string; title: string; start: string; end: string; durationMinutes?: number; reason?: string }>;
  format?: "text" | "markdown";
  agent?: AgentRunState;
  clarifications?: AiClarification[];
  importCommit?: {
    focus?: TimelineFocusTarget;
    addedCount: number;
    addedTaskIds: string[];
    addedEventIds: string[];
    previousTasks: Task[];
  };
};

export const AiClarificationQuestionsLazy = lazy(() => import("./components/AiClarificationQuestions"));

export function AiMarkdownLoadFallback({ children }: { children: string }) {
  return <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{children}</p>;
}

export const AiMarkdownLazy = lazy(() => {
  const modulePromise = import("./components/AiMarkdown");
  const timeoutPromise = new Promise<{ default: typeof AiMarkdownLoadFallback }>((resolve) => {
    window.setTimeout(() => resolve({ default: AiMarkdownLoadFallback }), 2500);
  });
  return Promise.race([modulePromise, timeoutPromise]);
});

export function minutesToTime(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(time = "09:00") {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function addMinutes(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function dateDiff(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
}

export function taskDuration(task: Task) {
  if (task.scheduledStart && task.scheduledEnd) {
    return Math.max(clockTimeSpanMinutes(task.scheduledStart, task.scheduledEnd), SLOT_MINUTES);
  }
  return Math.max(Math.round((task.estimatedHours || 0.5) * 60), SLOT_MINUTES);
}

export function extractNextAction(notes = "") {
  const match = notes.match(/下一步[:：]\s*(.+?)(?:\n|$)/);
  return match?.[1]?.trim() || "";
}

export function sortAiConversations(conversations: AiConversation[]) {
  return [...conversations].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
  });
}

export const PRODUCT_ICON_SRC = `${import.meta.env.BASE_URL}navopath-icon.png`;

export function ProductIcon({ compact = false }: { compact?: boolean }) {
  const size = compact ? 32 : 36;
  return (
    <div className={`dayflow-icon ${compact ? "compact" : ""}`} aria-hidden="true">
      <img src={PRODUCT_ICON_SRC} alt="" width={size} height={size} />
    </div>
  );
}

export function recurrenceOptions(lang: Language): Array<{ value: RecurrenceFrequency; label: string }> {
  const labels: Record<RecurrenceFrequency, { zh: string; en: string }> = {
    weekly: { zh: "每周", en: "Weekly" },
    biweekly: { zh: "每 2 周", en: "Every 2 weeks" },
    monthly: { zh: "每月", en: "Monthly" },
    quarterly: { zh: "每 3 个月", en: "Every 3 months" },
    weekdays: { zh: "工作日", en: "Weekdays" },
    weekends: { zh: "周末", en: "Weekends" },
    daily: { zh: "每天", en: "Daily" },
    none: { zh: "无", en: "None" },
  };
  return (["weekly", "biweekly", "monthly", "quarterly", "weekdays", "weekends", "daily", "none"] as RecurrenceFrequency[])
    .map((value) => ({ value, label: labels[value][lang] }));
}

export function recurrenceLabel(recurrence?: TaskRecurrence, lang: Language = "zh") {
  if (!recurrence || recurrence.frequency === "none") return "";
  if (lang === "en") {
    const englishLabels: Record<Exclude<RecurrenceFrequency, "none">, string> = {
      daily: "Daily",
      weekdays: "Weekdays",
      weekends: "Weekends",
      weekly: "Weekly",
      biweekly: "Every 2 weeks",
      monthly: "Monthly",
      quarterly: "Every 3 months",
    };
    return englishLabels[recurrence.frequency as Exclude<RecurrenceFrequency, "none">] || "Recurring";
  }
  return recurrenceOptions(lang).find((item) => item.value === recurrence.frequency)?.label || (lang === "zh" ? "重复" : "Recurring");
}

export function TaskRecurrenceIndicator({ recurrence, lang }: { recurrence?: TaskRecurrence; lang: Language }) {
  const repeatText = recurrenceLabel(recurrence, lang);
  if (!repeatText) return null;
  const label = lang === "zh" ? `循环周期：${repeatText}` : `Repeats: ${repeatText}`;
  return <span className="df-task-recurrence-indicator" tabIndex={0} role="img" aria-label={label} title={label}>
    <svg viewBox="0 0 24 24" shapeRendering="geometricPrecision" aria-hidden="true"><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 9a7 7 0 0 1 11.7-2L20 12M4 12l2.2 5a7 7 0 0 0 11.7-2" /></svg>
  </span>;
}

export function CandidateSubtaskItem({
  subtask,
  depth = 0,
  lang,
  onToggleSubtask,
  onSubtaskDragStart,
}: {
  subtask: Subtask;
  depth?: number;
  lang: Language;
  onToggleSubtask: (subtaskId: string) => void;
  onSubtaskDragStart?: (event: React.PointerEvent, subtaskId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const children = subtask.subtasks || [];
  const hasChildren = children.length > 0;
  const done = Boolean(subtask.completed || subtask.done);
  const planned = Boolean(subtask.plannedTaskId);
  const displayTitle = subtask.title.trimStart();

  return (
    <div
      className="df-candidate-subtask-item"
      data-depth={depth}
      style={{ "--candidate-subtask-depth": String(depth) } as CSSProperties}
    >
      <TaskBlock
        as="div"
        variant="habit-child"
        appearance="calm"
        checked={done}
        selected={planned}
        projectColor="var(--accent-active)"
        className={`df-candidate-subtask-row${done ? " done" : ""}${planned ? " planned" : ""}`}
        dataAttrs={{ "candidate-subtask": subtask.id }}
        title={displayTitle}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSubtaskDragStart?.(event, subtask.id);
        }}
      >
        <TaskBlockRow className="df-candidate-subtask-row-inner">
          <TaskCheckbox
            checked={done}
            tone={done ? "done" : "muted"}
            className={`df-subtask-check${done ? " done" : ""}`}
            title={done ? (lang === "zh" ? "Mark incomplete" : "Mark incomplete") : (lang === "zh" ? "Mark complete" : "Mark complete")}
            ariaLabel={done ? (lang === "zh" ? "标记为未完成" : "Mark incomplete") : (lang === "zh" ? "标记为完成" : "Mark complete")}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSubtask(subtask.id);
            }}
          >
            {done ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}
          </TaskCheckbox>
          <TaskBlockContent className="df-candidate-subtask-main" title={displayTitle} />
          <TaskBlockDuration>{planned ? (lang === "zh" ? "Planned" : "Planned") : null}</TaskBlockDuration>
          <TaskActions>
            {hasChildren ? (
              <button
                type="button"
                className="df-candidate-subtask-toggle"
                aria-label={open ? "Collapse subtasks" : "Expand subtasks"}
                aria-expanded={open}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen((value) => !value);
                }}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d={open ? "M4 9.5 8 5.5l4 4" : "M5.5 4 9.5 8l-4 4"} /></svg>
              </button>
            ) : null}
          </TaskActions>
        </TaskBlockRow>
      </TaskBlock>
      {hasChildren && open ? (
        <div className="df-candidate-subtask-nest">
          {children.map((child) => (
            <CandidateSubtaskItem
              key={child.id}
              subtask={child}
              depth={depth + 1}
              lang={lang}
              onToggleSubtask={onToggleSubtask}
              onSubtaskDragStart={onSubtaskDragStart}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function formatCandidateDate(date: string, lang: Language) {
  if (!date) return lang === "zh" ? "未定" : "No date";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export function candidateRelativeScheduleOptions(focusDate: string, lang: Language) {
  const day = new Date(`${focusDate}T00:00:00`).getDay();
  const weekendOffset = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  const zh = lang === "zh";
  return [
    { date: focusDate, label: zh ? "今天" : "Today" },
    { date: addDays(focusDate, 1), label: zh ? "明天" : "Tomorrow" },
    { date: addDays(focusDate, weekendOffset), label: zh ? "本周末" : "Weekend" },
    { date: addDays(focusDate, 7), label: zh ? "下周" : "Next week" },
    { date: addDays(focusDate, 14), label: zh ? "两周后" : "In 2 weeks" },
    { date: addMonths(focusDate, 1), label: zh ? "一个月后" : "In a month" },
    { date: addMonths(focusDate, 3), label: zh ? "三个月后" : "In 3 months" },
  ];
}

export function candidateQuickScheduleOptions(focusDate: string, lang: Language, startTime: string) {
  return [1, 2, 3, 4].map((offset) => {
    const date = addDays(focusDate, offset);
    const dayLabel = offset === 1 ? (lang === "zh" ? "明天" : "Tomorrow") : weekdayName(lang, new Date(`${date}T00:00:00`).getDay());
    return { date, label: `${dayLabel} ${startTime}` };
  });
}

export function TaskCard({
  demo = false,
  task,
  projects,
  focusDate,
  onFocusSchedule,
  placementPreview,
  placementChoices,
  isPlacementLocated = false,
  onLocatePlacement,
  onReturnFromPlacementLocation,
  onQuickDuration,
  onProjectChange,
  onDelete,
  onToggleDone,
  onClick,
  onPointerDragStart,
  onStartPlacementPreview,
  onCancelPlacementPreview,
  onConfirmPlacementPreview,
  onConfirmPlacementChoice,
  onScheduleDate,
  onSaveDueDate,
  onSaveRecurrence,
  onMetaUpdate,
  onMoveToPlanning,
  onMarkUnfinished,
  onUnschedule,
  onToggleSubtask,
  onSubtaskDragStart,
  dragState,
  lang,
}: {
  demo?: boolean;
  task: Task;
  projects: Project[];
  focusDate: string;
  onFocusSchedule?: (schedule: CandidateScheduleSummary) => void;
  placementPreview: PlacementPreview;
  placementChoices: PlacementChoice[];
  isPlacementLocated?: boolean;
  onLocatePlacement?: (schedule: CandidateScheduleSummary) => void;
  onReturnFromPlacementLocation?: () => void;
  onQuickDuration: (minutes: number) => void;
  onProjectChange: (projectId: string) => void;
  onDelete: () => void;
  onToggleDone: () => void;
  onClick: () => void;
  onPointerDragStart: (event: React.PointerEvent) => void;
  onStartPlacementPreview: () => void;
  onCancelPlacementPreview: () => void;
  onConfirmPlacementPreview: () => void;
  onConfirmPlacementChoice: (choice: PlacementChoice) => void;
  onScheduleDate: (date: string) => void;
  onSaveDueDate: (date: string) => void;
  onSaveRecurrence: (recurrence?: TaskRecurrence) => void;
  onMetaUpdate?: (patch: Partial<Task>) => void;
  onMoveToPlanning?: () => void;
  onMarkUnfinished: () => void;
  onUnschedule: () => void;
  onToggleSubtask?: (subtaskId: string) => void;
  onSubtaskDragStart?: (event: React.PointerEvent, subtaskId: string) => void;
  dragState?: TaskBlockDragState;
  lang: Language;
}) {
  const compact = window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches;
  const [openPanel, setOpenPanel] = useState<"more" | null>(null);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [schedulePanelOpen, setSchedulePanelOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState<"duration" | "deadline" | null>(null);
  const [morePopover, setMorePopover] = useState<"priority" | "project" | "schedule-more" | null>(null);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate || focusDate);
  const [durationDraft, setDurationDraft] = useState(String(Math.round((task.estimatedHours || 0.5) * 60)));
  const durationTriggerRef = useRef<HTMLButtonElement>(null);
  const deadlineTriggerRef = useRef<HTMLButtonElement>(null);
  const priorityTriggerRef = useRef<HTMLButtonElement>(null);
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const scheduleMoreTriggerRef = useRef<HTMLButtonElement>(null);
  const schedulePanelRef = useRef<HTMLDivElement>(null);
  const placementHoverTimerRef = useRef<number | null>(null);
  const wasPlacementArmedRef = useRef(false);
  const [recurrenceDraft, setRecurrenceDraft] = useState<TaskRecurrence>(() => ({
    mode: task.recurrence?.mode || "flexible",
    frequency: task.recurrence?.frequency || "weekly",
    startDate: task.recurrence?.startDate || task.dueDate || focusDate,
    startTime: task.recurrence?.startTime || "09:00",
    durationMinutes: task.recurrence?.durationMinutes || Math.max(Math.round((task.estimatedHours || 0.5) * 60), 30),
    endDate: task.recurrence?.endDate,
    count: task.recurrence?.count,
  }));
  const overdue = task.dueDate && task.dueDate < focusDate ? dateDiff(task.dueDate, focusDate) : 0;
  const isEvent = isEventDisplayTask(task);
  const cardAccentColor = isEvent
    ? categories[task.category]?.color || "var(--accent-active)"
    : projects.find((p) => String(p.id) === String(task.projectId || ""))?.color || "var(--accent-active)";
  const isPlacementArmed = placementPreview?.taskId === task.id;
  const scheduleSummary = candidateScheduleSummary(task, focusDate);
  const returnedSchedule = candidateReturnedScheduleSummary(task);
  const isOverdueCandidate = overdue > 0 || Boolean(returnedSchedule);
  const hasSubtasks = (task.subtasks || []).length > 0;
  const displayTitle = task.title.trimStart();
  const isMoreOpen = openPanel === "more";
  const recurrenceChoices = recurrenceOptions(lang);
  const relativeScheduleOptions = candidateRelativeScheduleOptions(focusDate, lang);
  const overdueDisplayTime = returnedSchedule
    ? `${formatCandidateDate(returnedSchedule.date, lang)} ${returnedSchedule.startTime}`
    : formatCandidateDate(task.dueDate, lang);
  const quickScheduleTime = placementPreview?.taskId === task.id ? placementPreview.startTime : returnedSchedule?.startTime || "09:00";
  const quickScheduleOptions = candidateQuickScheduleOptions(focusDate, lang, quickScheduleTime);
  const scheduleFocusTarget: CandidateScheduleSummary | null = returnedSchedule || (placementPreview?.taskId === task.id
    ? { date: placementPreview.date, startTime: placementPreview.startTime, label: `${placementPreview.date} ${placementPreview.startTime}` }
    : null);
  const suggestedProject = !task.projectId && !task.aiInference?.project?.userOverridden && (task.aiInference?.project?.confidence || 0) >= 0.45
    ? projects.find((project) => project.id === task.aiInference?.project?.projectId)
    : undefined;

  useEffect(() => {
    setDraftDueDate(task.dueDate || focusDate);
    setDurationDraft(String(Math.round((task.estimatedHours || 0.5) * 60)));
    setMorePopover(null);
    setDeleteConfirm(false);
    setRecurrenceDraft({
      mode: task.recurrence?.mode || "flexible",
      frequency: task.recurrence?.frequency || "weekly",
      startDate: task.recurrence?.startDate || task.dueDate || focusDate,
      startTime: task.recurrence?.startTime || "09:00",
      durationMinutes: task.recurrence?.durationMinutes || Math.max(Math.round((task.estimatedHours || 0.5) * 60), 30),
      endDate: task.recurrence?.endDate,
      count: task.recurrence?.count,
    });
  }, [focusDate, task]);

  useEffect(() => {
    if (wasPlacementArmedRef.current && !isPlacementArmed) setSchedulePanelOpen(false);
    wasPlacementArmedRef.current = isPlacementArmed;
  }, [isPlacementArmed]);

  useLayoutEffect(() => {
    if (!schedulePanelOpen || !schedulePanelRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = schedulePanelRef.current;
      const list = panel?.closest<HTMLElement>(".df-candidate-list");
      if (!panel || !list) return;
      const overflow = panel.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom + 8;
      if (overflow > 0) list.scrollTop += overflow;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [schedulePanelOpen]);

  useEffect(() => {
    if (!deleteConfirm) return;
    const timer = window.setTimeout(() => setDeleteConfirm(false), 4000);
    return () => window.clearTimeout(timer);
  }, [deleteConfirm]);

  const stop = (event: React.MouseEvent) => event.stopPropagation();
  const previewPlacement = () => {
    if (placementHoverTimerRef.current !== null) window.clearTimeout(placementHoverTimerRef.current);
    placementHoverTimerRef.current = null;
    if (!isPlacementArmed) onStartPlacementPreview();
  };
  const queuePlacementPreview = () => {
    if (placementHoverTimerRef.current !== null) window.clearTimeout(placementHoverTimerRef.current);
    placementHoverTimerRef.current = window.setTimeout(() => {
      placementHoverTimerRef.current = null;
      if (!isPlacementArmed) onStartPlacementPreview();
    }, PLACEMENT_PREVIEW_HOVER_DELAY_MS);
  };
  const cancelQueuedPlacementPreview = () => {
    if (placementHoverTimerRef.current !== null) window.clearTimeout(placementHoverTimerRef.current);
    placementHoverTimerRef.current = null;
  };
  const renderPlacementLocateAction = () => isPlacementArmed && placementPreview && <button type="button" className="df-candidate-locate-action" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
    event.stopPropagation();
    if (isPlacementLocated) {
      onReturnFromPlacementLocation?.();
      return;
    }
    onLocatePlacement?.({ date: placementPreview.date, startTime: placementPreview.startTime, label: `${placementPreview.date} ${placementPreview.startTime}` });
  }}>{isPlacementLocated ? (lang === "zh" ? "返回" : "Back") : (lang === "zh" ? "定位" : "Locate")}</button>;
  useEffect(() => cancelQueuedPlacementPreview, []);
  const toggleSchedulePanel = (event: React.MouseEvent) => {
    event.stopPropagation();
    cancelQueuedPlacementPreview();
    setPopoverOpen(null);
    setMorePopover(null);
    const next = !schedulePanelOpen;
    setSchedulePanelOpen(next);
    if (next && !isPlacementArmed) onStartPlacementPreview();
    if (!next && isPlacementArmed) onCancelPlacementPreview();
  };
  const commitDuration = (minutes: number) => {
    const next = Math.max(SLOT_MINUTES, Math.min(1440, Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES));
    onQuickDuration(next);
    setDurationDraft(String(next));
    setPopoverOpen(null);
  };

  return (
    <>
      <TaskBlock
        as="article"
        variant="candidate"
        appearance="calm"
        priority={taskBlockPriorityFor(task.priority)}
        checked={task.completed && !isEvent}
        selected={Boolean(openPanel || schedulePanelOpen || isPlacementArmed)}
        dragState={dragState}
        projectColor={cardAccentColor}
        className={`df-task-card ${isOverdueCandidate && !isEvent ? "overdue" : ""} ${task.completed && !isEvent ? "completed" : ""} ${openPanel || schedulePanelOpen ? "expanded" : ""} ${isMoreOpen ? "more-open" : ""} ${isPlacementArmed ? "placement-armed" : ""} ${isEvent ? "is-event" : ""}`}
        dataAttrs={{ "placement-card": task.id, kind: isEvent ? "event" : "task" }}
        onPointerDown={isEvent ? undefined : onPointerDragStart}
        onMouseLeave={isOverdueCandidate && !isEvent ? () => {
          cancelQueuedPlacementPreview();
          if (isPlacementArmed && !isPlacementLocated && !schedulePanelOpen) onCancelPlacementPreview();
        } : undefined}
        onClick={onClick}
        title={demo ? undefined : compact ? (lang === "zh" ? "长按后拖到时间轴排程" : "Long press, then drag to schedule") : t(lang, "taskCard.dragHint")}
      >
        <TaskRecurrenceIndicator recurrence={task.recurrence} lang={lang} />
        <TaskBlockRow className={`df-candidate-row${scheduleSummary ? " df-candidate-summary-row" : ""}`}>
          {!isEvent && <TaskCheckbox
            checked={task.completed}
            tone={normalizeTaskCheckTone(task)}
            priority={task.priority}
            title={task.completed ? t(lang, "taskCard.markIncomplete") : t(lang, "taskCard.markComplete")}
            onClick={(event) => { event.stopPropagation(); onToggleDone(); }}
          >
            {task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}
          </TaskCheckbox>}
          {isEvent ? <span className="df-task-block-check df-candidate-kind" aria-hidden="true" /> : null}
          <TaskBlockContent className="df-candidate-main" title={displayTitle}>
            {isEvent ? <span className="df-candidate-kind">EVENT</span> : null}
          </TaskBlockContent>
          {suggestedProject && <button type="button" className="df-ai-project-suggestion" title={lang === "zh" ? `建议归入「${suggestedProject.title}」` : `Suggested project: ${suggestedProject.title}`} onClick={(event) => { event.stopPropagation(); onProjectChange(suggestedProject.id); }}>↗ {suggestedProject.title}</button>}

          {!isEvent && <TaskBlockDuration>
            {scheduleSummary ? <button type="button" className="df-candidate-schedule-link" title={lang === "zh" ? `跳转到时间轴：${scheduleSummary.date} ${scheduleSummary.startTime}` : `Show on timeline: ${scheduleSummary.date} ${scheduleSummary.startTime}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onFocusSchedule?.(scheduleSummary); }}>{scheduleSummary.label}</button>
              : isOverdueCandidate ? <button type="button" className={`df-overdue-time${isPlacementArmed ? " is-previewing" : ""}`} title={lang === "zh" ? "原安排时间保持不变；悬停可在时间轴预览建议位置" : "Keeps the original time; hover to preview a suggestion on the timeline"} onMouseEnter={queuePlacementPreview} onMouseLeave={cancelQueuedPlacementPreview} onBlur={cancelQueuedPlacementPreview} onFocus={previewPlacement} onClick={toggleSchedulePanel}>
                <UiCalendarClockIcon size={15} />
                <span>{overdueDisplayTime}</span>
              </button>
              : <button ref={durationTriggerRef} className="df-duration-pill" title={t(lang, "taskCard.adjustDuration")} aria-expanded={popoverOpen === "duration"} onClick={(event) => { event.stopPropagation(); setPopoverOpen((current) => current === "duration" ? null : "duration"); }}>{formatDuration(task.estimatedHours || 0.5)}</button>}
          </TaskBlockDuration>}

          {!isEvent && <TaskActions>
            {!scheduleSummary && !isOverdueCandidate && <div className="df-candidate-schedule-actions" onMouseLeave={() => { cancelQueuedPlacementPreview(); if (isPlacementArmed && !isPlacementLocated && !schedulePanelOpen) onCancelPlacementPreview(); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { cancelQueuedPlacementPreview(); if (isPlacementArmed && !isPlacementLocated && !schedulePanelOpen) onCancelPlacementPreview(); } }}>
              <IconButton className={`df-icon-button icon-schedule${schedulePanelOpen ? " is-active" : ""}`} icon={<UiCalendarClockIcon size={18} />} label={t(lang, "taskCard.openScheduling")} aria-expanded={schedulePanelOpen} onMouseEnter={queuePlacementPreview} onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) previewPlacement(); }} onClick={toggleSchedulePanel} />
              {renderPlacementLocateAction()}
            </div>}
            {isOverdueCandidate && !scheduleSummary && isPlacementArmed && <div className="df-candidate-schedule-actions" onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !isPlacementLocated && !schedulePanelOpen) onCancelPlacementPreview();
            }}>{renderPlacementLocateAction()}</div>}
            {!demo && !isPlacementArmed && <button className={`df-icon-button ${isMoreOpen ? "icon-collapse" : "icon-expand"}`} title={isMoreOpen ? t(lang, "taskCard.collapseMore") : t(lang, "taskCard.expandMore")} aria-label={isMoreOpen ? t(lang, "taskCard.collapseMore") : t(lang, "taskCard.expandMore")} aria-expanded={isMoreOpen} onClick={(event) => { event.stopPropagation(); setPopoverOpen(null); setMorePopover(null); setSchedulePanelOpen(false); setOpenPanel((current) => current === "more" ? null : "more"); }}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{isMoreOpen ? <path d="M5 12l5-5 5 5" /> : <path d="M5 8l5 5 5-5" />}</svg></button>}
          </TaskActions>}
        </TaskBlockRow>
        {!isEvent && onToggleSubtask && hasSubtasks && <TaskSubtaskShelf
          label={lang === "zh" ? "子任务" : "Subtasks"}
          progress={`${countDoneSubtasks(task.subtasks)}/${countSubtasks(task.subtasks)}`}
          expanded={subtasksOpen}
          expandLabel={lang === "zh" ? "展开子任务" : "Expand subtasks"}
          collapseLabel={lang === "zh" ? "收起子任务" : "Collapse subtasks"}
          onToggle={() => setSubtasksOpen((value) => !value)}
        />}

        {!isEvent && onToggleSubtask && hasSubtasks && subtasksOpen && <div className="df-candidate-subtasks">{(task.subtasks || []).map((subtask) => <CandidateSubtaskItem key={subtask.id} subtask={subtask} lang={lang} onToggleSubtask={onToggleSubtask} onSubtaskDragStart={onSubtaskDragStart} />)}</div>}

        {schedulePanelOpen && (isOverdueCandidate ? <div ref={schedulePanelRef} className="df-candidate-schedule-panel is-overdue-actions" onClick={stop}>
          <button type="button" className="df-candidate-schedule-primary" disabled={!scheduleFocusTarget} onClick={() => scheduleFocusTarget && onFocusSchedule?.(scheduleFocusTarget)}><span aria-hidden="true">→</span><span>{lang === "zh" ? "显示到时间轴" : "Show in schedule"}</span></button>
          <div className="df-candidate-schedule-tools">
            <button type="button" onClick={() => { onMarkUnfinished(); setSchedulePanelOpen(false); onCancelPlacementPreview(); }}><UiCalendarCheckIcon size={16} /><span>{term(lang, "incomplete")}</span></button>
            <button type="button" onClick={() => { onUnschedule(); setSchedulePanelOpen(false); onCancelPlacementPreview(); }}><UiCalendarClockIcon size={16} /><span>{term(lang, "unschedule")}</span></button>
          </div>
          <div className="df-candidate-schedule-choices">{quickScheduleOptions.map((option) => <button key={option.date} type="button" onClick={() => { onScheduleDate(option.date); setSchedulePanelOpen(false); }}><span>{option.label}</span></button>)}</div>
          <button ref={scheduleMoreTriggerRef} type="button" className="df-candidate-schedule-more" title={lang === "zh" ? "更多安排日期" : "More schedule dates"} aria-label={lang === "zh" ? "更多安排日期" : "More schedule dates"} aria-expanded={morePopover === "schedule-more"} onClick={() => setMorePopover((current) => current === "schedule-more" ? null : "schedule-more")}><span aria-hidden="true">•••</span></button>
        </div> : <div ref={schedulePanelRef} className="df-candidate-schedule-panel" onClick={stop}>
          {isPlacementArmed && placementPreview && <button type="button" className="df-candidate-schedule-primary" onClick={() => { onConfirmPlacementPreview(); setSchedulePanelOpen(false); }}><UiCalendarCheckIcon size={17} /><span>{lang === "zh" ? `安排到 ${formatCandidateDate(placementPreview.date, lang)} ${placementPreview.startTime}` : `Schedule at ${formatCandidateDate(placementPreview.date, lang)} ${placementPreview.startTime}`}</span></button>}
          {!demo && <div className="df-candidate-schedule-tools">
            <button ref={deadlineTriggerRef} type="button" aria-expanded={popoverOpen === "deadline"} onClick={() => setPopoverOpen((current) => current === "deadline" ? null : "deadline")}><UiFlagIcon size={15} /><span>{lang === "zh" ? "截止日期" : "Due date"}</span></button>
            <button type="button" onClick={() => setRepeatOpen(true)}><UiReturnIcon size={15} /><span>{t(lang, "drawer.setRepeat")}</span></button>
          </div>}
          {placementChoices.length > 0 && <div className="df-candidate-schedule-choices">{placementChoices.slice(0, 4).map((choice) => <button key={`${choice.date}-${choice.startTime}`} type="button" onClick={() => { onConfirmPlacementChoice(choice); setSchedulePanelOpen(false); }}><span>{formatCandidateDate(choice.date, lang)}</span><strong>{choice.startTime}</strong></button>)}</div>}
          <button ref={scheduleMoreTriggerRef} type="button" className="df-candidate-schedule-more" title={lang === "zh" ? "更多安排日期" : "More schedule dates"} aria-label={lang === "zh" ? "更多安排日期" : "More schedule dates"} aria-expanded={morePopover === "schedule-more"} onClick={() => setMorePopover((current) => current === "schedule-more" ? null : "schedule-more")}><span aria-hidden="true">•••</span></button>
        </div>)}

        {isMoreOpen && <div className="df-candidate-more-toolbar" onClick={stop}>
          {onMoveToPlanning && <button type="button" title={lang === "zh" ? "移回规划" : "Move back to Planning"} onClick={() => { onMoveToPlanning(); setOpenPanel(null); }}><UiReturnIcon size={18} /><span>{lang === "zh" ? "移回规划" : "Planning"}</span></button>}
          <button ref={priorityTriggerRef} type="button" title={lang === "zh" ? "设置优先级" : "Set priority"} aria-expanded={morePopover === "priority"} onClick={() => setMorePopover((current) => current === "priority" ? null : "priority")}><UiFlagIcon size={18} /><span>{lang === "zh" ? "优先级" : "Priority"}</span></button>
          <button ref={projectTriggerRef} type="button" title={t(lang, "drawer.assignProject")} aria-expanded={morePopover === "project"} onClick={() => setMorePopover((current) => current === "project" ? null : "project")}><UiFolderInputIcon size={18} /><span>{lang === "zh" ? "项目" : "Project"}</span></button>
          <button type="button" className={`danger-lite${deleteConfirm ? " is-confirming" : ""}`} title={deleteConfirm ? (lang === "zh" ? "再次点击确认删除" : "Click again to delete") : t(lang, "taskCard.delete")} onClick={() => { if (deleteConfirm) onDelete(); else setDeleteConfirm(true); }}><UiTrashIcon size={18} /><span>{deleteConfirm ? (lang === "zh" ? "确认删除" : "Confirm") : t(lang, "taskCard.delete")}</span></button>
        </div>}
      </TaskBlock>

      <AnchoredNarrowMenu open={popoverOpen === "duration"} anchorRef={durationTriggerRef} onClose={() => setPopoverOpen(null)} placement="below" label={t(lang, "taskCard.adjustDuration")} className="df-candidate-duration-menu">
        <label><span>{lang === "zh" ? "分钟" : "Minutes"}</span><input type="number" min={SLOT_MINUTES} max={1440} step={SLOT_MINUTES} value={durationDraft} onChange={(event) => setDurationDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") commitDuration(Number(durationDraft)); }} /></label>
        {DURATION_OPTIONS.map((minutes) => <button key={minutes} type="button" className={Math.round((task.estimatedHours || 0.5) * 60) === minutes ? "active" : ""} onClick={() => commitDuration(minutes)}>{formatMinutes(minutes)}</button>)}
      </AnchoredNarrowMenu>

      <AnchoredNarrowMenu open={popoverOpen === "deadline"} anchorRef={deadlineTriggerRef} onClose={() => setPopoverOpen(null)} label={lang === "zh" ? "设置截止日期" : "Set due date"} className="df-candidate-deadline-menu">
        <label><input type="date" value={draftDueDate} onChange={(event) => setDraftDueDate(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { onSaveDueDate(draftDueDate); setPopoverOpen(null); } }} /></label>
        <button type="button" onClick={() => { onSaveDueDate(draftDueDate); setPopoverOpen(null); }}>{lang === "zh" ? "保存日期" : "Save date"}</button>
        <button type="button" onClick={() => { onSaveDueDate(""); setPopoverOpen(null); }}>{lang === "zh" ? "清除截止日期" : "Clear due date"}</button>
      </AnchoredNarrowMenu>

      <AnchoredNarrowMenu open={morePopover === "schedule-more"} anchorRef={scheduleMoreTriggerRef} onClose={() => setMorePopover(null)} label={lang === "zh" ? "更多安排日期" : "More schedule dates"}>
        {relativeScheduleOptions.map((option) => <button key={option.date} type="button" onClick={() => { onScheduleDate(option.date); setMorePopover(null); setSchedulePanelOpen(false); }}><UiCalendarClockIcon size={15} /><span>{option.label}</span></button>)}
      </AnchoredNarrowMenu>

      <AnchoredNarrowMenu open={morePopover === "priority"} anchorRef={priorityTriggerRef} onClose={() => setMorePopover(null)} label={lang === "zh" ? "设置优先级" : "Set priority"}>
        {(["high", "medium", "low", null] as const).map((priority) => {
          const iconClass = priority === "high" ? "df-priority-high" : priority === "medium" ? "df-priority-medium" : priority === "low" ? "df-priority-low" : "df-priority-none";
          return <button key={priority || "none"} type="button" className={task.priority === priority ? "active" : ""} onClick={() => { onMetaUpdate?.({ priority }); setMorePopover(null); }}><UiFlagIcon className={iconClass} size={16} /><span>{priority === "high" ? (lang === "zh" ? "高" : "High") : priority === "medium" ? (lang === "zh" ? "中" : "Medium") : priority === "low" ? (lang === "zh" ? "低" : "Low") : (lang === "zh" ? "无" : "None")}</span></button>;
        })}
      </AnchoredNarrowMenu>

      <AnchoredNarrowMenu open={morePopover === "project"} anchorRef={projectTriggerRef} onClose={() => setMorePopover(null)} label={t(lang, "drawer.assignProject")}>
        <button type="button" className={!task.projectId ? "active" : ""} onClick={() => { onProjectChange(""); setMorePopover(null); }}>{t(lang, "taskCard.unassigned")}</button>
        {projects.map((project) => <button key={project.id} type="button" className={String(project.id) === String(task.projectId || "") ? "active" : ""} onClick={() => { onProjectChange(project.id); setMorePopover(null); }}><span className="df-menu-project-dot" style={{ background: project.color }} /># {project.title}</button>)}
      </AnchoredNarrowMenu>

      {repeatOpen && createPortal(
        <div className="df-modal-backdrop" onClick={() => setRepeatOpen(false)}>
          <div className="df-repeat-modal" role="dialog" aria-modal="true" aria-label={t(lang, "drawer.setRepeat")} onClick={(event) => event.stopPropagation()}>
            <div className="df-repeat-modal-head"><h3>{lang === "zh" ? "设置重复规则" : "Set repeat rule"}</h3><CloseButton label={lang === "zh" ? "关闭" : "Close"} onClick={() => setRepeatOpen(false)} /></div>
            <div className="df-repeat-modal-body">
              <label className={`df-repeat-option ${recurrenceDraft.mode === "flexible" ? "selected" : ""}`}><input type="radio" name={`recurrence-mode-${task.id}`} checked={recurrenceDraft.mode === "flexible"} onChange={() => setRecurrenceDraft((current) => ({ ...current, mode: "flexible" }))} /><div><strong>{lang === "zh" ? "灵活重复" : "Flexible repeat"}</strong><span>{lang === "zh" ? "每次重复任务回到候选区，等待单独安排。" : "Each occurrence returns to Candidates for individual scheduling."}</span></div></label>
              <label className={`df-repeat-option ${recurrenceDraft.mode === "scheduled" ? "selected" : ""}`}><input type="radio" name={`recurrence-mode-${task.id}`} checked={recurrenceDraft.mode === "scheduled"} onChange={() => setRecurrenceDraft((current) => ({ ...current, mode: "scheduled" }))} /><div><strong>{lang === "zh" ? "固定重复" : "Fixed repeat"}</strong><span>{lang === "zh" ? "每次重复按固定日期与时间出现在时间轴。" : "Each occurrence appears on the timeline at a fixed date and time."}</span></div></label>
              {recurrenceDraft.mode === "flexible" ? <div className="df-repeat-form"><label><span>{lang === "zh" ? "开始重复于" : "Repeat from"}</span><input type="date" value={recurrenceDraft.startDate || focusDate} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, startDate: event.target.value }))} /></label><label><span>{t(lang, "drawer.frequency")}</span><select value={recurrenceDraft.frequency} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, frequency: event.target.value as RecurrenceFrequency }))}>{recurrenceChoices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
                : <div className="df-repeat-form"><label><span>{t(lang, "drawer.startDate")}</span><input type="date" value={recurrenceDraft.startDate || focusDate} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, startDate: event.target.value }))} /></label><label><span>{t(lang, "drawer.startTime")}</span><input type="time" value={recurrenceDraft.startTime || "09:00"} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, startTime: event.target.value }))} /></label><label><span>{t(lang, "drawer.duration")}</span><select value={recurrenceDraft.durationMinutes || 30} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}</select></label><label><span>{t(lang, "drawer.frequency")}</span><select value={recurrenceDraft.frequency} onChange={(event) => setRecurrenceDraft((current) => ({ ...current, frequency: event.target.value as RecurrenceFrequency }))}>{recurrenceChoices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>}
            </div>
            <div className="df-repeat-modal-actions"><button className="primary" onClick={() => { onSaveRecurrence(recurrenceDraft.frequency === "none" ? undefined : recurrenceDraft); setRepeatOpen(false); }}>{lang === "zh" ? "保存重复规则" : "Save repeat rule"}</button><button onClick={() => setRepeatOpen(false)}>{lang === "zh" ? "关闭" : "Close"}</button></div>
          </div>
        </div>,
        document.getElementById("df-portal-target") || document.body,
      )}
    </>
  );
}

export function formatMinutes(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours}h${rest}m` : `${hours}h`;
}

export function formatDuration(hours: number) {
  return formatMinutes(Math.round(hours * 60));
}

export function ReturnedToPlanIcon({ color }: { color?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" style={color ? { color } : undefined}>
      {/* Soft background circle using project color at low opacity */}
      <circle cx="11.5" cy="11.5" r="3.5" fill="currentColor" opacity="0.14" />
      {/* Three horizontal bars — thick, solid */}
      <rect x="1.5" y="2.5" width="9" height="2.2" rx="1.1" fill="currentColor" opacity="0.95" />
      <rect x="1.5" y="6.2" width="7" height="2.2" rx="1.1" fill="currentColor" opacity="0.72" />
      <rect x="1.5" y="9.9" width="5" height="2.2" rx="1.1" fill="currentColor" opacity="0.50" />
      {/* Checkmark in bottom-right */}
      <path d="M10.2 11.5L11.2 12.5L13 10.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function TimeBlock({ task, engagementEnabled, preview, projectName, projects, hovered, showResizeHint = false, projectInteractive = true, onHover, onSelect, onEdit, onToggleDone, onTaskUpdate, onProjectChange, onProjectColorChange, onCreateProject, onDragStart, onResizeStart, resizeEdges, extraStyle, onAcceptPreview, onCancelPreview, viewMode, lang, dayStartHour = 0, hourHeight = HOUR_HEIGHT, dragState }: { task: Task; engagementEnabled?: boolean; preview: ResizePreview; projectName: string; projects: Project[]; hovered: boolean; showResizeHint?: boolean; projectInteractive?: boolean; onHover: (id: string) => void; onSelect: () => void; onEdit: () => void; onToggleDone: () => void; onTaskUpdate?: (patch: Partial<Task>) => void; onProjectChange: (projectId: string) => void; onProjectColorChange: (projectId: string, color: string) => void; onCreateProject: (title: string) => void; onDragStart: (event: React.PointerEvent) => void; onResizeStart: (event: React.PointerEvent, edge: "start" | "end") => void; resizeEdges?: { start: boolean; end: boolean }; extraStyle?: CSSProperties; onAcceptPreview?: () => void; onCancelPreview?: () => void; viewMode?: "daily" | "3day" | "weekly"; lang: Language; dayStartHour?: number; hourHeight?: number; dragState?: TaskBlockDragState }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const isWeekView = viewMode === "weekly";
  const start = preview?.start || task.scheduledStart || "09:00";
  const computedDuration = taskDuration(task);
  let end = preview?.end || task.scheduledEnd || addMinutes(start, computedDuration);

  const endMinutesValue = timeToMinutes(end);
  const startMinutesValue = timeToMinutes(start);
  // Cross-midnight spans (e.g. 23:30→00:30) must read as 60m, not -1380.
  // `clockTimeSpanMinutes` treats end ≤ start as next-day; we only fall back to the
  // task's estimated duration when the stored end is missing or >24h (bad data).
  let calculatedDurationMinutes = clockTimeSpanMinutes(start, end);

  if (calculatedDurationMinutes > 24 * 60) {
    end = addMinutes(start, computedDuration);
    calculatedDurationMinutes = computedDuration;
  }

  const top = timeBlockTop(start, dayStartHour, hourHeight);
  const minSlotHeight = hourHeight * SLOT_MINUTES / 60;
  const height = Math.max(timeBlockHeight(start, end, dayStartHour, hourHeight), minSlotHeight);
  const durationMinutes = calculatedDurationMinutes;
  const startMinutes = startMinutesValue;
  const endMinutes = timeToMinutes(end);
  const next = extractNextAction(task.notes);
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  const isEvent = isEventDisplayTask(task);
  const isExternalEvent = isExternalCalendarDisplayTask(task);
  const [badgeWidth, setBadgeWidth] = useState(0);
  useLayoutEffect(() => {
    if (hovered && projectInteractive && projectBtnRef.current) {
      setBadgeWidth(projectBtnRef.current.offsetWidth);
    } else if (!hovered) {
      setBadgeWidth(0);
    }
  }, [hovered, projectInteractive]);
  const isPreview = Boolean(extraStyle && (extraStyle as Record<string, unknown>)["--df-preview" as string]);
  const currentRecordStatus =
    task.executionStatus ||
    ((task.timelineRecords || []).some((record) => record.executionStatus === "scheduled")
      ? "scheduled"
      : undefined);
  const isReturnedUnfinished = currentRecordStatus === "returned_unfinished";
  const isSkipped = currentRecordStatus === "skipped";
  const isRecurring = Boolean(
    task.recurrence &&
    task.recurrence.frequency !== "none" &&
    currentRecordStatus === "scheduled" &&
    !isReturnedUnfinished &&
    !isPreview
  );
  const recurringTextColor = isLightColor(stripeColor) ? "#10212F" : "#F8FBFF";
  const canResize = !isExternalEvent && (isEvent || !hasRecurringRule(task));
  const eventId = task.id;
  const sizeClass = height < 56 ? "short" : height >= 120 ? "tall" : "normal";
  const originalStart = task.scheduledStart || "09:00";
  const originalDate = task.scheduledDate || preview?.startDate || "1970-01-01";
  const suppliedTop = typeof extraStyle?.top === "number" ? extraStyle.top : null;
  const resolvedTop = preview && suppliedTop !== null
    ? resizedBlockTop(suppliedTop, originalDate, originalStart, preview.startDate || originalDate, start, hourHeight)
    : suppliedTop ?? top;

  return (
    <TaskBlock lang={lang} engagement={engagementEnabled && !isEvent && task.completed ? normalizeEngagement(task.engagement) : undefined} as="div" variant="scheduled" appearance="calm" priority={taskBlockPriorityFor(task.priority)} density={height < 56 ? "compact" : "normal"} checked={!isEvent && task.completed} selected={Boolean(showResizeHint || projectOpen || preview)} dragState={dragState} projectColor={stripeColor} className={`df-time-block priority-${task.priority} ${!isEvent && task.completed ? "completed" : ""} ${isEvent ? "is-event" : ""} ${isExternalEvent ? "is-external-calendar" : ""} ${isReturnedUnfinished ? "returned-unfinished" : ""} ${isSkipped ? "skipped" : ""} ${preview ? "resizing" : ""} ${showResizeHint ? "show-resize-hint" : ""} ${projectOpen ? "project-open" : ""} ${isPreview ? "df-time-block-preview" : ""} ${isWeekView ? "df-time-block-week" : ""} ${isRecurring ? "recurring" : ""}`} dataAttrs={{ kind: isEvent ? "event" : "task", preview: isPreview ? "true" : undefined, "view-mode": viewMode, "schedule-size": sizeClass, "timeline-event-id": eventId, "task-id": task.id, readonly: isExternalEvent ? "true" : undefined }} style={{ ...extraStyle, top: resolvedTop, height, bottom: "auto", "--badge-width": badgeWidth ? `${badgeWidth}px` : "0px", "--recurring-text": recurringTextColor } as CSSProperties} onMouseEnter={() => { if (projectInteractive) onHover(task.id); }} onMouseLeave={() => {
      onHover("");
    }} onPointerDown={isExternalEvent || isReturnedUnfinished || isSkipped ? undefined : onDragStart} onClick={(event) => { event.stopPropagation(); onSelect(); }} onDoubleClick={projectInteractive ? (event) => { event.stopPropagation(); onEdit(); } : undefined} title={isExternalEvent ? (lang === "zh" ? "外部日历（只读）" : "External calendar (read-only)") : isReturnedUnfinished ? t(lang, "timeBlock.returnedHint") : undefined}>
      {isPreview && <span className="df-preview-badge">{t(lang, "timeBlock.pending")}</span>}
      <TaskRecurrenceIndicator recurrence={task.recurrence} lang={lang} />
      {canResize && (hovered || showResizeHint || preview) && resizeEdges?.start !== false && <button type="button" className="df-resize-dot top" aria-label={t(lang, "timeBlock.adjustStart")} onPointerDown={(event) => onResizeStart(event, "start")} onClick={(event) => event.stopPropagation()} />}
      <div className="df-time-card-shell">
      <TaskBlockRow className="df-time-card-row" align="start">
        {isEvent ? (
          <span className="df-task-block-check df-time-card-event-mark" title={t(lang, "timeBlock.eventTooltip")} aria-label={t(lang, "timeBlock.eventTooltip")} />
        ) : (
          <TaskCheckbox checked={task.completed} tone={normalizeTaskCheckTone(task)} priority={task.priority} returned={isReturnedUnfinished || isSkipped} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
            event.stopPropagation();
            onToggleDone();
          }} ariaLabel={task.completed ? t(lang, "timeBlock.markIncomplete") : t(lang, "timeBlock.markComplete")}>
            {task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : isSkipped ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l6 6M9 3L3 9" /></svg> : isReturnedUnfinished ? <ReturnedToPlanIcon /> : ""}
          </TaskCheckbox>
        )}
        <TaskBlockContent className="df-time-card-main" title={task.title}>
          {isEvent ? <span className="df-event-kind-label">{isExternalEvent ? (lang === "zh" ? "外部日历" : "External") : t(lang, "form.event")}</span> : null}
          {next && <span className="df-next df-time-card-next">{t(lang, "timeBlock.nextStep")}：{next}</span>}
        </TaskBlockContent>
      </TaskBlockRow>
      </div>
      {isPreview && (
        <span className="df-preview-actions">
          <button className="df-preview-action accept" onClick={(e) => { e.stopPropagation(); onAcceptPreview?.(); }} aria-label={t(lang, "timeBlock.adopt")} title={t(lang, "timeBlock.adopt")}>✓</button>
          <CloseButton className="df-preview-action cancel" onClick={(e) => { e.stopPropagation(); onCancelPreview?.(); }} label={t(lang, "timeBlock.cancel")} />
        </span>
      )}
      {!isEvent && (hovered || showResizeHint) && <span className="df-block-project-wrap" onMouseDown={(event) => { if (projectInteractive) event.stopPropagation(); }} onClick={(event) => { if (projectInteractive) event.stopPropagation(); }}>
        {projectInteractive ? <button ref={projectBtnRef} className="df-block-project" title={projectName} onClick={(event) => {
          event.stopPropagation();
          setProjectOpen((open) => !open);
        }}># {projectName}</button> : <span className="df-block-project" title={projectName}># {projectName}</span>}
      </span>}
      {canResize && (hovered || showResizeHint || preview) && resizeEdges?.end !== false && <button type="button" className="df-resize-dot bottom" aria-label={t(lang, "timeBlock.adjustEnd")} onPointerDown={(event) => onResizeStart(event, "end")} onClick={(event) => event.stopPropagation()} />}
      {projectOpen && projectBtnRef.current && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setProjectOpen(false)}>
          <div className="df-project-popover-portal" onClick={(event) => event.stopPropagation()} style={{
            position: 'fixed',
            top: projectBtnRef.current.getBoundingClientRect().bottom + 8,
            left: Math.max(8, projectBtnRef.current.getBoundingClientRect().right - 220),
            zIndex: 99999,
            width: 220,
            maxHeight: 260,
            overflow: 'auto',
            display: 'grid',
            gap: '4px',
            padding: '10px',
            border: '1px solid color-mix(in srgb, var(--accent-active) 26%, var(--border-soft))',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-soft)',
          } as CSSProperties}>
            <button style={{ textAlign: 'left', border: 0, background: 'transparent', padding: '7px 8px', color: 'var(--df-text)' }} onClick={() => { onProjectChange(""); setProjectOpen(false); }}>{t(lang, "timeBlock.unassigned")}</button>
            {projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { onProjectChange(project.id); setProjectOpen(false); }} onColorChange={(color) => onProjectColorChange(project.id, color)} />)}
            <div className="df-project-create-line"><input value={newProjectTitle} placeholder="新项目名" onChange={(event) => setNewProjectTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); } }} /><button onClick={() => { onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); }}>✓</button></div>
          </div>
        </div>,
        document.querySelector('.df-app') || document.body
      )}
    </TaskBlock>
  );
}

export function PreviewBlock({ task, date, startTime, duration, onConfirm, lang, extraStyle, dayStartHour = 0, hourHeight = HOUR_HEIGHT }: { task?: Task; date?: string; startTime: string; duration: number; onConfirm?: () => void; lang?: Language; extraStyle?: CSSProperties; dayStartHour?: number; hourHeight?: number }) {
  if (!task) return null;
  const top = timeBlockTop(startTime, dayStartHour, hourHeight);
  const endTime = addMinutes(startTime, duration);
  const height = Math.max(timeBlockHeight(startTime, endTime, dayStartHour, hourHeight), hourHeight * SLOT_MINUTES / 60);
  const color = categories[task.category]?.color || "#888";
  const isPlacementPreview = Boolean(extraStyle && (extraStyle as Record<string, unknown>)["--df-preview" as string]);
  const isEvent = isEventDisplayTask(task);
  const label = lang === "zh" ? `安排“${task.title}”到 ${date || ""} ${startTime}` : `Schedule “${task.title}” at ${date || ""} ${startTime}`;
  return <button type="button" className={`df-drop-preview ${isPlacementPreview ? "placement-preview" : ""} ${isEvent ? "is-event" : ""}`} data-kind={isEvent ? "event" : "task"} data-placement-preview-task={task.id} style={{ top, height, "--cat": color, ...extraStyle } as CSSProperties} aria-label={label} title={label} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onConfirm?.(); }}>
    <span className="df-placement-preview-icon" aria-hidden="true"><img src={PRODUCT_ICON_SRC} alt="" /><UiCalendarCheckIcon className="df-placement-preview-confirm-icon" size={16} /></span>
    <strong>{task.title}</strong>
    <span className="df-placement-preview-time">{startTime} · {formatMinutes(Math.round(duration))}</span>
  </button>;
}

export function ProjectColorPicker({ value, onChange, compact = false, presets = PROJECT_COLOR_PRESETS }: { value: string; onChange: (color: string) => void; compact?: boolean; presets?: string[] }) {
  return (
    <div className={`df-project-color-picker ${compact ? "compact" : ""}`}>
      {presets.map((color) => <button key={color} type="button" className={value === color ? "active" : ""} style={{ "--project-color": color } as CSSProperties} aria-label={color} onClick={() => onChange(color)} />)}
      <label className="df-project-color-custom" style={{ "--project-color": value } as CSSProperties}>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <span />
      </label>
    </div>
  );
}

export function ProjectChoice({ project, onChoose, onColorChange }: { project: Project; onChoose: () => void; onColorChange: (color: string) => void }) {
  const [colorOpen, setColorOpen] = useState(false);
  const color = project.color || categories[project.category].color;
  return (
    <div className="df-project-choice">
      <button type="button" onClick={onChoose}># {project.title}</button>
      <span className="df-project-color-menu" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="df-project-color-dot-button" aria-label={`${project.title} color`} onClick={() => setColorOpen((open) => !open)}><span className="df-project-color-dot" style={{ "--project-color": color } as CSSProperties} /></button>
        {colorOpen && <ProjectColorPicker value={color} onChange={(nextColor) => { onColorChange(nextColor); }} compact />}
      </span>
    </div>
  );
}

export function MobileSheetDismissHandle({ onDismiss, onCollapse, onExpand, collapsed = false, lang }: { onDismiss: () => void; onCollapse?: () => void; onExpand?: () => void; collapsed?: boolean; lang: Language }) {
  const gestureRef = useRef<{ pointerId: number; startY: number; startedAt: number; panel: HTMLElement } | null>(null);
  const finishGesture = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    const signedDistance = event.clientY - gesture.startY;
    const distance = Math.max(0, signedDistance);
    const velocity = distance / Math.max(1, performance.now() - gesture.startedAt);
    if (!cancelled && collapsed && signedDistance <= -54 && onExpand) {
      gesture.panel.classList.remove("is-sheet-dragging");
      gesture.panel.style.setProperty("--mobile-sheet-drag-y", "0px");
      onExpand();
      return;
    }
    if (!cancelled && (distance >= 88 || velocity >= 0.62) && onCollapse && !collapsed) {
      gesture.panel.classList.remove("is-sheet-dragging");
      gesture.panel.style.setProperty("--mobile-sheet-drag-y", "0px");
      onCollapse();
      return;
    }
    if (!cancelled && (distance >= 88 || velocity >= 0.62)) {
      gesture.panel.classList.remove("is-sheet-dragging");
      gesture.panel.classList.add("is-sheet-dismissing");
      gesture.panel.style.setProperty("--mobile-sheet-drag-y", "100dvh");
      window.setTimeout(onDismiss, 170);
      return;
    }
    gesture.panel.classList.remove("is-sheet-dragging");
    gesture.panel.style.setProperty("--mobile-sheet-drag-y", "0px");
  };
  return <button
    type="button"
    className="df-mobile-sheet-dismiss-handle"
    aria-label={lang === "zh" ? "下滑关闭" : "Swipe down to close"}
    onPointerDown={(event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const panel = event.currentTarget.parentElement;
      if (!panel) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      panel.classList.add("is-sheet-dragging");
      gestureRef.current = { pointerId: event.pointerId, startY: event.clientY, startedAt: performance.now(), panel };
    }}
    onPointerMove={(event) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const distance = event.clientY - gesture.startY;
      gesture.panel.style.setProperty("--mobile-sheet-drag-y", `${collapsed ? Math.max(-70, distance) : Math.max(0, distance)}px`);
    }}
    onPointerUp={(event) => finishGesture(event)}
    onPointerCancel={(event) => finishGesture(event, true)}
  />;
}

export function aiStepLabel(step: AiStep, lang: Language) {
  const labels: Record<string, [string, string]> = {
    workspace_overview: ["读取工作区概览", "Reading workspace overview"],
    search_workspace: ["搜索工作区", "Searching workspace"],
    list_tasks: ["读取任务", "Reading tasks"],
    list_projects: ["读取项目", "Reading projects"],
    list_habits: ["读取习惯", "Reading habits"],
    list_notes: ["读取笔记", "Reading notes"],
    list_templates: ["读取模板", "Reading templates"],
    list_memories: ["读取记忆", "Reading memories"],
    get_settings: ["读取设置", "Reading settings"],
    list_calendar: ["检查日历", "Checking calendar"],
    get_metrics: ["读取统计", "Reading metrics"],
    get_timer_status: ["读取计时器", "Reading timer"],
    list_integrations: ["检查外部日历", "Checking integrations"],
  };
  const pair = labels[step.label];
  return pair ? pair[lang === "zh" ? 0 : 1] : step.label;
}

const AiPanelModule = lazy(() => import("./AiPanel"));
export function AiPanel(props: React.ComponentProps<typeof AiPanelModule>) {
  return <Suspense fallback={<div className="df-loading-inline" role="status">{props.lang === "zh" ? "正在打开 Navo AI…" : "Opening Navo AI…"}</div>}><AiPanelModule {...props} /></Suspense>;
}

export function AttachmentCard({ attachment, referenced = false, onRemove }: { attachment: AiAttachmentSnapshot; referenced?: boolean; onRemove?: () => void }) {
  const ext = attachment.name.split(".").pop()?.toUpperCase() || "FILE";
  const size = attachment.size ? `${Math.max(attachment.size / 1024, 1).toFixed(0)} KB` : "";
  return <div className={`df-ai-attachment-card ${referenced ? "referenced" : ""} ${attachment.status}`}>
    <span className="df-ai-file-icon">{ext.slice(0, 4)}</span>
    <div><strong>{attachment.name}</strong><small>{referenced ? "引用附件" : attachment.statusText}{attachment.pageCount ? ` · ${attachment.pageCount} 页` : ""}{size ? ` · ${size}` : ""}</small>{referenced && attachment.summary ? <p>{attachment.summary}</p> : null}</div>
    {onRemove && <CloseButton onClick={onRemove} label="移除附件" />}
  </div>;
}

export function themeVars(settings: Settings, mode: "planning" | "execute") {
  const executeDefault = "#584D3D";
  const planningDefault = "#584D3D";
  const execute = normalizeHexColor(settings.executeAccentColor || executeDefault, executeDefault);
  const planning = normalizeHexColor(settings.planningAccentColor || planningDefault, planningDefault);
  const executeLight = isLightColor(execute);
  const planningLight = isLightColor(planning);
  const activeAccent = mode === "execute" ? execute : planning;
  const activeLight = mode === "execute" ? executeLight : planningLight;
  const { r, g, b } = hexToRgb(activeAccent);
  const isDark = settings.theme === "dark";
  // Timeline font scale: clamp to safe range, default 1
  const fontScale = Math.max(0.85, Math.min(1.3, settings.timelineFontScale ?? 1));
  if (isDark) {
    return {
      "--execute-primary": execute,
      "--execute-on-primary": executeLight ? "#111827" : "#FFFFFF",
      "--planning-primary": planning,
      "--planning-on-primary": planningLight ? "#111827" : "#FFFFFF",
      "--accent-active": "#A9A49B",
      "--accent-rgb": "169, 164, 155",
      "--accent-on": "#1A1B1D",
      "--bg-app": "#1B1B1B",
      "--bg-app-soft": "#1E1E1E",
      "--surface-main": "#202020",
      "--surface-raised": "#292929",
      "--surface-card": "#252525",
      "--text-main": "#D9D6CF",
      "--text-muted": "#B1AEA7",
      "--text-faint": "#898781",
      "--border-soft": "#555452",
      "--border-subtle": "#393939",
      "--shadow-soft": "0 18px 48px rgba(0,0,0,0.28)",
      "--shadow-hl": "none",
      "--header-bg": "rgba(27,27,27,0.96)",
      "--header-border": "#393939",
      "--header-fg": "#D9D6CF",
      "--header-fg-muted": "#B1AEA7",
      "--input-bg": "#202020",
      "--input-border": "#5B5955",
      "--timeline-paper": "#202020",
      "--timeline-font-scale": String(fontScale),
    } as CSSProperties;
  }
  return {
    "--execute-primary": execute,
    "--execute-on-primary": executeLight ? "#111827" : "#FFFFFF",
    "--planning-primary": planning,
    "--planning-on-primary": planningLight ? "#111827" : "#FFFFFF",
    "--accent-active": activeAccent,
    "--accent-rgb": `${r}, ${g}, ${b}`,
    "--accent-on": activeLight ? "#111827" : "#FFFFFF",
    "--bg-app": "#F8F7F3",
    "--bg-app-soft": "#F3F0E9",
    "--surface-main": "#F8F7F3",
    "--surface-raised": "#FCFBF8",
    "--surface-card": "#FFFFFF",
    "--text-main": "#27231E",
    "--text-muted": "#7B7062",
    "--text-faint": "#A69D92",
    "--border-soft": "#DED8D8",
    "--border-subtle": "#EBE6E8",
    "--shadow-soft": "0 12px 28px rgba(88,77,61,0.10)",
    "--shadow-hl": "none",
    "--header-bg": "rgba(248,247,243,0.92)",
    "--header-border": "rgba(88,77,61,0.14)",
    "--header-fg": "#584D3D",
    "--header-fg-muted": "#7B7062",
    "--input-bg": "#FCFBF8",
    "--input-border": "#DED8D8",
    "--timeline-paper": "#F8F7F3",
    "--timeline-font-scale": String(fontScale),
  } as CSSProperties;
}
