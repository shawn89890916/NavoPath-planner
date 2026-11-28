import { anchorPlacement, observeAnchor, viewportBounds } from "./motion/anchor";
import { isCalendarBackgroundVisible } from "./extensions/calendarBackgrounds";
import { blockingCalendarEvents } from "./utils/courseBackground";
import { useMobileSheetGesture } from "./useMobileSheetGesture";
import { installWorkspaceWheelRouting } from "./utils/workspaceWheel";
import { uid } from "./utils/ids";
import { toggleTaskCompletion, setTaskCompletion, habitScheduleForTask } from "./utils/taskCompletion";
import { captureTaskUndo, refreshTaskCreationUndo, undoTaskChanges } from "./utils/taskUndo";
import { captureSyncBatch, undoSyncBatch } from "./utils/syncBatchUndo";
import { recentTaskOperations, TASK_OPERATION_RETENTION_MS, updateSavedTaskOperations } from "./utils/taskOperationHistory";
import type { TaskOperation, TaskOperationKind } from "./components/TaskOperationHistory";
import { MobileQuickAddButton } from "./components/MobileQuickAddButton";
import { NotificationBadge } from "./components/NotificationBadge";
import { getWorkspaceDemoRuntime, getWorkspaceStorage, workspaceNow } from "./workspaceEnvironment";
import { normalizeEngagement } from "./utils/engagement";
import { recordLocalAnalyticsChange, recordTimerTransition, recoverAnalytics, captureDailyPlan } from "./metrics/activityBridge";
import type { AnalyticsSource, TimerTransition } from "./metrics/activityEvents";
import { AnchoredNarrowMenu } from "./components/AnchoredNarrowMenu";
import { ExtensionMount } from "./extensions/ExtensionMount";
import { RightUtilityPanel } from "./components/RightUtilityPanel";
import { FocusTimerPanel } from "./components/FocusTimerPanel";
import { normalizePomodoroClockFont, POMODORO_EXTENSION_KEY } from "./widget/pomodoroAppearance";
import type { ExtensionContribution } from "./extensions/types";
import { highlightTaskLocation } from "./utils/highlightTaskLocation";
import { DailyTimelineGrid, TimelineDayBoundaries } from "./components/ExecutionSharedLayout";
import { themeVars } from "./WorkspacePresentation";
import { SettingColorInput } from "./components/SettingsControls";
import { COMPACT_LAYOUT_MEDIA_QUERY, SLOT_MINUTES, DURATION_OPTIONS, DEFAULT_PROJECT_COLOR, PROJECT_COLOR_PRESETS, taskBlockPriorityFor, categories, isEventDisplayTask, isExternalCalendarDisplayTask, hexToRgb, minutesToTime, timeToMinutes, addMinutes, taskDuration, sortAiConversations, ProductIcon, recurrenceOptions, recurrenceLabel, TaskRecurrenceIndicator, TaskCard, formatMinutes, formatDuration, ReturnedToPlanIcon, TimeBlock, PreviewBlock, ProjectColorPicker, ProjectChoice, ProjectCreateRow, AiPanel, type AutoScheduleState, type TimelineFocusTarget, type PlacementPreview, type PlacementChoice, type ResizePreview, type AiAttachmentSnapshot, type AiSessionMessage } from "./WorkspacePresentation";
export { ProductIcon } from "./WorkspacePresentation";
import React, { Activity, type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";
import { useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import type { AgentAuditEntry, AgentRunState, AiConversation, CalendarEvent, Category, ExecutionLane, ExternalCalendarOccurrence, ExternalCalendarSource, Habit, HabitDailyState, HabitTrackingType, Language, NullablePriority, PlannerApi, PlannerData, Priority, Project, RecurrenceFrequency, Settings, Subtask, Task, TaskLevel, TaskRecurrence, TimelineRecord, WidgetAction, WidgetSnapshot, WidgetTimerRuntime } from "./types";
import { callAiAssistant, decideAgentRun, listAgentAuditRuns, type AiAction } from "./aiAssistantApi";
import { compactText, extractLocalMemories, mergeAiMemories } from "./aiContext";

import type { ParsedAttachment } from "./fileParser";
import type { PlanningViewSession } from "./PlanningView";

import { AI_PROVIDER_MODELS, readLocalAiProviderConfig } from "./aiProviderConfig";
import { removeEmptyAiConversations } from "./aiConversationHistory";
import { autoScheduleTasks, type UnscheduledTask } from "./autoSchedule";
import { AI_INFERENCE_MODEL_VERSION, buildAiProfile, learnedTaskDurationMinutes, predictTaskIntelligence } from "./aiPersonalization";
import { TaskDragLayer, UnifiedDragOverlay, type UnifiedDragSnapshot } from "./unifiedDrag";
import { createDragProjection } from "./motion/dragProjection";
import { installBrowserFallback, forceLocalPreviewMode } from "./browserFallback";
import { isPasswordRecoveryCallback } from "./passwordRecovery";
import { getVisibleDays, pointerToDateTime, timeBlockTop, timeBlockHeight, HOUR_HEIGHT, timelineHourSlots } from "./timelineGeometry";
import { t, detectSystemLanguage, viewLabel, weekdayName } from "./i18n";
import { term } from "./terminology";
import { migrateLegacyHabitTracker, scheduleHabitRecord, toggleHabitCompletion, unscheduleHabitRecord, updateHabit, archiveHabit, buildHabitMetrics, isHabitDueOnDate, isHabitWithinDateRange, weekdayLabels, type HabitMetrics } from "./utils/habits";
import { shouldShowHabitCandidates } from "./utils/habitCandidateVisibility";
import { nativeFeatureActive, metricsPluginActive } from "./extensions/nativeFeatures";
import type { ReadingRuntimeSnapshot } from "./reading/ReadingRuntime";
import { normalizeAiReply } from "./utils/aiReply";
import { candidateScheduleSummary, type CandidateScheduleSummary } from "./utils/candidateSchedule";
import { localIsoDate } from "./utils/localDate";
import { buildWeekWindow } from "./utils/monthWindow";
import type { CommandSearchResult } from "./utils/commandSearch";
import { buildDailyContinuousDates, dailyContinuousBlockTop, dailyContinuousCanvasHeight, dailyContinuousSlotCount, dailyContinuousTargetFromContentY, getContinuousTimelineDateForOffset } from "./utils/continuousTimeline";
import { normalizeTaskCheckTone, normalizeTaskState, taskMetaPatch, validateProjectCompletion, workflowStatusForPatch } from "./utils/productivityModel";
import { matchShortcut } from "./utils/shortcuts";
import { buildTaskMetaBadges } from "./utils/taskMetaBadges";
import { computeConflictLayout, computeConflictStyle, scheduledDateTimesOverlap, scheduledTaskIntervalsOnDate } from "./utils/conflictLayout";
import { expandTaskAllDayRecords, expandTaskTimelineSlices } from "./utils/taskTimelineSlices";
import { addDays, addMonths, buildRecurrenceOccurrenceId, enumerateRecurrenceDates, hasRecurrenceOccurrenceOnDate, hasRecurringRule, isRecurringScheduledTask, matchesOccurrence, parseRecurrenceOccurrenceId, startOfWeekIso } from "./utils/recurrence";
import { appendAiSubtasks, getAiSubtaskSuggestions } from "./utils/aiSubtasks";
import { autoScrollAtDragEdge } from "./utils/dragAutoScroll";
import { addSubtaskToTree, findSubtaskInTree, removeSubtaskFromTree, toggleSubtaskInTree, moveTreeNode, type TreeDragNode, type TreeDropTarget } from "./utils/treeOrder";
import { captureTreeMoveUndo, undoTreeMove } from "./utils/treeMoveUndo";
import { reorderTodayCandidates, returnScheduledTaskToToday } from "./utils/todayCandidates";
import { reconcileOverdueTasks } from "./utils/overdueTasks";
import { useInAppDialog } from "./InAppDialog";
import { TaskActions, TaskBlock, TaskBlockContent, TaskBlockDuration, TaskBlockRow, TaskCheckbox, TaskGroup } from "./components/TaskBlock";
import { projectColorInk } from "./utils/presentationColor";
import { ProductStorySlot } from "./ProductStory";
import { ExecutionSplitLayout, CandidatePanelShell, CandidatePanelHeader, TimelineCanvas } from "./components/ExecutionSharedLayout";

import { EmptyState } from "./components/EmptyState";
import { OnboardingCue, OnboardingTour, useTaskExample, type OnboardingSettingsTopic } from "./components/OnboardingGuide";
import { isOnboardingTask, onboardingBlock, onboardingStage, onboardingTarget, ONBOARDING_ADD, ONBOARDING_DONE, ONBOARDING_START, type OnboardingTourStep } from "./onboarding";
import { ActionDisclosure, Button, CloseButton, IconButton, UndoButton } from "./components/UiPrimitives";

import { DateQuickPicker } from "./components/DateQuickPicker";
import { TaskDetailSchedule, type TaskScheduleRange } from "./components/TaskDetailSchedule";
import { EditorActionRow, EditorConversion, EditorDate, EditorNotes, EditorRemove, EditorTitle } from "./components/EntityEditor";

const INCOMPLETE_OUTCOMES = ["unfinished-return", "unfinished-stay", "skipped-return", "skipped-stay"] as const;
const INCOMPLETE_LABELS = {
  en: ["Unfinished · continue", "Unfinished · stop", "Skipped · do later", "Skipped · no return"],
  zh: ["没完成 · 继续", "没完成 · 不继续", "没做 · 之后再做", "没做 · 之后不做"],
};
import { UiCheckIcon, UiChatIcon, UiChevronDownIcon, UiBellIcon, UiCalendarCheckIcon, UiCopyIcon, UiCursorIcon, UiFolderInputIcon, UiKanbanIcon, UiListChecksIcon, UiMatrixIcon, UiMoreIcon, UiPencilIcon, UiPlusIcon, UiPointingHandIcon, UiSearchIcon, UiSettingsIcon, UiSparklesIcon, UiTimerIcon, UiTrashIcon} from "./components/UiIcons";
import { normalizeSettingsTarget, type SettingsTargetInput } from "./settingsNavigationCore";
import { normalizeSettings, WORKSPACE_CORNER_RADIUS } from "./defaultSettings";
import { ensureDailyReviewConversation, DAILY_REVIEW_CONVERSATION_ID, listDailyReviewNotifications, listProactiveNotifications, markProactiveNotificationRead, showProactiveSystemNotification, subscribeToProactiveNotifications, type ProactiveNotification } from "./proactiveAssistant";
import { templateApplication, type TemplatePeriod } from "./utils/scheduleTemplates";

import { canAcknowledgeBootstrapSave, parseBootstrapCache, recoverAccountSettings, resolveBootstrap, type BootstrapCache } from "./syncBootstrap";

// Preload the optional first-login permission flow without adding it to the
// initial workspace bundle; the promise is already warm when auth completes.
const webNotificationOnboardingPromise = getWorkspaceDemoRuntime() ? Promise.resolve({ rememberNewUserNotificationRequest: () => undefined, watchForNewUserNotification: () => () => undefined }) : import("./webNotificationOnboarding");
const rememberWebNotification = (email: string) => webNotificationOnboardingPromise.then(({ rememberNewUserNotificationRequest }) => rememberNewUserNotificationRequest(email));
import { withDeletionTombstones } from "./syncMerge";
import { SyncScheduler, isCurrentWorkspaceLoad, readSyncInterval, shouldApplyWorkspaceRevision, shouldReconcileRemoteRevision, shouldRequeueFailedSave } from "./sync";
import { extensionService } from "./extensions/service";
const ExtensionHeader = lazy(() => import("./extensions/ExtensionSurfaces").then(module => ({ default: module.ExtensionHeader })));
const CompactPluginDock = lazy(() => import("./extensions/ExtensionSurfaces").then(module => ({ default: module.CompactPluginDock })));
import { emitPluginEvent, subscribePluginEvent } from "./extensions/runtime";
import { SelectionIndicator } from "./components/SelectionIndicator";
import type { ExtensionHost } from "./extensions/types";
import { normalizeWidgetAppearance } from "./widget/widgetPreferences";
import { DEFAULT_WIDGET_RUNTIME, DEFAULT_WIDGET_TIMER_PREFERENCES, accumulateWidgetWorkTime, advanceTaskElapsedSeconds, advanceWidgetTimer, countsWidgetTimerPhaseAsWork, createWidgetTimerModeTransition, createDeadlineAlignedTimerRuntime, createWidgetTimerRuntime, getWidgetTimerNotificationDescriptor, getStopwatchTaskTimerAction, getWidgetTimerModeChangeTaskAction, getWidgetTimerSnapshotDisplaySeconds, normalizeStoredTaskTimer, normalizeWidgetTimerPreferences, normalizeWidgetTimerRuntime, preparePomodoroRuntime, resolvePomodoroSessionTaskId, resolveWidgetCountdownTarget, scheduleWidgetCountdown } from "./widget/widgetTimer";
import { getTimerMode, getTimerModes, getTimerModeRevision, subscribeTimerModes, onTimerModeRemoving, onTimerModeOpening, openTimerMode } from "./extensions/timers";
import { createTimerOwner, type TimerOwner } from "./extensions/timerOwner";
import { extendActiveTimelineRecord, nextOverrunExtensionEnd, resolvePomodoroTask, resolveWidgetTimelineSelection, timelineRecordBounds } from "./widget/widgetSchedule";
import { hasActiveTaskSchedule, applyScheduledTimelineRecord, calculateTimelineRecordEnd, calendarDateTimeSpanMinutes, clockTimeSpanMinutes, findScheduledTimelineRecord, normalizeTimelineRecord, rescheduleTimelineRecord, timelineRecordDurationMinutes } from "./utils/timelineRecords";
import { anchoredTimelineScrollTop, timelineZoomFromPinch } from "./utils/timelineZoom";
import { expandTimedCalendarEvent } from "./utils/calendarEventSlices";
import { MOTION, runMotionTransition, scheduleMotionCommit } from "./motion";
import { useMotionPresence } from "./useMotionPresence";
import { useMotionSelection } from "./useMotionSelection";
import { applyMotionPreference, readMotionPreference } from "./motion";
import { useTaskLayoutMotion } from "./motion/useTaskLayoutMotion";
import { EXECUTION_MOTION_SELECTOR, rememberDragLanding } from "./motion/layout";
import { aggregateSavePhase, IDLE_SAVE_FEEDBACK, saveFeedbackLabel, type SaveFeedback, type SavePhase } from "./motion/feedback";
import "./app.css";
import "./mobile-execution.css";
import "./ui-primitives.css";
import type { MobileShortSheetKind } from "./MobileTaskSummary";

const productDemo = getWorkspaceDemoRuntime();
const analyticsMutationSources = new WeakMap<PlannerData,AnalyticsSource>();
const demoTreeView: ExtensionContribution = { id: "demo:tree", owner: "demo", name: "Tree", planningView: true, nativeMode: "tree", mount: () => {} };
const coreTreeView: ExtensionContribution = { ...demoTreeView, id: "core:tree", owner: "core" };
const coreHistoryView: ExtensionContribution = { id: "core:activity-history", owner: "core", name: "Activity history", nativeMode: "activity-history", mount: () => {} };
const productPresentation = Boolean(productDemo?.navigation);
const productAiPresentation = productPresentation && productDemo?.feature === "ai";
const TimelineDateTag = productPresentation ? "div" : "button";
const localStorage = getWorkspaceStorage();
const sessionStorage = productDemo?.storage ?? window.sessionStorage;
installBrowserFallback();

const AuthGate = lazy(() => import("./AuthGate"));
const DesktopDockControls = lazy(() => import("./components/DesktopDockControls"));
const PluginGuidePageLazy = lazy(() => import("./PluginGuidePage"));
const loadSettingsPanel = () => import("./SettingsPanel");
const UtilityPanel = lazy(() => loadSettingsPanel().then((module) => ({ default: module.UtilityPanel })));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const TaskOperationHistory = lazy(() => import("./components/TaskOperationHistory"));
const MobileExecutionControls = lazy(() => import("./components/MobileExecutionControls"));
const MobileTaskSummary = lazy(() => import("./MobileTaskSummary"));
const EngagementRating = lazy(() => import("./components/EngagementRating").then(module => ({ default: module.EngagementRating })));
const WorkspaceSetup = lazy(() => import("./components/WorkspaceSetup").then((module) => ({ default: module.WorkspaceSetup })));
const MobileQuickAddSheet = lazy(() => import("./MobileTaskSummary").then((module) => ({ default: module.MobileQuickAddSheet })));
const MobileTimelineDraftSheet = lazy(() => import("./MobileTaskSummary").then((module) => ({ default: module.MobileTimelineDraftSheet })));
const MonthView = lazy(() => import("./MonthView"));
const ScheduleTemplatePanel = lazy(() => import("./components/ScheduleTemplatePanel"));

const ProactiveNotificationCenter = lazy(() => import("./components/ProactiveNotificationCenter").then((module) => ({ default: module.ProactiveNotificationCenter })));
const UnfinishedTasksDialog = lazy(() => import("./components/UnfinishedTasksDialog").then((module) => ({ default: module.UnfinishedTasksDialog })));

const todayIso = () => productDemo?.date ?? localIsoDate();
const TIMELINE_START = 0;
const TIMELINE_END = 24;

const SLOT_HEIGHT = 20;


const PLANNING_THEME_PRESETS_LIGHT = ["#7EA172", "#584D3D", "#D7816A", "#0F0326", "#BE185D", "#D97706", "#2563EB"];
const PLANNING_THEME_PRESETS_DARK  = ["#7EA172", "#FBF9FF", "#D7816A", "#584D3D", "#EC4899", "#F59E0B", "#3B82F6"];
const SAVE_DEBOUNCE_MS = 750;
const REMOTE_REVISION_POLL_MS = 30_000;
const SYNC_RETRY_DELAYS = [1000, 3000, 8000, 20000, 30000];
const SYNC_FAILURE_NOTICE_AFTER = 3;
const isJevModelVersion = (modelVersion: string | undefined) =>
  /^(?:typesafe-ai\/jev|~?typesafe\/jev|jev-)/i.test(modelVersion?.trim() || "");

/** Map a task priority to the shared TaskBlock priority vocabulary. */

const TIME_OPTIONS = Array.from({ length: ((TIMELINE_END - TIMELINE_START) * 60) / SLOT_MINUTES }, (_, index) => {
  return minutesToTime(TIMELINE_START * 60 + index * SLOT_MINUTES);
});

const categoryOrder: Category[] = ["exam", "project", "essay", "materials", "uk", "us", "personal"];

const candidateViewNames = {
  list: ["列表", "List", UiListChecksIcon],
  eisenhower: ["矩阵", "Matrix", UiMatrixIcon],
  kanban: ["看板", "Kanban", UiKanbanIcon],
} as const;

function CandidateViewIcon({ view }: { view: ExtensionContribution }) {
  if (view.owner === "official:reading") return <UiListChecksIcon size={16} />;
  const mode = view.nativeMode;
  if (mode && mode !== "tree" && mode !== "metrics" && mode !== "activity-history") {
    const Icon = candidateViewNames[mode][2];
    return <Icon size={16} />;
  }
  return view.iconUrl ? <img src={view.iconUrl} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.hidden = true; }} /> : null;
}

function candidateViewName(view: ExtensionContribution, lang: Language) {
  if (view.owner === "official:reading") return lang === "zh" ? "阅读" : "Reading";
  const mode = view.nativeMode;
  if (mode && mode !== "tree" && mode !== "metrics" && mode !== "activity-history") return candidateViewNames[mode][lang === "zh" ? 0 : 1];
  return view.name;
}
const WIDGET_TIMER_RUNTIME_KEY = "navopath-widget-timer-runtime";
const WIDGET_TIMER_ADVANCED_AT_KEY = "navopath-widget-timer-advanced-at";
const WIDGET_TIMER_REMAINDER_KEY = "navopath-widget-timer-remainder-ms";
const AI_DOCKED_STORAGE_KEY = "navopath-ai-docked";

function loadAiDockedPreference() {
  if (productDemo) return false;
  try { return localStorage.getItem(AI_DOCKED_STORAGE_KEY) === "true"; } catch { return false; }
}

function loadWidgetTimerRuntime(): WidgetTimerRuntime {
  try {
    const parsed = JSON.parse(localStorage.getItem(WIDGET_TIMER_RUNTIME_KEY) || "null") as Partial<WidgetTimerRuntime> | null;
    if (parsed && typeof parsed.mode === "string" && Number.isFinite(parsed.phaseStartedAt)) return parsed as WidgetTimerRuntime;
  } catch { /* Ignore malformed or unavailable local storage. */ }
  const now = Date.now();
  return { ...DEFAULT_WIDGET_RUNTIME, phaseStartedAt: now, pausedAt: now };
}
type AddType = "task" | "project" | "habit";
type CompactExecuteView = "tasks" | "schedule";
type WorkspacePanelKind = "ai" | "settings" | "about" | "search" | "notifications" | "metrics" | "extension" | "templates" | "timer";
type UtilityPanelKind = "settings" | "about" | "metrics" | "extension";
type WorkspacePanel = { kind: WorkspacePanelKind; owner?: string; id?: string };
function utilityPanelKind(panel: WorkspacePanel | null): UtilityPanelKind | null {
  const kind = panel?.kind;
  return kind === "settings" || kind === "about" || kind === "metrics" || kind === "extension" ? kind : null;
}

type TimelineView = "daily" | "3day" | "weekly" | "month";
type AiPlanPrefs = { scope: "day" | "3day" | "week"; strategy: "random" | "byProject" | "alternativeProject" | "longShort" };
type SettingsPatch = Partial<Settings>;
type QueuedDataSave = { payload: PlannerData; version: number; pendingSavedAt: string };
type QueuedSettingsSave = { payload: SettingsPatch; version: number; pendingSavedAt: string };

/**
 * SchedulePreview — single source of truth for a preview block.
 * One preview = one real task block. Split suggestions share a source task and
 * expose segment metadata so the user can review each part before accepting.
 * with `clonedTaskId` is appended to `data.tasks`. The source task stays in
 * 任务 until then.
 */
type SchedulePreview = {
  id: string;
  sourceTaskId: string;
  clonedTaskId: string;
  title: string;
  projectId?: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  priority: Priority;
  reason: string;
  segmentIndex?: number;
  segmentCount?: number;
};

/** Auto-schedule state machine. */

function timelineFocusViewportOffset(container: HTMLElement): number {
  if (!window.matchMedia("(orientation: portrait)").matches) return container.clientHeight / 3;
  const containerTop = container.getBoundingClientRect().top;
  return Math.max(0, Math.min(container.clientHeight, window.innerHeight / 3 - containerTop));
}

type EditingOccurrence = {
  taskId: string;
  scheduledDate: string;
  scheduledStart: string;
} | null;

type DragState = {
  shelfTask?: Task;
  taskId: string;
  kind: "candidate" | "block";
  source?: "candidate" | "allDay" | "timeline";
  duration: number;
  offsetMinutes?: number;
  pointer?: { x: number; y: number };
  sourceRect?: { width: number; height: number };
  offset?: { x: number; y: number };
  outsideTimeline?: boolean;
} | null;

type DragSource = "candidate" | "tree" | "kanban" | "matrix" | "list" | "timeline";
type DropIntent =
  | "reorder-before"
  | "reorder-after"
  | "drop-into-container"
  | "schedule-at-time"
  | "invalid";
type ActiveDragItem = {
  dragId: string;
  taskId: string;
  source: DragSource;
  sourceContainerId: string;
  sourceIndex: number;
  sourceVariant: "candidate" | "allDay" | "scheduled";
  taskSnapshot: Task;
};
type CandidateDropTarget = {
  kind: "task";
  taskId: string;
  position: "before" | "after";
  intent: Extract<DropIntent, "reorder-before" | "reorder-after">;
} | {
  kind: "project";
  projectId: string | null;
} | null;
type ShelfSubtask = { id: string; draftTaskId: string };

type CandidateDragOptions = {
  dragElement?: HTMLElement;
  allowCandidateReorder?: boolean;
  onSchedule?: (date: string, startTime: string) => void;
};

const DRAG_START_THRESHOLD_PX = 5;
const CANDIDATE_TOUCH_HOLD_MS = 360;
const TOUCH_SCROLL_CANCEL_DISTANCE_PX = 8;
const SUPPRESS_CLICK_AFTER_DRAG_MS = 220;

function mixHex(a: string, b: string, amount: number) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x * (1 - amount) + y * amount).toString(16).padStart(2, "0");
  return `#${mix(c1.r, c2.r)}${mix(c1.g, c2.g)}${mix(c1.b, c2.b)}`;
}

type ScheduleSuggestion = SchedulePreview; // legacy alias kept for compatibility; replaced by SchedulePreview
type QuickSchedule = { startTime: string; title: string; projectId: string; isAllDay?: boolean } | null;
/** Floating popup for all‑day bar quick‑add */
type AllDayQuickAdd = { date: string; left: number; top: number; width: number; dayIndex: number } | null;
/** Drag‑create state for timeline area (day / 3‑day / week views) */
type DragCreateState = {
  date: string;
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  top: number;
  height: number;
  left: number;
  width: number;
  committed: boolean;
} | null;

type AuthState = { mode: "local" | "cloud"; user: { id: string; email?: string } | null; configured: boolean };
type AuthNotice = { type: "confirm-email"; email: string } | null;

type FormState = {
  title: string;
  projectId: string;
  projectColor: string;
  dueDate: string;
  dueTime: string;
  endDate: string;
  endTime: string;
  category: Category;
  priority: NullablePriority;
  importance: NullablePriority;
  urgency: NullablePriority;
  estimatedHours: number;
  details: string;
  recurrence?: TaskRecurrence;
};

let planningViewPromise: Promise<typeof import("./PlanningView")> | undefined;
function loadPlanningView() {
  return planningViewPromise ??= import("./PlanningView").catch((error) => {
    planningViewPromise = undefined;
    throw error;
  });
}
function preloadPlanningView() { void loadPlanningView().catch(() => undefined); }
const PlanningViewLazy = lazy(loadPlanningView);
const ReadingRuntimeLazy = lazy(() => import("./reading/ReadingRuntime"));
const ReadingShelfLazy = lazy(() => import("./reading/ReadingShelf"));
const PluginTaskGroupsLazy = lazy(() => import("./extensions/PluginTaskGroups"));
const ReadingTaskGroupLazy = lazy(() => import("./reading/ReadingShelf").then(module => ({ default: module.ReadingTaskGroup })));
const LandingPageLazy = lazy(() => import("./LandingPage"));
const OAuthConsentPageLazy = lazy(() => import("./OAuthConsentPage"));

const HabitDetailBodyLazy = lazy(() => import("./components/HabitDetailBody"));
const LOCAL_BOOTSTRAP_PREFIX = "navopath-bootstrap";

function getExecutionLane(task: Task): ExecutionLane | undefined {
  if (task.executionLane) return task.executionLane;
  const hasScheduledRecord = (task.timelineRecords || []).some((record) => record.executionStatus === "scheduled");
  if (!task.plannedForDate || hasScheduledRecord || Boolean(task.scheduledDate) || Boolean(task.scheduledStart) || isRecurringScheduledTask(task)) return undefined;
  return "candidate";
}

function validCategory(value: unknown): Category {
  return ["exam", "uk", "us", "essay", "materials", "project", "personal"].includes(String(value))
    ? value as Category
    : "personal";
}

function validPriority(value: unknown): Priority {
  return ["high", "medium", "low"].includes(String(value)) ? value as Priority : "medium";
}

function validIsoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function validTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) && Number(value.slice(3)) % SLOT_MINUTES === 0;
}

function validScheduleDuration(value: unknown) {
  if (value === undefined || value === null || value === "") return true;
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes >= SLOT_MINUTES && minutes <= 1440 && minutes % SLOT_MINUTES === 0;
}

function normalizeTaskStartTime(value: unknown, fallback = "09:00") {
  const source = typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
  return minutesToTime(Math.min(24 * 60 - SLOT_MINUTES, Math.max(0, Math.round(timeToMinutes(source) / SLOT_MINUTES) * SLOT_MINUTES)));
}

function normalizeTaskDuration(value: unknown, fallback = 60) {
  const minutes = Number(value);
  const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
  return Math.max(SLOT_MINUTES, Math.min(1440, Math.round(safe / SLOT_MINUTES) * SLOT_MINUTES));
}

function normalizeAiRecurrence(value: unknown, date: string, startTime?: string, durationMinutes?: number): TaskRecurrence | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const frequencies: RecurrenceFrequency[] = ["daily", "weekdays", "weekends", "weekly", "biweekly", "monthly", "quarterly"];
  if (!frequencies.includes(raw.frequency as RecurrenceFrequency)) return undefined;
  const normalizedStart = validIsoDate(raw.startDate) ? String(raw.startDate) : date;
  const normalizedTime = validTime(raw.startTime) ? String(raw.startTime) : validTime(startTime) ? startTime : "";
  return {
    mode: normalizedTime ? "scheduled" : "flexible",
    frequency: raw.frequency as RecurrenceFrequency,
    startDate: normalizedStart,
    startTime: normalizedTime || undefined,
    durationMinutes: normalizedTime
      ? Math.max(SLOT_MINUTES, Math.round((Number(raw.durationMinutes) || durationMinutes || 60) / SLOT_MINUTES) * SLOT_MINUTES)
      : undefined,
    endDate: validIsoDate(raw.endDate) ? String(raw.endDate) : undefined,
    count: Number.isFinite(Number(raw.count)) && Number(raw.count) > 0 ? Number(raw.count) : undefined,
  };
}

function isValidAiAction(action: AiAction) {
  const raw = action as Record<string, unknown>;
  if (action.type === "import_schedule_item") {
    return raw.kind === "task" &&
      typeof raw.title === "string" && raw.title.trim().length > 0 &&
      validIsoDate(raw.date) &&
      (!raw.startTime || validTime(raw.startTime)) &&
      (!raw.endTime || validTime(raw.endTime)) &&
      validScheduleDuration(raw.durationMinutes);
  }
  if (action.type === "create_scheduled_task" || action.type === "create_task" || action.type === "schedule_task") {
    return (!raw.start || validTime(raw.start)) &&
      (!raw.end || validTime(raw.end)) &&
      validScheduleDuration(raw.durationMinutes);
  }
  return true;
}

function hourLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  if (h === 24) return "";
  return `${h}:00`;
}

function clampSlot(minutes: number) {
  const min = TIMELINE_START * 60;
  const max = TIMELINE_END * 60 - SLOT_MINUTES;
  const clamped = Math.min(Math.max(minutes, min), max);
  return Math.round(clamped / SLOT_MINUTES) * SLOT_MINUTES;
}

function shortDate(date: string) {
  if (!date) return "未定";
  const [, month, day] = date.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function continuousTimelineDayCount(columnCount: number) {
  return columnCount === 1 ? 7 : columnCount * 6;
}

/** Returns the stored or estimated duration for a task. */

function isAllDayTask(task: Task): boolean {
  return !!task.scheduledDate && !task.scheduledStart && !task.scheduledEnd;
}

function replaceNextAction(notes: string, nextAction: string) {
  const line = `下一步：${nextAction.trim()}`;
  if (/下一步[:：]/.test(notes)) return notes.replace(/下一步[:：].*(?:\n|$)/, `${line}\n`).trim();
  return [line, notes].filter(Boolean).join("\n");
}

function getDropTargetFromPointer({
  clientX, clientY,
  gridElement,
  scrollElement,
  visibleDays,
  hourHeight = HOUR_HEIGHT,
  startHour = TIMELINE_START,
  snapMinutes = SLOT_MINUTES,
  debugLabel,
}: {
  clientX: number;
  clientY: number;
  gridElement: HTMLElement;
  scrollElement: HTMLElement;
  visibleDays: string[];
  hourHeight?: number;
  startHour?: number;
  snapMinutes?: number;
  debugLabel?: string;
}): { date: string; startTime: string; endTime: string; dayIndex: number; minutes: number } {
  return pointerToDateTime({
    clientX, clientY, gridElement, scrollElement, visibleDays,
    hourHeight, startHour, snapMinutes, debugLabel,
  });
}

function waitForPlannerApi() {
  return new Promise<PlannerApi>((resolve, reject) => {
    if (window.plannerApi) {
      resolve(window.plannerApi);
      return;
    }
    const startTime = Date.now();
    const timeoutMs = 10000; // 10 second timeout
    const timer = window.setInterval(() => {
      if (window.plannerApi) {
        window.clearInterval(timer);
        resolve(window.plannerApi);
      } else if (Date.now() - startTime > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("Timed out waiting for planner API. Please refresh the page."));
      }
    }, 20);
  });
}

async function sendPasswordResetEmail(email: string) {
  const api = await waitForPlannerApi();
  if (!api.sendPasswordResetEmail) throw new Error("Password reset unavailable");
  await api.sendPasswordResetEmail(email);
}

function bootstrapCacheKey(userId?: string) {
  return `${LOCAL_BOOTSTRAP_PREFIX}:${userId || "local"}`;
}

function readBootstrapCache(userId?: string) {
  try {
    return parseBootstrapCache(localStorage.getItem(bootstrapCacheKey(userId)));
  } catch {
    return null;
  }
}

function writeBootstrapCache(
  data: PlannerData,
  settings: Settings,
  userId?: string,
  sync: Partial<Pick<BootstrapCache, "dataDirty" | "settingsDirty" | "remoteRevision">> & {
    dataPendingSavedAt?: string | null;
    settingsPendingSavedAt?: string | null;
  } = {},
) {
  try {
    const current = readBootstrapCache(userId);
    localStorage.setItem(bootstrapCacheKey(userId), JSON.stringify({
      data,
      settings,
      savedAt: workspaceNow().toISOString(),
      dataDirty: sync.dataDirty ?? current?.dataDirty ?? false,
      settingsDirty: sync.settingsDirty ?? current?.settingsDirty ?? false,
      dataPendingSavedAt: sync.dataPendingSavedAt === null
        ? undefined
        : sync.dataPendingSavedAt ?? current?.dataPendingSavedAt,
      settingsPendingSavedAt: sync.settingsPendingSavedAt === null
        ? undefined
        : sync.settingsPendingSavedAt ?? current?.settingsPendingSavedAt,
      remoteRevision: sync.remoteRevision ?? current?.remoteRevision,
    } satisfies BootstrapCache));
  } catch {
    // Ignore cache write failures in private mode or quota pressure.
  }
}

function defaultForm(type: AddType = "task"): FormState {
  return {
    title: "",
    projectId: "",
    projectColor: DEFAULT_PROJECT_COLOR,
    dueDate: "",
    dueTime: "",
    endDate: todayIso(),
    endTime: "",
    category: type === "project" ? "project" : "personal",
    priority: "medium",
    importance: null,
    urgency: null,
    estimatedHours: 0.5,
    details: "",
    recurrence: undefined,
  };
}

function makeTask(form: FormState, intelligence?: { data: PlannerData; projects: Project[]; settings: Settings }): Task {
  const now = workspaceNow().toISOString();
  const prediction = intelligence
    ? predictTaskIntelligence({ title: form.title, projectId: form.projectId || undefined, data: intelligence.data, projects: intelligence.projects })
    : undefined;
  const inferDuration = Boolean(
    prediction && intelligence?.settings.autoEstimateTaskDuration !== false && Math.abs((form.estimatedHours || 0.5) - 0.5) < 0.001,
  );
  const inferredProject = !form.projectId && intelligence?.settings.autoAssignTaskProject !== false ? prediction?.project : undefined;
  const autoProjectId = inferredProject && inferredProject.confidence >= 0.78 ? inferredProject.projectId : undefined;
  const estimatedMinutes = inferDuration ? prediction!.duration.minutes : Math.round(Math.max(form.estimatedHours || 0.25, 0.25) * 60);
  const durationInference = inferDuration
    ? { minutes: prediction!.duration.minutes, confidence: prediction!.duration.confidence, source: prediction!.duration.source, inferredAt: now, modelVersion: AI_INFERENCE_MODEL_VERSION }
    : Math.abs((form.estimatedHours || 0.5) - 0.5) >= 0.001
      ? { minutes: estimatedMinutes, confidence: 1, source: "user" as const, inferredAt: now, modelVersion: "user", userOverridden: true }
      : undefined;
  const projectInference = form.projectId
    ? { projectId: form.projectId, confidence: 1, source: "user" as const, inferredAt: now, modelVersion: "user", userOverridden: true }
    : inferredProject
      ? { projectId: inferredProject.projectId, confidence: inferredProject.confidence, source: inferredProject.source, inferredAt: now, modelVersion: AI_INFERENCE_MODEL_VERSION }
      : undefined;
  return {
    id: uid("task"),
    title: form.title.trim(),
    dueDate: form.dueDate,
    dueDateSource: form.dueDate ? "manual" : undefined,
    category: form.category,
    priority: form.priority,
    notes: form.details,
    goalId: "goal_admission",
    completed: false,
    projectId: form.projectId || autoProjectId,
    importance: form.importance,
    urgency: form.urgency,
    estimatedHours: Math.max(estimatedMinutes / 60, 0.25),
    aiInference: durationInference || projectInference ? { duration: durationInference, project: projectInference } : undefined,
    plannedForDate: form.dueDate && form.dueDate === todayIso() ? todayIso() : undefined,
    executionLane: form.dueDate && form.dueDate === todayIso() ? "candidate" : undefined,
    order: Date.now(),
    subtasks: [],
    createdAt: now,
    updatedAt: now
  };
}

function profileWithFeedback(data: PlannerData, key: keyof NonNullable<PlannerData["aiProfile"]>["feedback"], amount = 1) {
  const profile = data.aiProfile || buildAiProfile(data);
  return { ...profile, feedback: { ...profile.feedback, [key]: profile.feedback[key] + amount } };
}

function makeProject(form: FormState): Project {
  const now = workspaceNow().toISOString();
  return {
    id: uid("project"),
    title: form.title.trim(),
    category: form.category,
    notes: form.details,
    completed: false,
    color: form.projectColor || categories[form.category].color,
    dueDate: form.dueDate || undefined,
    importance: form.importance,
    createdAt: now,
    updatedAt: now
  };
}

const MAX_RENDERED_AI_MESSAGES = 80;
const MAX_RENDERED_AI_MESSAGE_LENGTH = 30_000;

function chatToSessionMessages(chat: PlannerData["chat"] = []): AiSessionMessage[] {
  return chat.slice(-MAX_RENDERED_AI_MESSAGES).map((message) => ({
    id: message.id || uid(`ai_${message.role}`),
    role: message.role,
    content: message.content.slice(0, MAX_RENDERED_AI_MESSAGE_LENGTH),
    createdAt: message.createdAt,
    saved: Boolean(message.saved),
    status: message.status || "done",
    steps: message.steps,
    actions: (message.actions || []).map((action) => (action as AiAction).type === "import_schedule_item" ? { ...(action as AiAction), kind: "task" as const } : action) as AiAction[],
    selectedActions: message.selectedActions,
    actionState: message.actionState,
    agent: message.agent,
    clarifications: message.clarifications,
    intent: message.intent,
    plan: message.plan,
    format: message.format,
  }));
}

function aiConversationTitle(message: string) {
  const text = compactText(message, 18);
  return text || "新对话";
}

function makeAiConversation(title = "新对话"): AiConversation {
  const now = workspaceNow().toISOString();
  return { id: uid("conversation"), title, messages: [], createdAt: now, updatedAt: now };
}

function SettingsLoading({ lang, onClose }: { lang: Language; onClose: () => void }) {
  return <>
    <div className="df-utility-backdrop" data-workspace-backdrop="transparent" onMouseDown={onClose} />
    <aside className="df-utility-panel" data-workspace-panel role="dialog" aria-busy="true" aria-label={lang === "zh" ? "正在打开设置" : "Opening Settings"} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div className="df-utility-head"><h2>{lang === "zh" ? "设置" : "Settings"}</h2><CloseButton label={t(lang, "settings.close")} onClick={onClose} /></div>
      <div className="df-utility-body df-settings-shell" aria-hidden="true"><section>{Array.from({ length: 5 }, (_, index) => <div className="df-skeleton-task" key={index}><i /><span /><small /></div>)}</section></div>
    </aside>
  </>;
}

function ExecuteSkeleton() {
  return <div className="df-app df-execute-skeleton" aria-label="正在加载工作区" aria-busy="true">
    <header className="df-skeleton-header">
      <ProductIcon compact />
      <span className="df-skeleton-brand" />
      <span className="df-skeleton-tab" />
      <span className="df-skeleton-avatar" />
    </header>
    <main className="df-skeleton-workbench">
      <section className="df-skeleton-candidates">
        <span className="df-skeleton-title" />
        {Array.from({ length: 7 }, (_, index) => <div className="df-skeleton-task" key={index}><i /><span /><small /></div>)}
        <div className="df-skeleton-add" />
      </section>
      <section className="df-skeleton-timeline">
        <div className="df-skeleton-timeline-head"><span /><span /><span /></div>
        <div className="df-skeleton-grid">
          {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
          <b className="block-one" /><b className="block-two" /><b className="block-three" />
        </div>
      </section>
    </main>
  </div>;
}

function CloudWorkspaceError(props: {
  lang: Language;
  message: string;
  busy: boolean;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const zh = props.lang === "zh";
  return (
    <main className="df-auth-shell">
      <section className="df-auth-card df-cloud-error-card" role="alert">
        <div className="df-auth-brand"><ProductIcon compact /><div><strong>NavoPath</strong><span>{zh ? "账户数据仍安全保存在云端" : "Your account data is still safe in the cloud"}</span></div></div>
        <h1>{zh ? "暂时无法载入工作区" : "Workspace temporarily unavailable"}</h1>
        <p>{zh ? "网络连接中断时，NavoPath 不会再打开空白账户或启动新手教程，也不会用空数据覆盖原有内容。请恢复网络后重试。" : "When the connection drops, NavoPath will no longer open a blank account or start onboarding, and it will never replace existing content with empty data. Reconnect and try again."}</p>
        {props.message && <p className="df-auth-error">{props.message}</p>}
        <div className="df-cloud-error-actions">
          <button type="button" disabled={props.busy} onClick={props.onRetry}>{props.busy ? (zh ? "正在重试…" : "Retrying…") : (zh ? "重新载入" : "Reload workspace")}</button>
          <button type="button" className="quiet" disabled={props.busy} onClick={props.onSignOut}>{zh ? "退出登录" : "Sign out"}</button>
        </div>
      </section>
    </main>
  );
}

function App() {
  const isOAuthConsentRoute = window.location.pathname === "/oauth/consent";
  const isWorkspaceRoute = Boolean(productDemo) || isOAuthConsentRoute || window.location.pathname === "/app" || window.location.pathname.startsWith("/app/") || Boolean(window.desktopApi);
  const [data, setData] = useState<PlannerData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>(IDLE_SAVE_FEEDBACK);
  const savePhase = aggregateSavePhase(saveFeedback);
  function markSaveFeedback(kind: keyof SaveFeedback, phase: SavePhase) {
    setSaveFeedback(current => current[kind] === phase ? current : { ...current, [kind]: phase });
  }
  useEffect(() => {
    if (savePhase !== "confirmed") return;
    const timer = window.setTimeout(() => setSaveFeedback(current => ({
      data: current.data === "confirmed" ? "idle" : current.data,
      settings: current.settings === "confirmed" ? "idle" : current.settings,
    })), 1800);
    return () => window.clearTimeout(timer);
  }, [savePhase]);
  const workspaceLoaded = Boolean(data && settings);
  const [trayIdle, setTrayIdle] = useState(false);
  const [workspaceParked, setWorkspaceParked] = useState(false);
  const workspaceSuspended = trayIdle && workspaceParked;
  useEffect(() => window.desktopApi?.onWorkspaceIdle?.(setTrayIdle), []);
  const [lang, setLang] = useState<Language>(productDemo?.language ?? detectSystemLanguage());
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState<AuthNotice>(null);
  const [shelfViewId, setShelfViewId] = useState(productDemo?.feature === "planning" ? demoTreeView.id : "");
  const [taskOperations, setTaskOperations] = useState<TaskOperation[]>([]);
  const taskOperationsRef = useRef(taskOperations);
  const syncUndoLockRef = useRef(false);
  const pausedSyncPairsRef = useRef(new Set<string>());
  taskOperationsRef.current = taskOperations;
  const [shelfMenuOpen, setShelfMenuOpen] = useState(false);
  const [onboardingSettings, setOnboardingSettings] = useState<OnboardingSettingsTopic>();
  const planningSessionRef = useRef<PlanningViewSession | null>(null);
  const [projectFilterAnchor, setProjectFilterAnchor] = useState<HTMLSpanElement | null>(null);
  const [showScheduledCandidates, setShowScheduledCandidates] = useState(false);
  const shelfTitleRef = useRef<HTMLButtonElement>(null);
  const [compactLayout, setCompactLayout] = useState(() => window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches);
  const [portraitLayout, setPortraitLayout] = useState(() => window.matchMedia("(orientation: portrait)").matches);
  const inlineTimelineDraft = Boolean(window.desktopApi) || !portraitLayout;
  const [desktopDockSide, setDesktopDockSide] = useState<"left" | "right" | null>(null);
  const dockMouseLayout = Boolean(desktopDockSide) && compactLayout;
  useEffect(() => {
    let cancelled = false;
    const dockWindow = window.desktopApi?.dockWindow;
    if (!dockWindow) return () => { cancelled = true; };
    void dockWindow.getSide().then((side) => {
      if (!cancelled) setDesktopDockSide(side);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [compactExecuteView, setCompactExecuteView] = useState<CompactExecuteView>("schedule");
  const [phoneLayout, setPhoneLayout] = useState(() => window.matchMedia("(max-width: 899.98px) and (orientation: portrait)").matches);
  const workspaceLayout = productPresentation ? "wide" : desktopDockSide ? "dock-" + desktopDockSide : phoneLayout ? "portrait" : compactLayout ? portraitLayout ? "portrait" : "split" : "wide";
  const mobileExecution = phoneLayout && !productPresentation;
  const narrowSplitLayout = compactLayout && !portraitLayout && !productPresentation;
  const compactTasksActive = !mobileExecution && compactExecuteView === "tasks";
  const compactTimelineActive = productAiPresentation || narrowSplitLayout || !compactTasksActive;
  const mobileExecutionRef = useRef(mobileExecution);
  mobileExecutionRef.current = mobileExecution;
  const [candidateDrawerOpen, setCandidateDrawerOpen] = useState(false);
  const [candidateDrawerExpanded, setCandidateDrawerExpanded] = useState(false);
  const candidatePanelRef = useRef<HTMLElement>(null);
  const candidateTriggerRef = useRef<HTMLButtonElement>(null);
  const candidateScrollRef = useRef(0);
  const candidateHeaderGesture = useMobileSheetGesture({
    enabled: mobileExecution && candidateDrawerOpen,
    onSwipeUp: () => setCandidateDrawerExpanded(true), onSwipeDown: () => setCandidateDrawerExpanded(false) });
  const mobileTapRef = useRef({ x: 0, y: 0, moved: false });
  type MobilePlacementSession = { guided: boolean; taskId: string; subtask?: ShelfSubtask; recordId?: string; durationMinutes: number; version: string; view: TimelineView; date: string; visibleDate: string; scrollTop: number; drawerOpen: boolean; noSuggestedSlotDate?: string };
  const [mobilePlacement, setMobilePlacement] = useState<MobilePlacementSession | null>(null);
  const mobilePlacementRef = useRef<MobilePlacementSession | null>(null);
  const mobileCommitRef = useRef(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddPresence = useMotionPresence(quickAddOpen, MOTION.layout);
  const [mobileQuickAddKind, setMobileQuickAddKind] = useState<MobileShortSheetKind>("task");
  const [mobileQuickAddDate, setMobileQuickAddDate] = useState<string | null>(null);
  const [mobileQuickAddFromProjectTree, setMobileQuickAddFromProjectTree] = useState(false);
  const [mobileQuickHabitMinutes, setMobileQuickHabitMinutes] = useState(20);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [visibleTimelineDate, setVisibleTimelineDate] = useState(todayIso());
  const [mobileDatePickerOpen, setMobileDatePickerOpen] = useState(false);
  const [mobileDatePickerMonth, setMobileDatePickerMonth] = useState(() => todayIso().slice(0, 7));
  useEffect(() => {
    if (!mobileDatePickerOpen) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setMobileDatePickerOpen(false);
      document.querySelectorAll<HTMLElement>(".df-compact-date-picker-trigger, .df-date-title-button").forEach((trigger) => {
        if (trigger.getClientRects().length) trigger.focus();
      });
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest(".df-mobile-date-picker, .df-compact-date-picker-trigger, .df-date-title-button")) return;
      setMobileDatePickerOpen(false);
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [mobileDatePickerOpen]);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const timelineSlotHeight = SLOT_HEIGHT * timelineZoom;
  const timelineHourHeight = timelineSlotHeight * (60 / SLOT_MINUTES);
  const [drag, setDrag] = useState<DragState>(null);
  const [dragOverlay, setDragOverlay] = useState<UnifiedDragSnapshot | null>(null);
  const [dragOverlayTask, setDragOverlayTask] = useState<{ task: Task; variant: "candidate" | "allDay" | "scheduled" } | null>(null);
  const [dragOverlayPointer, setDragOverlayPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview>(null);
  const [hoverSlot, setHoverSlot] = useState<string>("");
  const [hoveredBlock, setHoveredBlock] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileTaskSummary, setMobileTaskSummary] = useState(false);
  const [addType, setAddType] = useState<AddType>("task");
  const [editingId, setEditingId] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [workspacePanel, setWorkspacePanel] = useState<WorkspacePanel | null>(() =>
    productDemo?.feature === "ai" && !productAiPresentation ? { kind: "ai" } : null);
  const workspacePanelRef = useRef(workspacePanel);
  workspacePanelRef.current = workspacePanel;
  function showWorkspacePanel(next: WorkspacePanel, toggle = false) {
    setWorkspacePanel((current) => toggle && current?.kind === next.kind && current.owner === next.owner && current.id === next.id ? null : next);
  }
  function setWorkspacePanelOpen(kind: WorkspacePanelKind, next: boolean | ((open: boolean) => boolean)) {
    setWorkspacePanel((current) => {
      const open = current?.kind === kind;
      const shouldOpen = typeof next === "function" ? next(open) : next;
      if (shouldOpen === open) return current;
      return shouldOpen ? { kind } : null;
    });
  }
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || (event.target instanceof Element && event.target.closest(".df-dialog, .ui-modal-overlay"))) return;
      setWorkspacePanel(null);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, []);
  const aiOpen = workspacePanel?.kind === "ai";
  const setAiOpen = (next: boolean | ((open: boolean) => boolean)) => setWorkspacePanelOpen("ai", next);
  const aiPresence = useMotionPresence(aiOpen, MOTION.layout);
  const [aiDocked, setAiDocked] = useState(loadAiDockedPreference);
  const freshAiConversationRef = useRef(true);
  const [referencedTaskId, setReferencedTaskId] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const aiBusyRef = useRef(false);
  const aiInputRef = useRef("");
  const aiAbortRef = useRef<AbortController | null>(null);
  const [aiMessages, setAiMessages] = useState<AiSessionMessage[]>([]);
  const [demoReschedulesOpen, setDemoReschedulesOpen] = useState(false);
  const [demoPresetBusy, setDemoPresetBusy] = useState(false);
  const [demoGuideDismissed, setDemoGuideDismissed] = useState(false);
  const demoPresetBusyRef = useRef(false);
  const [demoRevealing, setDemoRevealing] = useState(false);
  const [activeAiConversationId, setActiveAiConversationId] = useState("");
  const [aiConversationListOpen, setAiConversationListOpen] = useState(false);
  const [aiAuditOpen, setAiAuditOpen] = useState(false);
  const [aiAuditRuns, setAiAuditRuns] = useState<AgentAuditEntry[]>([]);
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [aiAuditError, setAiAuditError] = useState("");
  const [aiMemoryNotice, setAiMemoryNotice] = useState("");
  const [aiActionPatches, setAiActionPatches] = useState<Record<string, Record<number, Record<string, unknown>>>>({});
  const [aiAttachment, setAiAttachment] = useState<ParsedAttachment | null>(null);
  const [aiAttachmentStatus, setAiAttachmentStatus] = useState("");
  const attachmentParseRef = useRef<AbortController | null>(null);
  useEffect(() => () => attachmentParseRef.current?.abort(), []);
  const proactiveIntroShownRef = useRef(false);
  const [externalCalendarSources, setExternalCalendarSources] = useState<ExternalCalendarSource[]>([]);
  const [externalCalendarOccurrences, setExternalCalendarOccurrences] = useState<ExternalCalendarOccurrence[]>([]);
  const externalCalendarSyncRef = useRef<Promise<void> | null>(null);
  // ── Auto-schedule: single source of truth ──
  const [schedulePreviews, setSchedulePreviews] = useState<SchedulePreview[]>([]);
  const [scheduleUnscheduled, setScheduleUnscheduled] = useState<UnscheduledTask[]>([]);
  const [autoScheduleState, setAutoScheduleState] = useState<AutoScheduleState>("idle");
  const [aiPlanMenuOpen, setAiPlanMenuOpen] = useState(false);
  const [aiPlanPrefs, setAiPlanPrefs] = useState<AiPlanPrefs>({ scope: "day", strategy: "longShort" });
  const [timelineView, setTimelineView] = useState<TimelineView>("daily");
  const timelineViewFocusRef = useRef<TimelineFocusTarget | null>(null);
  const changeTimelineView = useMotionSelection<TimelineView>(timelineView, (nextView) => {
    const viewportFocus = (timelineView === "month" ? timelineViewFocusRef.current : null)
      ?? { ...currentTimelineViewportFocus(), source: "schedule" as const };
    timelineViewFocusRef.current = viewportFocus;
    setSelectedDate(viewportFocus.date);
    setVisibleTimelineDate(viewportFocus.date);
    setTimelineView(nextView);
    if (nextView !== "month") setPendingTimelineFocus(viewportFocus);
    setDragCreate(null);
  }, "timeline", ["daily", "3day", "weekly", "month"]);
  const monthScrollRef = useRef<HTMLDivElement>(null);
  const [monthDropDate, setMonthDropDate] = useState("");
  // Continuous-timeline infinite scroll: records the pre-shift scrollTop and the
  // number of bands shifted so a useLayoutEffect can restore the viewport after
  // the centered date window recomputes. `continuousPrependLockRef` prevents the
  // scroll listener from re-triggering a shift while one is already in flight.
  const continuousScrollRestoreRef = useRef<{ oldScrollTop: number; shiftBands: number } | null>(null);
  const continuousPrependLockRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(AI_DOCKED_STORAGE_KEY, String(aiDocked)); } catch { /* Ignore unavailable local storage. */ }
  }, [aiDocked]);

  // Continuous-timeline infinite scroll: after the centered date window shifts
  // (prepend/append), restore the viewport so the user does not perceive a jump.
  // The centered window keeps a constant band count, so scrollHeight is unchanged;
  // we only translate scrollTop by the shifted band count × day height.
  useLayoutEffect(() => {
    const restore = continuousScrollRestoreRef.current;
    if (!restore) return;
    const container = timelineRef.current;
    if (!container) return;
    continuousScrollRestoreRef.current = null;
    const dayHeight = (24 * 60 / SLOT_MINUTES) * timelineSlotHeight;
    const next = restore.oldScrollTop + restore.shiftBands * dayHeight;
    container.scrollTop = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, next));
    // Release the lock on the next frame so the scroll event triggered by this
    // scrollTop assignment does not re-enter the prepend/append branch.
    const frame = window.requestAnimationFrame(() => { continuousPrependLockRef.current = false; });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedDate, timelineView, timelineSlotHeight]);
  const [pendingTimelineFocus, setPendingTimelineFocus] = useState<TimelineFocusTarget | null>(null);
  const [planningFocusTaskId, setPlanningFocusTaskId] = useState<string | null>(null);
  const drawerInitialFormRef = useRef<FormState | null>(null);
  const drawerSaveConfirmRef = useRef(false);
  const [placementPreview, setPlacementPreview] = useState<PlacementPreview>(null);
  const [placementChoices, setPlacementChoices] = useState<PlacementChoice[]>([]);
  const [locatedPlacementTaskId, setLocatedPlacementTaskId] = useState<string | null>(null);
  const placementReturnScrollTopRef = useRef<number | null>(null);
  const placementPreviewRef = useRef<PlacementPreview>(placementPreview);
  placementPreviewRef.current = placementPreview;
  const taskEnrichmentInFlightRef = useRef(new Map<string, Promise<Task | undefined>>());
  const [editingOccurrence, setEditingOccurrence] = useState<EditingOccurrence>(null);
  const [quickSchedule, setQuickSchedule] = useState<QuickSchedule>(null);
  const scheduleTemplateOpen = workspacePanel?.kind === "templates";
  const setScheduleTemplateOpen = (open: boolean) => setWorkspacePanelOpen("templates", open);
  const scheduleTemplatePresence = useMotionPresence(scheduleTemplateOpen, MOTION.base);
  const [allDayQuickAdd, setAllDayQuickAdd] = useState<AllDayQuickAdd>(null);
  const [monthQuickAdd, setMonthQuickAdd] = useState<AllDayQuickAdd>(null);
  const [allDayDragOver, setAllDayDragOver] = useState(false);
  const [allDayDragDate, setAllDayDragDate] = useState("");
  const [candidateDropActive, setCandidateDropActive] = useState(false);
  const [candidateDropTarget, setCandidateDropTarget] = useState<CandidateDropTarget>(null);
  const [dragCreate, setDragCreate] = useState<DragCreateState>(null);
  const dragCreateSuppressClickRef = useRef(false);
  const timelineZoomRef = useRef(1);
  const timelinePinchActiveRef = useRef(false);
  const timelinePinchRef = useRef<{ distance: number; startZoom: number; anchorBaseY: number; anchorViewportY: number } | null>(null);
  const timelinePinchFrameRef = useRef<number | null>(null);
  const timelinePinchPendingZoomRef = useRef<number | null>(null);
  const [resizeHintTaskId, setResizeHintTaskId] = useState("");
  const utilityPanel = utilityPanelKind(workspacePanel);
  const setUtilityPanel = (kind: UtilityPanelKind | null) => setWorkspacePanel((current) =>
    kind ? { kind } : utilityPanelKind(current) ? null : current);
  const activeExtensionPanelId = workspacePanel?.kind === "extension" ? workspacePanel.id : undefined;
  const layerExitHandlesRef = useRef(new Map<string, ReturnType<typeof scheduleMotionCommit> | null>());
  const layerTriggerRef = useRef(new Map<string, HTMLElement>());
  const [habitPanel, setHabitPanel] = useState<"overview" | "detail" | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [newHabitDraft, setNewHabitDraft] = useState<Habit | null>(null);
  const [settingsSectionTarget, setSettingsSectionTarget] = useState<SettingsTargetInput>();
  const commandOpen = workspacePanel?.kind === "search";
  const commandPresence = useMotionPresence(commandOpen);
  const setCommandOpen = (open: boolean) => setWorkspacePanelOpen("search", open);
  const [commandQuery, setCommandQuery] = useState("");
  const [toast, setToast] = useState<{ message: string; deletionId?: string } | null>(null);
  const [proactiveNotifications, setProactiveNotifications] = useState<ProactiveNotification[]>([]);
  const notificationCenterOpen = workspacePanel?.kind === "notifications";
  const setNotificationCenterOpen = (open: boolean) => setWorkspacePanelOpen("notifications", open);
  const [unfinishedNotification, setUnfinishedNotification] = useState<ProactiveNotification | null>(null);
  const seenProactiveNotificationIdsRef = useRef(new Set<string>());
  // Enhanced toast with optional undo action (5-second window)
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void; undo?: boolean } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [showCompletedCandidates, setShowCompletedCandidates] = useState(false);
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(() => new Set());
  const completionHandlesRef = useRef(new Map<string, ReturnType<typeof scheduleMotionCommit> | null>());
  const [groupByProject, setGroupByProject] = useState(true);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProjectId, setQuickProjectId] = useState("");
  const [quickProjectOpen, setQuickProjectOpen] = useState(false);
  const [quickProjectTitle, setQuickProjectTitle] = useState("");
  const [quickProjectColor, setQuickProjectColor] = useState(PROJECT_COLOR_PRESETS[0]);
  const quickCandidateInputRef = useRef<HTMLInputElement>(null);
  const quickExampleRef = useTaskExample(!productDemo && onboardingStage(settings) === "add", settings?.language || "en", quickCandidateInputRef);
  const quickComposerRef = useRef<HTMLFormElement>(null);
  const onboardingTaskRowRef = useRef<HTMLDivElement>(null);
  const onboardingPlanButtonRef = useRef<HTMLButtonElement>(null);
  const onboardingReturnBlockRef = useRef<HTMLElement>(null);
  const candidateExpandRef = useRef<HTMLButtonElement>(null);
  const quickAddButtonRef = useRef<HTMLButtonElement>(null);
  const compactQuickInputRef = useRef<HTMLInputElement>(null);
  const [candidatePanelCollapsed, setCandidatePanelCollapsed] = useState(false);
  const [candidatePanelWidth, setCandidatePanelWidth] = useState<number | null>(null);
  const [simpleView, setSimpleView] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [subtaskAiBusyId, setSubtaskAiBusyId] = useState("");
  const [subtaskAiRevealIds, setSubtaskAiRevealIds] = useState<string[]>([]);
  const subtaskAiRevealTimeoutRef = useRef<number | null>(null);
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>((): Record<string, boolean> => productPresentation && productDemo?.feature === "planning" ? { life: true } : {});

  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const focusOverlayMode = workspacePanel?.kind === "timer" ? workspacePanel.id : undefined;
  const setFocusOverlayMode = (mode: string | null) => setWorkspacePanel((current) =>
    mode ? { kind: "timer", id: mode, owner: current?.kind === "timer" ? current.owner : undefined } : current?.kind === "timer" ? null : current);
  const [pomodoroTaskChoice, setPomodoroTaskChoice] = useState<string>();
  const timerIntervalRef = useRef<number | null>(null);
  const timerTaskRef = useRef<string | null>(null);
  const timerRecordRef = useRef<string|undefined>(undefined);
  const timerElapsedRef = useRef(0);
  const timerElapsedBaseRef = useRef(0);
  const timerStartedAtRef = useRef<number | null>(null);
  const timerLastActivityAtRef = useRef<number | null>(null);
  const widgetManagesTaskTimerRef = useRef(false);
  const timerOwnerRef = useRef<TimerOwner | null>(null);
  const [ownsTimerClock, setOwnsTimerClock] = useState(false);
  const mirroredTimerRef = useRef<WidgetSnapshot | null>(null);
  timerElapsedRef.current = timerElapsed;

  useEffect(() => () => {
    layerExitHandlesRef.current.forEach((handle) => handle?.cancel());
    completionHandlesRef.current.forEach((handle) => handle?.cancel());
    layerExitHandlesRef.current.clear();
    completionHandlesRef.current.clear();
    if (subtaskAiRevealTimeoutRef.current !== null) window.clearTimeout(subtaskAiRevealTimeoutRef.current);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("navopath-active-timer");
      if (saved) {
        const restored = normalizeStoredTaskTimer(JSON.parse(saved) as unknown);
        if (restored) {
          setTimerTaskId(restored.taskId);
          setTimerElapsed(restored.elapsedSeconds);
          timerElapsedBaseRef.current = restored.elapsedSeconds;
          setTimerRunning(false);
          timerTaskRef.current = restored.taskId;
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!timerOwnerRef.current?.isOwner()) return;
    if (timerTaskId) {
      timerTaskRef.current = timerTaskId;
      try { localStorage.setItem("navopath-active-timer", JSON.stringify({ taskId: timerTaskId, elapsed: timerElapsed, running: timerRunning })); } catch { /* ignore */ }
    } else {
      timerTaskRef.current = null;
      timerRecordRef.current=undefined;
      try { localStorage.removeItem("navopath-active-timer"); } catch { /* ignore */ }
    }
  }, [timerTaskId, timerElapsed, timerRunning]);

  function logTimerTransition(transition:TimerTransition,taskId:string|undefined|null,at:number,elapsed:number) {
    if(productDemo||!dataRef.current)return;
    const task=dataRef.current.tasks.find(t=>t.id===taskId);
    const recordId=task?.timelineRecords?.find(r=>r.id===timerRecordRef.current)?.id;
    if (!metricsPluginActive(extensionService.getSnapshot())) return;
    recordTimerTransition(authStateRef.current?.user?.id || "preview",taskId||undefined,transition,new Date(at).toISOString(),elapsed,task?.projectId,recordId);
  }
  const startTimer = useCallback((taskId: string,recordId?:string|null) => {
    if (!timerOwnerRef.current?.isOwner()) { timerOwnerRef.current?.sendAction({ type: "timerStart", taskId }); return; }
    const same=timerTaskRef.current===taskId;
    const baseElapsed = same ? timerElapsedRef.current : 0;
    if(!same||baseElapsed===0)timerRecordRef.current=recordId||undefined;
    else if(recordId&&timerRecordRef.current!==recordId)timerRecordRef.current=undefined;
    const now = Date.now();
    if(timerTaskRef.current!==taskId || timerStartedAtRef.current===null)logTimerTransition(baseElapsed>0?"resume":"start",taskId,now,baseElapsed);
    timerElapsedRef.current = baseElapsed;
    timerElapsedBaseRef.current = baseElapsed;
    timerStartedAtRef.current = now;
    timerLastActivityAtRef.current = now;
    timerTaskRef.current = taskId;
    setTimerElapsed(baseElapsed);
    setTimerTaskId(taskId);
    setTimerRunning(true);
    setTimerStartedAt(now);
  }, []);

  const pauseTimerAt = useCallback((now: number, reason: "pause" | "idle-pause" = "pause") => {
    if (timerStartedAtRef.current !== null) {
      const elapsed = advanceTaskElapsedSeconds(timerElapsedBaseRef.current, timerStartedAtRef.current, now);
      timerElapsedRef.current = elapsed;
      timerElapsedBaseRef.current = elapsed;
      setTimerElapsed(elapsed);
      logTimerTransition(reason,timerTaskRef.current,now,elapsed);
    }
    timerStartedAtRef.current = null;
    timerLastActivityAtRef.current = null;
    setTimerRunning(false);
    setTimerStartedAt(null);
  }, []);

  const pauseTimer = useCallback(() => {
    if (!timerOwnerRef.current?.isOwner()) { timerOwnerRef.current?.sendAction({ type: "timerPause" }); return; }
    pauseTimerAt(Date.now());
  }, [pauseTimerAt]);

  useEffect(() => {
    if (!ownsTimerClock || !timerRunning || timerStartedAt === null) {
      if (timerIntervalRef.current) { window.clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
      return;
    }
    const markTimerActivity = () => { timerLastActivityAtRef.current = Date.now(); };
    markTimerActivity();
    window.addEventListener("pointerdown", markTimerActivity, { passive: true });
    window.addEventListener("keydown", markTimerActivity);
    window.addEventListener("touchstart", markTimerActivity, { passive: true });
    window.addEventListener("scroll", markTimerActivity, { passive: true });
    timerIntervalRef.current = window.setInterval(() => {
      if (widgetManagesTaskTimerRef.current) return;
      const now = Date.now();
      const thresholdMinutes = Math.max(0, Number(settings?.idleThresholdMinutes ?? 5));
      const lastActivityAt = timerLastActivityAtRef.current ?? now;
      if (thresholdMinutes > 0 && now - lastActivityAt >= thresholdMinutes * 60_000) {
        pauseTimerAt(now,"idle-pause");
        showToast(lang === "zh" ? `已因 ${thresholdMinutes} 分钟无操作自动暂停计时` : `Timer paused after ${thresholdMinutes} minutes of inactivity`);
        return;
      }
      setTimerElapsed(advanceTaskElapsedSeconds(timerElapsedBaseRef.current, timerStartedAt, now));
    }, 1000);
    return () => {
      window.removeEventListener("pointerdown", markTimerActivity);
      window.removeEventListener("keydown", markTimerActivity);
      window.removeEventListener("touchstart", markTimerActivity);
      window.removeEventListener("scroll", markTimerActivity);
      if (timerIntervalRef.current) { window.clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    };
  }, [lang, pauseTimerAt, settings?.idleThresholdMinutes, timerRunning, timerStartedAt, ownsTimerClock]);

  const resumeTimer = useCallback(() => {
    if (!timerOwnerRef.current?.isOwner()) { timerOwnerRef.current?.sendAction({ type: "timerResume" }); return; }
    const now = Date.now();
    if(timerStartedAtRef.current===null&&timerTaskRef.current)logTimerTransition("resume",timerTaskRef.current,now,timerElapsedRef.current);
    timerElapsedBaseRef.current = timerElapsedRef.current;
    timerStartedAtRef.current = now;
    timerLastActivityAtRef.current = now;
    setTimerRunning(true);
    setTimerStartedAt(now);
  }, []);

  const discardTimer = useCallback(() => {
    if (!timerOwnerRef.current?.isOwner()) { timerOwnerRef.current?.sendAction({ type: "discardTimer" }); return; }
    const now=Date.now();
    if(timerTaskRef.current)logTimerTransition("discard",timerTaskRef.current,now,timerStartedAtRef.current===null?timerElapsedRef.current:advanceTaskElapsedSeconds(timerElapsedBaseRef.current,timerStartedAtRef.current,now));
    timerTaskRef.current = null;
    timerRecordRef.current=undefined;
    timerElapsedRef.current = 0; timerElapsedBaseRef.current = 0; timerStartedAtRef.current = null;
    setTimerTaskId(null); setTimerRunning(false); setTimerElapsed(0); setTimerStartedAt(null);
  }, []);

  const formatTimerDisplay = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }, []);

  const [timerModeRevision, setTimerModeRevision] = useState(getTimerModeRevision);
  const [timerExtensionsReady, setTimerExtensionsReady] = useState(false);
  useEffect(() => {
    const unsubscribe = subscribeTimerModes(() => setTimerModeRevision(getTimerModeRevision()));
    const ready = () => setTimerExtensionsReady(true);
    window.addEventListener("navopath:extensions-ready", ready);
    return () => { unsubscribe(); window.removeEventListener("navopath:extensions-ready", ready); };
  }, []);
  const widgetTimerPreferences = useMemo(
    () => normalizeWidgetTimerPreferences(settings?.widgetTimerPreferences),
    [settings?.widgetTimerPreferences, timerModeRevision],
  );
  const [widgetTimerRuntime, setWidgetTimerRuntime] = useState<WidgetTimerRuntime>(loadWidgetTimerRuntime);
  const widgetTimerRuntimeRef = useRef(widgetTimerRuntime);
  widgetTimerRuntimeRef.current = widgetTimerRuntime;
  const focusSessionTaskId = resolvePomodoroSessionTaskId(widgetTimerRuntime, timerTaskId);
  useEffect(() => {
    if (focusSessionTaskId !== undefined) setPomodoroTaskChoice(undefined);
  }, [focusSessionTaskId]);
  const widgetTimerAdvancedAtRef = useRef<number>((() => {
    try {
      const stored = Number(localStorage.getItem(WIDGET_TIMER_ADVANCED_AT_KEY));
      return Number.isFinite(stored) && stored >= 0 ? stored : Date.now();
    } catch { return Date.now(); }
  })());
  const widgetTimerRemainderMsRef = useRef<number>((() => {
    try {
      const stored = Number(localStorage.getItem(WIDGET_TIMER_REMAINDER_KEY));
      return Number.isFinite(stored) && stored >= 0 && stored < 1_000 ? stored : 0;
    } catch { return 0; }
  })());
  const [widgetPopoverOpen] = useState(false);

  useEffect(() => {
    if (!settings || !timerExtensionsReady) return;
    const now = Date.now();
    const normalized = normalizeWidgetTimerRuntime(widgetTimerRuntime, widgetTimerPreferences, now);
    if (JSON.stringify(normalized) !== JSON.stringify(widgetTimerRuntime)) {
      widgetTimerRuntimeRef.current = normalized;
      setWidgetTimerRuntime(normalized);
    }
  }, [settings, widgetTimerPreferences, widgetTimerRuntime, timerExtensionsReady]);

  useEffect(() => {
    if (!timerOwnerRef.current?.isOwner()) return;
    try {
      localStorage.setItem(WIDGET_TIMER_RUNTIME_KEY, JSON.stringify(widgetTimerRuntime));
      localStorage.setItem(WIDGET_TIMER_ADVANCED_AT_KEY, String(widgetTimerAdvancedAtRef.current));
      localStorage.setItem(WIDGET_TIMER_REMAINDER_KEY, String(widgetTimerRemainderMsRef.current));
    } catch { /* Ignore unavailable storage. */ }
  }, [widgetTimerRuntime]);

  const advanceWidgetTimerNow = useCallback((now = Date.now()) => {
    if (!timerOwnerRef.current?.isOwner()) return;
    const current = widgetTimerRuntimeRef.current;
    const from = Math.min(now, Math.max(current.phaseStartedAt, widgetTimerAdvancedAtRef.current));
    const work = accumulateWidgetWorkTime(
      current,
      widgetTimerPreferences,
      from,
      now,
      widgetTimerRemainderMsRef.current,
    );
    widgetTimerRemainderMsRef.current = work.remainderMs;
    const tick = advanceWidgetTimer(current, widgetTimerPreferences, now);
    widgetTimerAdvancedAtRef.current = now;
    widgetTimerRuntimeRef.current = tick.runtime;
    setWidgetTimerRuntime(tick.runtime);
    if (current.mode !== "stopwatch" && !current.unlinked && timerTaskRef.current) {
      if (work.wholeSeconds > 0) {
        const elapsed = timerElapsedRef.current + work.wholeSeconds;
        timerElapsedRef.current = elapsed;
        timerElapsedBaseRef.current = elapsed;
        setTimerElapsed(elapsed);
      }
      widgetManagesTaskTimerRef.current = true;
      timerStartedAtRef.current = tick.runtime.running && tick.countsAsWork ? now : null;
      setTimerStartedAt(tick.runtime.running && tick.countsAsWork ? now : null);
      setTimerRunning(tick.runtime.running && tick.countsAsWork);
    }
    for (const transition of tick.transitions) {
      const descriptor = getWidgetTimerNotificationDescriptor(transition, lang);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(descriptor.title, { body: descriptor.body }); } catch { /* Ignore unsupported notification shells. */ }
      }
    }
  }, [lang, widgetTimerPreferences]);

  useEffect(() => {
    if (!timerExtensionsReady || !widgetTimerRuntime.running) return;
    advanceWidgetTimerNow();
    const interval = window.setInterval(advanceWidgetTimerNow, 1_000);
    return () => window.clearInterval(interval);
  }, [advanceWidgetTimerNow, widgetTimerRuntime.running, timerExtensionsReady]);

  useEffect(() => onTimerModeRemoving((mode) => {
    setWorkspacePanel((current) => current?.kind === "timer" && current.id === mode ? null : current);
    if (!timerOwnerRef.current?.isOwner()) return;
    if (widgetTimerRuntimeRef.current.mode !== mode) return;
    advanceWidgetTimerNow();
    const now = Date.now();
    const runtime = { ...DEFAULT_WIDGET_RUNTIME, phaseStartedAt: now, pausedAt: now };
    widgetTimerRuntimeRef.current = runtime;
    widgetTimerAdvancedAtRef.current = now;
    widgetManagesTaskTimerRef.current = false;
    timerStartedAtRef.current = null;
    timerElapsedBaseRef.current = timerElapsedRef.current;
    setTimerStartedAt(null); setTimerRunning(false); setWidgetTimerRuntime(runtime);
    void saveSettings({ widgetTimerPreferences: { ...widgetTimerPreferences, mode: "stopwatch" } });
  }), [advanceWidgetTimerNow, widgetTimerPreferences]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFullscreen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY);
    const portrait = window.matchMedia("(orientation: portrait)");
    const sync = () => {
      setCompactLayout(media.matches);
      setPortraitLayout(portrait.matches);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (quickAddOpen && !compactLayout) compactQuickInputRef.current?.focus();
  }, [quickAddOpen]);

  useEffect(() => {
    if (compactLayout && !quickAddPresence.present) setQuickTitle("");
  }, [compactLayout, quickAddPresence.present]);

  useEffect(() => {
    if (!quickAddOpen) return;
    const closeCompactLayer = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if ((event.target as HTMLElement | null)?.closest(".df-dialog")) return;
      void closeMobileQuickAdd();
    };
    document.addEventListener("keydown", closeCompactLayer);
    return () => document.removeEventListener("keydown", closeCompactLayer);
  }, [quickAddOpen, quickTitle, mobileQuickAddKind]);

  const extensionSnapshot = useSyncExternalStore(extensionService.subscribe, extensionService.getSnapshot);
  const habitsEnabled = productDemo ? settings?.featureHabitsEnabled !== false : nativeFeatureActive(extensionSnapshot, "habits");
  const readingEnabled = !productDemo && nativeFeatureActive(extensionSnapshot, "reading");
  const readingAccount = authState?.user?.id || "preview";
  const [readingSnapshot, setReadingSnapshot] = useState<ReadingRuntimeSnapshot | null>(null);
  const reading = readingEnabled && readingSnapshot?.account === readingAccount ? readingSnapshot : { library: null, error: "", busy: true, mutate: async () => { throw new Error("Reading unavailable"); } };
  const engagementEnabled = productDemo ? settings?.featureEngagementEnabled === true : nativeFeatureActive(extensionSnapshot, "engagement");
  const aiEnabled = productDemo ? !settings?.hideAi : nativeFeatureActive(extensionSnapshot, "navo-ai");
  const widgetEnabled = nativeFeatureActive(extensionSnapshot, "desktop-widget");
  const countdownEnabled = Boolean(productDemo) || nativeFeatureActive(extensionSnapshot, "countdown");
  const flowtimeEnabled = Boolean(productDemo) || nativeFeatureActive(extensionSnapshot, "flowtime");
  const metricsEnabled = metricsPluginActive(extensionSnapshot);
  const availableTimerModes = () => getTimerModes().filter(mode => mode.mode !== "countdown" || nativeFeatureActive(extensionService.getSnapshot(), "countdown") || productDemo);
  useEffect(() => {
    if (extensionService.isReady() && !flowtimeEnabled && focusOverlayMode === "flowtime") setFocusOverlayMode("stopwatch");
    if (countdownEnabled || !timerExtensionsReady || !ownsTimerClock || !extensionService.isReady()) return;
    if (widgetTimerRuntimeRef.current.mode === "countdown" || settingsRef.current?.widgetTimerPreferences?.mode === "countdown") {
      // Switch to the core clock after settling accepted elapsed time; keep the task and history.
      widgetActionHandlerRef.current({ type: "setTimerMode", mode: "stopwatch" });
    }
  }, [countdownEnabled, flowtimeEnabled, focusOverlayMode, timerExtensionsReady, ownsTimerClock, settings?.extensions]);
  const isAiActive = () => Boolean(productDemo) || nativeFeatureActive(extensionService.getSnapshot(), "navo-ai");
  useEffect(() => {
    if (!aiEnabled && !productDemo && extensionService.isReady()) {
      aiAbortRef.current?.abort();
      if (aiOpen) setAiOpen(false);
      setProactiveNotifications([]);
      setUnfinishedNotification(null);
    }
  }, [aiEnabled, aiOpen, timerExtensionsReady]);
  useEffect(() => {
    if (!habitsEnabled && habitPanel && extensionService.isReady()) {
      setHabitPanel(null);
      setEditingHabitId(null);
    }
  }, [habitsEnabled, habitPanel, timerExtensionsReady]);

  const dialog = useInAppDialog(lang);
  useEffect(() => productPresentation ? undefined : installWorkspaceWheelRouting(document), []);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const timelineMutationScrollRef = useRef<{ top: number; left: number } | null>(null);
  const lastTimelineScrollRef = useRef<{ top: number; left: number; context?: string }>({ top: 0, left: 0 });
  const timelineViewportContext = `${selectedDate}:${timelineView}:${settings?.continuousCrossDayScroll !== false}:${settings?.dayStartTime}:${timelineZoom}`;
  const attachTimelineScroll = useCallback((element: HTMLDivElement | null) => {
    const previous = timelineRef.current;
    if (previous) {
      lastTimelineScrollRef.current = { top: previous.scrollTop, left: previous.scrollLeft, context: timelineViewportContext };
    }
    timelineRef.current = element;
  }, [timelineViewportContext]);
  useLayoutEffect(() => {
    const viewport = lastTimelineScrollRef.current;
    const element = timelineRef.current;
    if (!element || viewport.context !== timelineViewportContext || pendingTimelineFocus) return;
    delete viewport.context;
    element.scrollTop = viewport.top;
    element.scrollLeft = viewport.left;
  }, [timelineViewportContext, pendingTimelineFocus, workspaceSuspended]);
  const previousTimelineDataRef = useRef(data);
  const [nowInTimelineViewport, setNowInTimelineViewport] = useState(true);
  const [nowLineReturnPulse, setNowLineReturnPulse] = useState(false);
  const nowLineReturnPulseTimerRef = useRef<number | null>(null);
  const nowReturnNavigationRef = useRef(false);
  const nowReturnOriginRef = useRef<ReturnType<typeof currentTimelineViewportFocus> | null>(null);
  const nowReturnSettleTimerRef = useRef<number | null>(null);
  const nowReturnScrollEndCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => {
    if (nowLineReturnPulseTimerRef.current !== null) window.clearTimeout(nowLineReturnPulseTimerRef.current);
    if (nowReturnSettleTimerRef.current !== null) window.clearTimeout(nowReturnSettleTimerRef.current);
    nowReturnScrollEndCleanupRef.current?.();
  }, []);
  useEffect(() => {
    const element = timelineRef.current;
    if (!element) return;
    const rememberTimelineScroll = () => {
      lastTimelineScrollRef.current = { top: element.scrollTop, left: element.scrollLeft };
    };
    rememberTimelineScroll();
    element.addEventListener("scroll", rememberTimelineScroll, { passive: true });
    return () => element.removeEventListener("scroll", rememberTimelineScroll);
  }, [data, timelineView]);
  useLayoutEffect(() => {
    const previousData = previousTimelineDataRef.current;
    previousTimelineDataRef.current = data;
    if (!previousData || !data || previousData === data || timelineView === "month" || pendingTimelineFocus || continuousPrependLockRef.current) return;
    const element = timelineRef.current;
    if (!element) return;
    const scroll = lastTimelineScrollRef.current;
    element.scrollTop = scroll.top;
    element.scrollLeft = scroll.left;
  }, [data, timelineView, pendingTimelineFocus]);
  const preserveTimelineViewportOnNextDataChange = useCallback(() => {
    const element = timelineRef.current;
    if (!element) return;
    const scroll = { top: element.scrollTop, left: element.scrollLeft };
    timelineMutationScrollRef.current = scroll;
    lastTimelineScrollRef.current = scroll;
  }, []);
  useLayoutEffect(() => {
    const anchor = timelineMutationScrollRef.current;
    const element = timelineRef.current;
    if (!anchor) return;
    if (!element || timelineView === "month") {
      timelineMutationScrollRef.current = null;
      return;
    }
    continuousPrependLockRef.current = true;
    element.scrollTop = anchor.top;
    element.scrollLeft = anchor.left;
    const frame = window.requestAnimationFrame(() => {
      element.scrollTop = anchor.top;
      element.scrollLeft = anchor.left;
      if (timelineMutationScrollRef.current === anchor) timelineMutationScrollRef.current = null;
      continuousPrependLockRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [data, timelineView]);
  const suppressBlockClickRef = useRef(false);
  const suppressBlockClickTimerRef = useRef<number | null>(null);
  const suppressClickAfterDrag = useCallback(() => {
    suppressBlockClickRef.current = true;
    if (suppressBlockClickTimerRef.current !== null) {
      window.clearTimeout(suppressBlockClickTimerRef.current);
    }
    suppressBlockClickTimerRef.current = window.setTimeout(() => {
      suppressBlockClickRef.current = false;
      suppressBlockClickTimerRef.current = null;
    }, SUPPRESS_CLICK_AFTER_DRAG_MS);
  }, []);
  useEffect(() => {
    const scrollElement = timelineRef.current;
    if (!allDayDragDate || !scrollElement) return;
    const lockedScrollTop = scrollElement.scrollTop;
    const keepTimelineStill = () => {
      if (scrollElement.scrollTop !== lockedScrollTop) scrollElement.scrollTop = lockedScrollTop;
    };
    scrollElement.addEventListener("scroll", keepTimelineStill, { passive: true });
    return () => scrollElement.removeEventListener("scroll", keepTimelineStill);
  }, [allDayDragDate, timelineView]);
  const dragTargetDateRef = useRef<string>("");
  const timelineInitialFocusCompleteRef = useRef(false);
  const dataRef = useRef<PlannerData | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const authStateRef = useRef<AuthState | null>(authState);
  authStateRef.current = authState;
  const loadedWorkspaceKeyRef = useRef("");
  const workspaceLoadVersionRef = useRef(0);
  const localFallbackAppliedRef = useRef(false);
  const pendingDataSaveRef = useRef<QueuedDataSave | null>(null);
  const dataSaveTimerRef = useRef<number | null>(null);
  const dataSaveRetryTimerRef = useRef<number | null>(null);
  const dataSaveInFlightRef = useRef(false);
  const dataSaveWaitersRef = useRef<Array<() => void>>([]);
  const dataSaveVersionRef = useRef(0);
  const dataSaveRetryCountRef = useRef(0);
  const dataSaveNoticeShownRef = useRef(false);
  const pendingSettingsSaveRef = useRef<QueuedSettingsSave | null>(null);
  const settingsSaveTimerRef = useRef<number | null>(null);
  const settingsSaveRetryTimerRef = useRef<number | null>(null);
  const settingsSaveInFlightRef = useRef(false);
  const settingsSaveWaitersRef = useRef<Array<() => void>>([]);
  const settingsSaveVersionRef = useRef(0);
  const settingsSaveRetryCountRef = useRef(0);
  const settingsSaveNoticeShownRef = useRef(false);
  const queuedRemoteRefreshRef = useRef(false);
  const remoteRevisionRef = useRef(0);
  const cloudBaselineReadyRef = useRef(false);
  const remoteRevisionPollInFlightRef = useRef(false);
  const syncSchedulerRef = useRef<SyncScheduler | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const extensionHostRef = useRef<ExtensionHost | null>(null);
  const activeExtensionPanel = activeExtensionPanelId === coreHistoryView.id ? coreHistoryView : extensionSnapshot.views.find((view) => view.id === activeExtensionPanelId && !view.planningView);
  function openTaskHistory() {
    rememberLayerTrigger("utility");
    showWorkspacePanel({ kind: "extension", id: coreHistoryView.id }, true);
  }
  function openExtensionPage(page: ExtensionContribution) {
    if (page.nativeMode === "metrics") { openMetrics(); return; }
    if (page.nativeTool === "pomodoro") { openTimerMode("pomodoro", page.owner); return; }
    if (page.nativeTool === "schedule-templates") {
      showWorkspacePanel({ kind: "templates", owner: page.owner }, true);
      return;
    }
    rememberLayerTrigger("utility");
    showWorkspacePanel({ kind: "extension", id: page.id, owner: page.owner }, true);
  }
  const shelfViews = useMemo(() => productDemo?.feature === "planning" ? [demoTreeView] : [coreTreeView, ...extensionSnapshot.views.filter((view) =>
    view.planningView && view.nativeMode !== "tree" && view.nativeMode !== "metrics" && view.nativeMode !== "activity-history"
  )].sort((first, second) => {
    const order = ["tree", ...Object.keys(candidateViewNames)];
    const rank = (view: ExtensionContribution) => view.nativeMode ? order.indexOf(view.nativeMode) : order.length;
    return rank(first) - rank(second);
  }), [extensionSnapshot.views]);
  const shelfView = shelfViews.find((view) => view.id === shelfViewId);
  const shelfTreeOpen = shelfView?.nativeMode === "tree";
  const treeView = shelfViews.find((view) => view.nativeMode === "tree");
  const metricsAvailable = extensionSnapshot.views.some((view) => view.nativeMode === "metrics");
  useEffect(() => {
    if (shelfViewId && !shelfView) setShelfViewId(productDemo?.feature === "planning" ? demoTreeView.id : coreTreeView.id);
  }, [shelfViewId, shelfView]);
  const oldestTaskOperationAt = taskOperations.at(-1)?.at;
  useEffect(() => {
    if (productDemo || !oldestTaskOperationAt) return;
    const workspaceKey = loadedWorkspaceKeyRef.current;
    const delay = Date.parse(oldestTaskOperationAt) + TASK_OPERATION_RETENTION_MS - workspaceNow().getTime();
    const timer = window.setTimeout(() => changeTaskOperations(workspaceKey, (entries) => entries), Math.max(0, delay));
    return () => window.clearTimeout(timer);
  }, [oldestTaskOperationAt, productDemo]);
  useEffect(() => {
    if (activeExtensionPanelId && !activeExtensionPanel) setWorkspacePanelOpen("extension", false);
  }, [activeExtensionPanelId, activeExtensionPanel]);
  const activePlugin = workspacePanel?.owner ? extensionSnapshot.preferences.installed[workspacePanel.owner] : undefined;
  useEffect(() => {
    if (workspacePanel?.owner && !activePlugin?.enabled) {
      setWorkspacePanel((current) => current === workspacePanel ? null : current);
    }
  }, [workspacePanel, activePlugin]);
  useEffect(() => {
    if (utilityPanel === "metrics" && !metricsAvailable) closeUtilityPanel();
  }, [utilityPanel, metricsAvailable]);
  const colsContainerRef = useRef<HTMLDivElement | null>(null);
  const timeGridRef = useRef<HTMLDivElement | null>(null);
  const [multiColWidth, setMultiColWidth] = useState(0);
  const [dailyCanvasWidth, setDailyCanvasWidth] = useState(0);
  timelineZoomRef.current = timelineZoom;

  const refreshExternalCalendarLayer = useCallback(async (refreshMode: "none" | "due" | "force" = "none") => {
    const api = window.plannerApi;
    const listExternalCalendars = api.listExternalCalendars;
    if (!authStateRef.current?.user || !listExternalCalendars) {
      if (!authStateRef.current?.user) {
        setExternalCalendarSources([]);
        setExternalCalendarOccurrences([]);
      }
      return;
    }
    if (externalCalendarSyncRef.current) {
      await externalCalendarSyncRef.current;
      if (refreshMode !== "force") return;
    }
    const sync = (async () => {
    try {
      let layer = await listExternalCalendars({ from: addDays(todayIso(), -30), to: addDays(todayIso(), 365) });
      if (refreshMode !== "none" && api.refreshExternalCalendar) {
        const now = Date.now();
        const due = layer.sources.filter((source) => source.enabled && (refreshMode === "force" || !source.nextSyncAt || Date.parse(source.nextSyncAt) <= now));
        if (due.length) {
          await Promise.allSettled(due.map((source) => api.refreshExternalCalendar!(source.id, refreshMode === "force")));
          layer = await listExternalCalendars({ from: addDays(todayIso(), -30), to: addDays(todayIso(), 365) });
        }
      }
      setExternalCalendarSources(layer.sources);
      setExternalCalendarOccurrences(layer.occurrences);
    } catch (error) {
      console.warn("External calendar refresh failed", error);
    }
    })();
    externalCalendarSyncRef.current = sync;
    try { await sync; }
    finally { if (externalCalendarSyncRef.current === sync) externalCalendarSyncRef.current = null; }
  }, []);

  useEffect(() => {
    if (!authState?.user) {
      setExternalCalendarSources([]);
      setExternalCalendarOccurrences([]);
      return;
    }
    void refreshExternalCalendarLayer("force");
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshExternalCalendarLayer("due");
    }, 15 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshExternalCalendarLayer("due");
    };
    const onCalendarChanged = () => void refreshExternalCalendarLayer("none");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("navopath:external-calendar-changed", onCalendarChanged);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("navopath:external-calendar-changed", onCalendarChanged);
    };
  }, [authState?.user?.id, refreshExternalCalendarLayer]);

  useLayoutEffect(() => {
    const pinch = timelinePinchRef.current;
    const scrollElement = timelineRef.current;
    if (!pinch || !scrollElement || !timelinePinchActiveRef.current) return;
    scrollElement.scrollTop = anchoredTimelineScrollTop(pinch.anchorBaseY, timelineZoom, pinch.anchorViewportY);
  }, [timelineZoom]);

  useEffect(() => {
    const scrollElement = timelineRef.current;
    if (productPresentation || !scrollElement || !compactLayout || timelineView === "month") return;

    const verticalDistance = (touches: TouchList) => Math.abs(touches[0].clientY - touches[1].clientY);
    const verticalCentre = (touches: TouchList) => (touches[0].clientY + touches[1].clientY) / 2;
    const beginPinch = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const rect = scrollElement.getBoundingClientRect();
      const anchorViewportY = verticalCentre(event.touches) - rect.top;
      const startZoom = timelineZoomRef.current;
      timelinePinchActiveRef.current = true;
      scrollElement.classList.add("is-pinching");
      dragCreateSuppressClickRef.current = true;
      setDragCreate(null);
      timelinePinchRef.current = {
        distance: Math.max(1, verticalDistance(event.touches)),
        startZoom,
        anchorBaseY: (scrollElement.scrollTop + anchorViewportY) / startZoom,
        anchorViewportY,
      };
      event.preventDefault();
    };
    const movePinch = (event: TouchEvent) => {
      const pinch = timelinePinchRef.current;
      if (!pinch || event.touches.length !== 2) return;
      const nextZoom = timelineZoomFromPinch(pinch.startZoom, pinch.distance, verticalDistance(event.touches));
      timelinePinchPendingZoomRef.current = nextZoom;
      if (timelinePinchFrameRef.current === null) {
        timelinePinchFrameRef.current = window.requestAnimationFrame(() => {
          timelinePinchFrameRef.current = null;
          const pendingZoom = timelinePinchPendingZoomRef.current;
          if (pendingZoom === null) return;
          timelinePinchPendingZoomRef.current = null;
          if (Math.abs(pendingZoom - timelineZoomRef.current) < 0.002) return;
          timelineZoomRef.current = pendingZoom;
          setTimelineZoom(pendingZoom);
        });
      }
      event.preventDefault();
    };
    const endPinch = (event: TouchEvent) => {
      if (!timelinePinchRef.current || event.touches.length >= 2) return;
      const pendingZoom = timelinePinchPendingZoomRef.current;
      if (timelinePinchFrameRef.current !== null) {
        window.cancelAnimationFrame(timelinePinchFrameRef.current);
        timelinePinchFrameRef.current = null;
      }
      timelinePinchPendingZoomRef.current = null;
      if (pendingZoom !== null && Math.abs(pendingZoom - timelineZoomRef.current) >= 0.002) {
        timelineZoomRef.current = pendingZoom;
        setTimelineZoom(pendingZoom);
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        timelinePinchRef.current = null;
        timelinePinchActiveRef.current = false;
        scrollElement.classList.remove("is-pinching");
        window.setTimeout(() => { dragCreateSuppressClickRef.current = false; }, 80);
      }));
    };

    scrollElement.addEventListener("touchstart", beginPinch, { passive: false });
    scrollElement.addEventListener("touchmove", movePinch, { passive: false });
    scrollElement.addEventListener("touchend", endPinch, { passive: true });
    scrollElement.addEventListener("touchcancel", endPinch, { passive: true });
    return () => {
      if (timelinePinchFrameRef.current !== null) window.cancelAnimationFrame(timelinePinchFrameRef.current);
      timelinePinchFrameRef.current = null;
      timelinePinchPendingZoomRef.current = null;
      timelinePinchRef.current = null;
      timelinePinchActiveRef.current = false;
      scrollElement.classList.remove("is-pinching");
      scrollElement.removeEventListener("touchstart", beginPinch);
      scrollElement.removeEventListener("touchmove", movePinch);
      scrollElement.removeEventListener("touchend", endPinch);
      scrollElement.removeEventListener("touchcancel", endPinch);
    };
  }, [compactLayout, timelineView, data, workspaceSuspended]);

  useEffect(() => {
    const container = timelineRef.current;
    if (!productPresentation || !container || !settings) return;
    // Fit the example day using the same geometry as native task dragging.
    const minutes = timeToMinutes(settings.dayEndTime || "18:00") - timeToMinutes(settings.dayStartTime || "08:00");
    const fit = () => {
      if (container.clientHeight > 0 && minutes > 0) setTimelineZoom(Math.min(1, (container.clientHeight - 24) / (minutes / SLOT_MINUTES * SLOT_HEIGHT)));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container); fit();
    return () => observer.disconnect();
  }, [data, settings?.dayStartTime, settings?.dayEndTime]);

  // Keep column width updated for multi-day overlay positioning
  useEffect(() => {
    const el = timeGridRef.current;
    if (!el || (timelineView !== "3day" && timelineView !== "weekly")) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        const visDays = getVisibleDays(timelineView, selectedDate);
        if (visDays.length > 0) {
          const cw = w / visDays.length;
          setMultiColWidth(cw);
        }
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [timelineView, selectedDate, workspaceSuspended]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    aiBusyRef.current = aiBusy;
    aiInputRef.current = aiInput;
  }, [aiBusy, aiInput]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!authState?.user || !window.plannerApi.subscribeToRemoteChanges) return;
    const userId = authState.user.id;
    const workspaceKey = `cloud:${userId}`;
    return window.plannerApi.subscribeToRemoteChanges((remote) => {
      const incomingRevision = Number(remote.revision || 0);
      const cached = readBootstrapCache(userId);
      const hasDirtyLocal = Boolean(cached?.dataDirty || cached?.settingsDirty);
      if (workspaceKey !== loadedWorkspaceKeyRef.current) return;
      if (cloudBaselineReadyRef.current && !hasDirtyLocal && !shouldApplyWorkspaceRevision(workspaceKey, loadedWorkspaceKeyRef.current, remoteRevisionRef.current, incomingRevision)) return;
      if (pendingDataSaveRef.current || pendingSettingsSaveRef.current || dataSaveInFlightRef.current || settingsSaveInFlightRef.current) {
        queuedRemoteRefreshRef.current = true;
        return;
      }
      const resolved = resolveBootstrap(cached, remote.data, remote.settings);
      if (!resolved.data || !resolved.settings) return;
      const migratedData = migrateLegacyHabitTracker(resolved.data, resolved.settings.pluginConfigs);
      remoteRevisionRef.current = Math.max(remoteRevisionRef.current, incomingRevision);
      if (cloudBaselineReadyRef.current && !hasDirtyLocal && !resolved.replayData && dataRef.current && !productDemo && metricsPluginActive(extensionService.getSnapshot())) recordLocalAnalyticsChange(userId,dataRef.current,migratedData,workspaceNow().toISOString(),"remote-observed",incomingRevision>0?`remote:${incomingRevision}`:undefined);
      cloudBaselineReadyRef.current = true;
      dataRef.current = migratedData;
      settingsRef.current = resolved.settings;
      setData(migratedData);
      setSettings(resolved.settings);
      setLang(resolved.settings.language || lang);
      writeBootstrapCache(migratedData, resolved.settings, userId, {
        dataDirty: resolved.replayData,
        settingsDirty: resolved.replaySettings,
        remoteRevision: remote.revision,
      });
      if (resolved.replayData || migratedData !== resolved.data) void saveData(migratedData);
      if (resolved.replaySettings) void saveSettings(resolved.settings);
    });
  }, [authState?.user?.id]);

  // Supabase Realtime uses a direct WebSocket that can be delayed or blocked on
  // some mobile networks. A tiny foreground-only revision check keeps devices
  // converged without repeatedly downloading the full workspace.
  useEffect(() => {
    if (!authState?.user || !window.plannerApi.getRemoteRevision) return;
    const userId = authState.user.id;
    let disposed = false;
    const reconcileIfNeeded = async () => {
      if (disposed
        || document.visibilityState !== "visible"
        || (typeof navigator !== "undefined" && navigator.onLine === false)
        || remoteRevisionPollInFlightRef.current) return;
      remoteRevisionPollInFlightRef.current = true;
      try {
        const incomingRevision = Number(await window.plannerApi.getRemoteRevision?.() || 0);
        if (disposed || authStateRef.current?.user?.id !== userId) return;
        const cached = readBootstrapCache(authStateRef.current?.user?.id);
        if (shouldReconcileRemoteRevision(
          remoteRevisionRef.current,
          incomingRevision,
          Boolean(cached?.dataDirty || cached?.settingsDirty),
        )) {
          queuedRemoteRefreshRef.current = true;
          await refreshQueuedRemote();
        }
      } catch {
        // Realtime and the next foreground poll remain available after a transient failure.
      } finally {
        remoteRevisionPollInFlightRef.current = false;
      }
    };
    const onForeground = () => {
      if (document.visibilityState === "visible") void reconcileIfNeeded();
    };
    void reconcileIfNeeded();
    const interval = window.setInterval(() => void reconcileIfNeeded(), REMOTE_REVISION_POLL_MS);
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    window.addEventListener("pageshow", onForeground);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
      window.removeEventListener("pageshow", onForeground);
    };
  }, [authState?.user?.id]);

  useEffect(() => {
    if (!data || aiMessages.length > 0) return;
    const conversations = data.aiConversations || [];
    const active = conversations.find((conversation) => conversation.id === (data.activeAiConversationId || activeAiConversationId)) || conversations[0];
    if (active) {
      setActiveAiConversationId(active.id);
      setAiMessages(chatToSessionMessages(active.messages || []));
    } else {
      const restored = chatToSessionMessages(data.chat || []);
      if (restored.length > 0) setAiMessages(restored);
    }
  }, [data?.generatedAt]);

  useEffect(() => {
    if (productDemo || !aiOpen || !freshAiConversationRef.current || !data) return;
    freshAiConversationRef.current = false;
    void startNewAiConversation();
  }, [aiOpen, data]);

  useEffect(() => {
    if (timelineView === "daily") setFullscreen(false);
  }, [timelineView]);

  // Range views become the compact reading mode when the candidate shelf is
  // collapsed. Keep this derived here so every collapse/expand entry point is
  // consistent, including the week-view fullscreen control.
  useEffect(() => {
    const supportsCompactRange = timelineView === "3day" || timelineView === "weekly" || timelineView === "month";
    setSimpleView((candidatePanelCollapsed || fullscreen) && supportsCompactRange);
  }, [candidatePanelCollapsed, fullscreen, timelineView]);

  function resetWorkspaceUi() {
    timerRecordRef.current=undefined;
    workspaceLoadVersionRef.current += 1;
    pendingDataSaveRef.current = null;
    pendingSettingsSaveRef.current = null;
    dataSaveVersionRef.current += 1;
    settingsSaveVersionRef.current += 1;
    setSaveFeedback(IDLE_SAVE_FEEDBACK);
    dataSaveRetryCountRef.current = 0;
    settingsSaveRetryCountRef.current = 0;
    dataSaveNoticeShownRef.current = false;
    settingsSaveNoticeShownRef.current = false;
    if (dataSaveTimerRef.current) window.clearTimeout(dataSaveTimerRef.current);
    if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
    if (settingsSaveTimerRef.current) window.clearTimeout(settingsSaveTimerRef.current);
    if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
    dataSaveTimerRef.current = null;
    dataSaveRetryTimerRef.current = null;
    settingsSaveTimerRef.current = null;
    settingsSaveRetryTimerRef.current = null;
    queuedRemoteRefreshRef.current = false;
    remoteRevisionRef.current = 0;
    cloudBaselineReadyRef.current = false;
    if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = null;
    setShelfViewId(productDemo?.feature === "planning" ? demoTreeView.id : "");
    setTaskOperations([]);
    dismissToast();
    planningSessionRef.current = null;
    setShelfMenuOpen(false);
    setShowScheduledCandidates(false);
    setCompactExecuteView("schedule");
    setQuickAddOpen(false);
    setSelectedDate(todayIso());
    setTimelineView("daily");
    setDrag(null);
    setResizePreview(null);
    setHoverSlot("");
    setHoveredBlock("");
    setDrawerOpen(false);
    setEditingId("");
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setForm(defaultForm());
    setWorkspacePanel(null);
    setAiMessages([]);
    setActiveAiConversationId("");
    setAiConversationListOpen(false);
    setAiMemoryNotice("");
    setAiActionPatches({});
    clearAiAttachment();
    setSchedulePreviews([]);
    setAutoScheduleState("idle");
    setQuickTitle("");
    setQuickProjectId("");
    setQuickProjectOpen(false);
    setUtilityPanel(null);
    setCandidatePanelCollapsed(false);
    setFullscreen(false);
    setSimpleView(false);
    setShowCompletedCandidates(false);
    setGroupByProject(true);
    setToast(null);
    setToastAction(null);
  }

  function scheduleSnapshotWrite() {
    if (typeof window === "undefined" || isCompactWindowRoute || !window.desktopApi?.writeSnapshot) return;
    if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = window.setTimeout(() => {
      snapshotTimerRef.current = null;
      try {
        void window.desktopApi?.writeSnapshot?.({
          data: dataRef.current,
          settings: settingsRef.current,
          authUser: authStateRef.current?.user ?? null,
        });
      } catch (err) {
        console.warn("[snapshot] write failed:", err);
      }
    }, 1500);
  }

  async function loadInitial() {
    let loadVersion = workspaceLoadVersionRef.current + 1;
    workspaceLoadVersionRef.current = loadVersion;
    let attemptedCloudUser = false;
    try {
    const api = await waitForPlannerApi();
    const auth = (await api.getAuthState?.()) || { mode: "local" as const, user: null, configured: false };
    if (!isCurrentWorkspaceLoad(loadVersion, workspaceLoadVersionRef.current)) return;
    attemptedCloudUser = auth.mode === "cloud" && Boolean(auth.user);
    const workspaceKey = auth.mode === "cloud" ? `cloud:${auth.user?.id || "signed-out"}` : "local";
    if (loadedWorkspaceKeyRef.current && loadedWorkspaceKeyRef.current !== workspaceKey) {
      resetWorkspaceUi();
      loadVersion = workspaceLoadVersionRef.current + 1;
      workspaceLoadVersionRef.current = loadVersion;
    }
    loadedWorkspaceKeyRef.current = workspaceKey;
    cloudBaselineReadyRef.current = auth.mode !== "cloud";
    setAuthState(auth);
    if (!productDemo && (auth.mode !== "cloud" || auth.user)) recoverAnalytics(auth.user?.id || "preview");
    if (auth.mode === "cloud" && !auth.user) {
      setData(null);
      setSettings(null);
      return;
    }
    if (!productDemo) {
      const time = workspaceNow().getTime();
      void updateSavedTaskOperations(workspaceKey, (entries) => entries, time).then((stored) => {
        if (!isCurrentWorkspaceLoad(loadVersion, workspaceLoadVersionRef.current)
          || workspaceKey !== loadedWorkspaceKeyRef.current) return;
        setTaskOperations((current) => {
          const byId = new Map(stored.map((entry) => [entry.id, entry]));
          for (const entry of current) {
            if (!byId.get(entry.id)?.undone) byId.set(entry.id, entry);
          }
          return recentTaskOperations([...byId.values()], workspaceNow().getTime());
        });
      }).catch((error) => console.warn("Activity history could not be loaded:", error));
    }
    const cached = readBootstrapCache(auth.user?.id);
if (cached?.data && cached?.settings) {
      dataRef.current = cached.data;
      settingsRef.current = cached.settings;
      setData(cached.data);
      setSettings(cached.settings);
      if (cached.settings.language) setLang(cached.settings.language);
      if (cached.settings.defaultTimelineView) setTimelineView(cached.settings.defaultTimelineView);
    }
    if (cached?.remoteRevision) remoteRevisionRef.current = Math.max(remoteRevisionRef.current, cached.remoteRevision);
    let bootstrap = api.getBootstrap
      ? await api.getBootstrap({ force: auth.mode === "cloud" })
      : {
        auth,
        data: await api.getData(),
        settings: await api.getSettings()
      };
    if (!isCurrentWorkspaceLoad(loadVersion, workspaceLoadVersionRef.current)
      || loadedWorkspaceKeyRef.current !== workspaceKey) return;
    if (auth.mode === "cloud" && Number(bootstrap.revision || 0) < remoteRevisionRef.current && api.getBootstrap) {
      bootstrap = await api.getBootstrap({ force: true });
      if (!isCurrentWorkspaceLoad(loadVersion, workspaceLoadVersionRef.current)
        || loadedWorkspaceKeyRef.current !== workspaceKey) return;
    }
    setAuthError("");
    // Edits made while the network request was in flight must remain dirty.
    const latestCache = readBootstrapCache(auth.user?.id) || cached;
    const resolved = resolveBootstrap(latestCache, bootstrap.data, bootstrap.settings);
    let nextData = resolved.data;
    let nextSettings = resolved.settings;
    const shouldPushCachedData = resolved.replayData;
    let shouldPushCachedSettings = resolved.replaySettings;
    if (!nextData || !nextSettings) return;
    const cachedAccountRecovery = recoverAccountSettings(nextSettings, latestCache?.settings, auth.user?.id, auth.user?.id);
    nextSettings = cachedAccountRecovery.settings;
    shouldPushCachedSettings ||= cachedAccountRecovery.recovered;
    if (auth.user && window.desktopApi?.readLatestSnapshot) {
      try {
        const recovery = await window.desktopApi.readLatestSnapshot();
        if (recovery.ok && recovery.payload?.settings) {
          const accountRecovery = recoverAccountSettings(
            nextSettings,
            recovery.payload.settings,
            auth.user.id,
            recovery.payload.authUser?.id,
          );
          nextSettings = accountRecovery.settings;
          shouldPushCachedSettings ||= accountRecovery.recovered;
        }
      } catch (snapshotErr) {
        console.warn("[loadInitial] account recovery snapshot read failed:", snapshotErr);
      }
    }
    const migratedHabitData = migrateLegacyHabitTracker(nextData, nextSettings.pluginConfigs);
    const shouldPersistHabitMigration = migratedHabitData !== nextData;
    nextData = migratedHabitData;
    // Migrate legacy task scheduling fields into timelineRecords
    if (nextData.tasks) {
      nextData.tasks = nextData.tasks.map((task) => {
        if (task.timelineRecords && task.timelineRecords.length > 0) return task;
        if (!task.scheduledDate || !task.scheduledStart) return task;
        const record: TimelineRecord = {
          id: task.id + "_rec_0",
          taskId: task.id,
          scheduledDate: task.scheduledDate,
          scheduledStart: task.scheduledStart,
          ...calculateTimelineRecordEnd(task.scheduledDate, task.scheduledStart, taskDuration(task)),
          executionStatus: task.executionStatus || "scheduled",
          createdAt: task.updatedAt || workspaceNow().toISOString(),
        };
        return { ...task, timelineRecords: [record], scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, executionStatus: undefined };
      });
    }
    remoteRevisionRef.current = Math.max(Number(bootstrap.revision || 0), remoteRevisionRef.current);
    writeBootstrapCache(nextData, nextSettings, auth.user?.id, {
      dataDirty: shouldPushCachedData,
      settingsDirty: shouldPushCachedSettings,
      remoteRevision: bootstrap.revision,
    });
    dataRef.current = nextData;
    settingsRef.current = nextSettings;
    cloudBaselineReadyRef.current = true;
    setData(nextData);
    setSettings(nextSettings);
    if (productDemo?.feature === "ai") setAiMessages([]);
    productDemo?.ready();
    if (nextSettings.language) setLang(nextSettings.language);
    if (nextSettings.defaultTimelineView) setTimelineView(nextSettings.defaultTimelineView);
    if ((shouldPushCachedData || shouldPersistHabitMigration) && nextData) void saveData(nextData);
    if (shouldPushCachedSettings) void saveSettings(nextSettings);
    // Persist a local JSON snapshot so users always have an offline backup.
    if (!isCompactWindowRoute) {
      try {
        void window.desktopApi?.writeSnapshot?.({
          data: nextData,
          settings: nextSettings,
          authUser: auth.user ?? null,
        });
      } catch (snapshotErr) {
        console.warn("[loadInitial] snapshot write failed:", snapshotErr);
      }
    }
    } catch (err) {
      if (!isCurrentWorkspaceLoad(loadVersion, workspaceLoadVersionRef.current)) return;
      console.error("Failed to load initial data:", err);
      if (attemptedCloudUser) {
        const message = err instanceof Error ? err.message : String(err);
        if (dataRef.current && settingsRef.current) {
          showToast(lang === "zh" ? "云端数据暂时无法加载，已保留本机缓存。" : "Cloud data could not load. Keeping this device's cache.");
        } else {
          setAuthError(message || (lang === "zh" ? "云端数据暂时无法加载，请稍后重试。" : "Cloud data could not load. Please try again later."));
        }
        return;
      }
      if (!localFallbackAppliedRef.current) {
        localFallbackAppliedRef.current = true;
        forceLocalPreviewMode();
        void loadInitial();
      }
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const hasConfirmationCallback = url.searchParams.has("auth_callback")
      || url.searchParams.has("code")
      || url.searchParams.has("token_hash")
      || /access_token|error_description|type=signup/i.test(url.hash);
    const initialize = async () => {
      if (hasConfirmationCallback) {
        setAuthBusy(true);
        try {
          const api = await waitForPlannerApi();
          const result = await api.completeEmailConfirmation?.();
          if (result?.confirmed) resetWorkspaceUi();
          if (result?.message) setAuthError(result.message);
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : String(error));
        } finally {
          setAuthBusy(false);
        }
      }
      await loadInitial();
    };
    void initialize().catch((error) => {
      setAuthBusy(false);
      setAuthError(error instanceof Error ? error.message : String(error));
    });
  }, []);

  async function handleAuthSubmit(email: string, password: string, displayName: string, intent: "signin" | "signup", preferredTheme: Settings["theme"], privacyAccepted: boolean) {
    if (!privacyAccepted) return;
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice(null);
    try {
      const api = await waitForPlannerApi();
      let feedbackMessage = "";
      if (intent === "signup") {
        const response = await api.signUp?.(email, password);
        if (response?.user || response?.requiresEmailConfirmation) await rememberWebNotification(response.email || email);
        if (response?.requiresEmailConfirmation) {
          setAuthNotice({ type: "confirm-email", email: response.email || email });
          return;
        }
        feedbackMessage = response?.message || "";
      } else {
        await api.signIn?.(email, password);
      }
      resetWorkspaceUi();
      await loadInitial();
      const current = settingsRef.current;
      if (current) {
        const patch: Partial<Settings> = {};
        if (displayName && current.displayName !== displayName) patch.displayName = displayName;
        if (current.theme !== preferredTheme) patch.theme = preferredTheme;
        if (Object.keys(patch).length > 0) await saveSettings(patch);
      }
      if (feedbackMessage) setAuthError(feedbackMessage);
      if (!isWorkspaceRoute) window.location.assign("/app");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function resendConfirmation(email: string) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const api = await waitForPlannerApi();
      const response = await api.resendConfirmation?.(email);
      if (response?.message) setAuthError(response.message);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function continueAfterConfirm(email: string) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const api = await waitForPlannerApi();
      const confirmation = await api.completeEmailConfirmation?.();
      if (confirmation?.confirmed) {
        setAuthNotice(null);
        resetWorkspaceUi();
        await loadInitial();
        return;
      }
      setAuthNotice({ type: "confirm-email", email });
      setAuthError(confirmation?.message || (lang === "zh" ? "尚未检测到邮箱验证。请点击最新确认邮件中的链接，或验证后直接使用邮箱与密码登录。" : "Email confirmation not detected yet. Please click the link in your latest confirmation email, or sign in after confirming."));
    } catch (error) {
      setAuthNotice({ type: "confirm-email", email });
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      try {
        await flushPendingSave({ urgent: true });
        await flushPendingSettings({ urgent: true });
      } catch {
        // A stale or expired session must not prevent the user from signing out.
        pendingDataSaveRef.current = null;
        pendingSettingsSaveRef.current = null;
      }
      const api = await waitForPlannerApi();
      await api.signOut?.();
      resetWorkspaceUi();
      loadedWorkspaceKeyRef.current = "cloud:signed-out";
      dataRef.current = null;
      settingsRef.current = null;
      setUtilityPanel(null);
      setData(null);
      setSettings(null);
      setAuthState({ mode: "cloud", user: null, configured: true });
      await loadInitial();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDeleteAccount() {
    const confirmed = await dialog.confirm(lang === "zh"
      ? "确定永久删除账户和全部 NavoPath 数据吗？此操作无法撤销。"
      : "Permanently delete your account and all NavoPath data? This cannot be undone.");
    if (!confirmed) return;
    try {
      await flushPendingSave({ urgent: true });
      await flushPendingSettings({ urgent: true });
      const api = await waitForPlannerApi();
      await api.deleteAccount?.();
      await updateSavedTaskOperations(loadedWorkspaceKeyRef.current, () => [], workspaceNow().getTime())
        .catch((error) => console.warn("Activity history could not be cleared:", error));
      resetWorkspaceUi();
      setUtilityPanel(null);
      setData(null);
      setSettings(null);
      await loadInitial();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  function requestTimelineFocus(target: TimelineFocusTarget) {
    setPendingTimelineFocus(target);
  }

  function resolveVisibleAnchorForDate(date: string) {
    return timelineView === "weekly" ? startOfWeekIso(date) : date;
  }

  useEffect(() => {
    const flushForLifecycle = () => {
      void flushPendingSave({ urgent: true }).catch(() => undefined);
      void flushPendingSettings({ urgent: true }).catch(() => undefined);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushForLifecycle();
    };
    const handleOnline = () => {
      void flushPendingSave();
      void flushPendingSettings();
      const cached = readBootstrapCache(authStateRef.current?.user?.id);
      if (cached?.dataDirty || cached?.settingsDirty) {
        queuedRemoteRefreshRef.current = true;
        void refreshQueuedRemote();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushForLifecycle);
    window.addEventListener("beforeunload", flushForLifecycle);
    window.addEventListener("online", handleOnline);
    return () => {
      workspaceLoadVersionRef.current += 1;
      if (dataSaveTimerRef.current) window.clearTimeout(dataSaveTimerRef.current);
      if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
      if (settingsSaveTimerRef.current) window.clearTimeout(settingsSaveTimerRef.current);
      if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
      if (snapshotTimerRef.current) window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushForLifecycle);
      window.removeEventListener("beforeunload", flushForLifecycle);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const dayStartHour = useMemo(() => {
    const ds = settings?.dayStartTime;
    if (!ds) return 0;
    const parts = ds.split(":").map(Number);
    const h = parts[0];
    const m = parts[1] || 0;
    if (!Number.isFinite(h) || h < 0 || h > 23) return 0;
    if (!Number.isFinite(m) || m < 0 || m >= 60) return h;
    // Return float hours so dayStartHour * 60 yields correct minutes
    // (e.g. "09:30" → 9.5 → 570 minutes). All downstream math uses
    // startHour * 60, so a float works transparently.
    return h + m / 60;
  }, [settings?.dayStartTime]);

  useLayoutEffect(() => {
    if (timelineInitialFocusCompleteRef.current) return;
    if (pendingTimelineFocus) return;
    if (!data || timelineView === "month") return;
    const nowDate = todayIso();
    if (selectedDate !== nowDate) {
      setSelectedDate(nowDate);
      setVisibleTimelineDate(nowDate);
      return;
    }
    let observer: ResizeObserver | null = null;
    let settled = false;
    let stableAlignTimer: number | null = null;
    const alignTimeline = () => {
      const container = timelineRef.current;
      if (!container || container.clientHeight <= 0 || container.scrollHeight <= container.clientHeight) return false;
      const now = workspaceNow();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = currentMinutes;
      const effectColumnCount = timelineView === "weekly" ? 7 : timelineView === "3day" ? 3 : 1;
      const effectEnabled = settings?.continuousCrossDayScroll !== false;
      const effectAnchorDate = timelineView === "weekly" ? getVisibleDays("weekly", selectedDate)[0] : selectedDate;
      const effectStartDate = buildDailyContinuousDates(effectAnchorDate, effectEnabled, continuousTimelineDayCount(effectColumnCount))[0] || selectedDate;
      let offset = Math.round((new Date(`${selectedDate}T00:00:00`).getTime() - new Date(`${effectStartDate}T00:00:00`).getTime()) / 86400000);
      let minutesFromDayStart = targetMinutes - dayStartHour * 60;
      if (minutesFromDayStart < 0) {
        minutesFromDayStart += 24 * 60;
        if (effectColumnCount === 1) offset -= 1;
      }
      const bandIndex = Math.floor(offset / effectColumnCount);
      const targetTop = effectEnabled
        ? bandIndex * ((24 * 60 / SLOT_MINUTES) * timelineSlotHeight) + (minutesFromDayStart / SLOT_MINUTES) * timelineSlotHeight
        : (minutesFromDayStart / SLOT_MINUTES) * timelineSlotHeight;
      container.scrollTop = Math.max(0, targetTop - timelineFocusViewportOffset(container));
      lastTimelineScrollRef.current = { top: container.scrollTop, left: container.scrollLeft };
      timelineInitialFocusCompleteRef.current = true;
      settled = true;
      observer?.disconnect();
      return true;
    };
    const alignAfterLayoutSettles = () => {
      const container = timelineRef.current;
      if (!container || !alignTimeline()) return false;
      const alignedScrollTop = container.scrollTop;
      stableAlignTimer = window.setTimeout(() => {
        const currentContainer = timelineRef.current;
        if (!currentContainer || Math.abs(currentContainer.scrollTop - alignedScrollTop) > 3) return;
        alignTimeline();
      }, 260);
      return true;
    };
    const frame = window.requestAnimationFrame(() => {
      if (alignAfterLayoutSettles()) return;
      const container = timelineRef.current;
      if (!container) return;
      observer = new ResizeObserver(() => { if (!settled) alignAfterLayoutSettles(); });
      observer.observe(container);
      if (timelineCanvasRef.current) observer.observe(timelineCanvasRef.current);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (stableAlignTimer !== null) window.clearTimeout(stableAlignTimer);
      observer?.disconnect();
    };
  }, [data, selectedDate, timelineView, pendingTimelineFocus, dayStartHour, settings?.continuousCrossDayScroll, timelineSlotHeight]);

  // Scroll timeline to day start time when the setting changes
  const prevDayStartRef = useRef<string>("");
  useEffect(() => {
    const dayStart = settings?.dayStartTime || "00:00";
    const isInitial = !prevDayStartRef.current;
    if (!productDemo && !isInitial && prevDayStartRef.current !== dayStart) {
      const [h, m] = dayStart.split(":").map(Number);
      const startMinutes = (h || 0) * 60 + (m || 0);
      if (timelineRef.current) {
        const targetTop = ((startMinutes - dayStartHour * 60) / SLOT_MINUTES) * timelineSlotHeight;
        timelineRef.current.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }
      showToast(lang === "zh" ? `一天开始时间已设为 ${dayStart}` : `Day start time set to ${dayStart}`);
    }
    prevDayStartRef.current = dayStart;
  }, [settings?.dayStartTime, lang, dayStartHour, timelineSlotHeight]);

  useLayoutEffect(() => {
    if (!pendingTimelineFocus) return;
    const targetDate = pendingTimelineFocus.date;
    const visibleDays = getVisibleDays(timelineView === "weekly" ? "weekly" : (timelineView === "3day" ? "3day" : "daily"), selectedDate);
    if (!visibleDays.includes(targetDate)) {
      const anchorDate = resolveVisibleAnchorForDate(targetDate);
      setSelectedDate(anchorDate);
      return;
    }
    const container = timelineRef.current;
    if (!container) return;
    const targetMinutes = pendingTimelineFocus.startTime
      ? timeToMinutes(pendingTimelineFocus.startTime)
      : Math.max(TIMELINE_START * 60, 9 * 60);
    const effectColumnCount = timelineView === "weekly" ? 7 : timelineView === "3day" ? 3 : 1;
    const effectEnabled = settings?.continuousCrossDayScroll !== false && timelineView !== "month";
    const effectAnchorDate = timelineView === "weekly" ? getVisibleDays("weekly", selectedDate)[0] : selectedDate;
    const effectStartDate = buildDailyContinuousDates(effectAnchorDate, effectEnabled, continuousTimelineDayCount(effectColumnCount))[0] || selectedDate;
    const effectTop = (date: string, time: string) => {
      let offset = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${effectStartDate}T00:00:00`).getTime()) / 86400000);
      let minutesFromDayStart = timeToMinutes(time) - dayStartHour * 60;
      if (minutesFromDayStart < 0) {
        minutesFromDayStart += 24 * 60;
        if (effectColumnCount === 1) offset -= 1;
      }
      const resolvedBandIndex = Math.floor(offset / effectColumnCount);
      return resolvedBandIndex * ((24 * 60 / SLOT_MINUTES) * timelineSlotHeight) + (minutesFromDayStart / SLOT_MINUTES) * timelineSlotHeight;
    };
    const targetTop = effectEnabled
      ? effectTop(targetDate, minutesToTime(targetMinutes))
      : (((targetMinutes - dayStartHour * 60 + 24 * 60) % (24 * 60)) / SLOT_MINUTES) * timelineSlotHeight;
    if (pendingTimelineFocus.source === "now" && nowReturnOriginRef.current) {
      const origin = nowReturnOriginRef.current;
      nowReturnOriginRef.current = null;
      // Rebase the previous date into today's canvas before choosing the scroll direction.
      const originOffset = origin.viewportY === undefined
        ? timelineFocusViewportOffset(container)
        : origin.viewportY - container.getBoundingClientRect().top;
      container.scrollTo({ top: Math.max(0, effectTop(origin.date, origin.startTime) - originOffset), behavior: "instant" });
    }
    const frame = window.requestAnimationFrame(() => {
      const viewportOffset = pendingTimelineFocus.viewportY === undefined
        ? timelineFocusViewportOffset(container)
        : pendingTimelineFocus.viewportY - container.getBoundingClientRect().top;
      const nextScrollTop = Math.max(0, targetTop - viewportOffset);
      container.scrollTo({ top: nextScrollTop, behavior: pendingTimelineFocus.behavior || "auto" });
      setVisibleTimelineDate(targetDate);
      timelineInitialFocusCompleteRef.current = true;
      lastTimelineScrollRef.current = { top: container.scrollTop, left: container.scrollLeft };
      if (pendingTimelineFocus.highlight && pendingTimelineFocus.taskId) {
        const node = container.querySelector<HTMLElement>(`.df-time-block[data-task-id="${CSS.escape(pendingTimelineFocus.taskId)}"]`);
        if (node) highlightTaskLocation(node);
      }
      if (pendingTimelineFocus.source === "now") {
        if (nowReturnSettleTimerRef.current !== null) window.clearTimeout(nowReturnSettleTimerRef.current);
        nowReturnScrollEndCleanupRef.current?.();
        const alignToNowLine = () => {
          const currentContainer = timelineRef.current;
          const nowLine = timelineCanvasRef.current?.querySelector<HTMLElement>(".df-now-line");
          if (currentContainer !== container || !nowLine) return null;
          const desiredY = currentContainer.getBoundingClientRect().top + timelineFocusViewportOffset(currentContainer);
          currentContainer.scrollTop += nowLine.getBoundingClientRect().top - desiredY;
          lastTimelineScrollRef.current = { top: currentContainer.scrollTop, left: currentContainer.scrollLeft };
          return currentContainer.scrollTop;
        };
        let finished = false;
        const finishReturn = () => {
          if (finished) return;
          finished = true;
          nowReturnScrollEndCleanupRef.current?.();
          nowReturnScrollEndCleanupRef.current = null;
          if (nowReturnSettleTimerRef.current !== null) window.clearTimeout(nowReturnSettleTimerRef.current);
          const alignedTop = alignToNowLine();
          nowReturnSettleTimerRef.current = window.setTimeout(() => {
            if (alignedTop !== null && Math.abs(container.scrollTop - alignedTop) < 3) alignToNowLine();
            nowReturnSettleTimerRef.current = null;
            window.requestAnimationFrame(() => {
              setVisibleTimelineDate(targetDate);
              nowReturnNavigationRef.current = false;
            });
          }, 240);
        };
        container.addEventListener("scrollend", finishReturn, { once: true });
        nowReturnScrollEndCleanupRef.current = () => container.removeEventListener("scrollend", finishReturn);
        nowReturnSettleTimerRef.current = window.setTimeout(finishReturn, 1400);
      }
      setPendingTimelineFocus(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingTimelineFocus, selectedDate, timelineView, dayStartHour, settings?.continuousCrossDayScroll, timelineSlotHeight]);

  useEffect(() => {
    const effectColumnCount = timelineView === "weekly" ? 7 : timelineView === "3day" ? 3 : 1;
    const effectEnabled = settings?.continuousCrossDayScroll !== false && timelineView !== "month";
    if (pendingTimelineFocus) return;
    if (!effectEnabled) {
      setVisibleTimelineDate(selectedDate);
      return;
    }
    const scrollElement = timelineRef.current;
    if (!scrollElement) return;
    const effectAnchorDate = timelineView === "weekly" ? getVisibleDays("weekly", selectedDate)[0] : selectedDate;
    const effectDates = buildDailyContinuousDates(effectAnchorDate, true, continuousTimelineDayCount(effectColumnCount));
    const effectStartDate = effectDates[0] || selectedDate;
    const effectBandCount = Math.max(1, Math.ceil(effectDates.length / effectColumnCount));
    const dayHeight = (24 * 60 / SLOT_MINUTES) * timelineSlotHeight;
    const bufferBands = Math.max(1, Math.floor(effectBandCount / 4));
    // Label-only update: safe to call on init (no state shift, no loop risk).
    const updateVisibleLabel = () => {
      // Keep the dates above the grid aligned with the band at its visible top.
      const bandIndex = Math.max(0, Math.min(effectBandCount - 1, Math.floor(scrollElement.scrollTop / dayHeight)));
      const nextDate = getContinuousTimelineDateForOffset(effectStartDate, bandIndex, effectColumnCount);
      setVisibleTimelineDate((current) => current === nextDate ? current : nextDate);
    };
    // Full scroll handler: label + infinite-scroll prepend/append. Only invoked
    // on real scroll events, never on effect init, so mount-time scrollTop=0
    // cannot trigger a setSelectedDate feedback loop.
    const handleTimelineScroll = () => {
      if (nowReturnNavigationRef.current) return;
      updateVisibleLabel();
      if (continuousPrependLockRef.current || timelinePinchActiveRef.current) return;
      // Guard: if the container isn't scrollable (not laid out yet or content
      // fits), skip prepend/append entirely to avoid a compensation clamp loop.
      if (scrollElement.scrollHeight <= scrollElement.clientHeight) return;
      const distanceFromBottom = scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop;
      if (scrollElement.scrollTop < dayHeight && effectBandCount > 1) {
        // Near top — prepend earlier bands.
        continuousPrependLockRef.current = true;
        continuousScrollRestoreRef.current = { oldScrollTop: scrollElement.scrollTop, shiftBands: bufferBands };
        setSelectedDate(addDays(selectedDate, -bufferBands * effectColumnCount));
      } else if (distanceFromBottom < dayHeight && effectBandCount > 1) {
        // Near bottom — append later bands.
        continuousPrependLockRef.current = true;
        continuousScrollRestoreRef.current = { oldScrollTop: scrollElement.scrollTop, shiftBands: -bufferBands };
        setSelectedDate(addDays(selectedDate, bufferBands * effectColumnCount));
      }
    };
    updateVisibleLabel();
    scrollElement.addEventListener("scroll", handleTimelineScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handleTimelineScroll);
  }, [settings?.continuousCrossDayScroll, timelineView, selectedDate, pendingTimelineFocus, timelineSlotHeight, workspaceLoaded, workspaceSuspended]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 899.98px) and (orientation: portrait)");
    const update = () => setPhoneLayout(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function closeCandidateDrawer() {
    setShelfMenuOpen(false);
    if (!shelfView) {
      candidateScrollRef.current = candidatePanelRef.current?.querySelector(".df-candidate-list")?.scrollTop || 0;
    }
    setCandidateDrawerOpen(false);
    candidateTriggerRef.current?.focus();
  }

  function openQuickTaskAdd(projectId?: string, fromProjectTree = false) {
    if (candidateDrawerOpen) closeCandidateDrawer();
    setQuickTitle("");
    setMobileQuickAddKind("task");
    setMobileQuickAddDate(null);
    setMobileQuickAddFromProjectTree(fromProjectTree);
    setQuickProjectOpen(false);
    if (projectId !== undefined) setQuickProjectId(projectId === "__unassigned__" ? "" : projectId);
    setQuickAddOpen(true);
  }

  useEffect(() => {
    if (mobileExecution) setCompactExecuteView("schedule");
    if ((!mobileExecution && !mobilePlacementRef.current?.guided) || drawerOpen || quickAddOpen || aiOpen || utilityPanel || commandOpen || notificationCenterOpen || scheduleTemplateOpen) {
      if (mobilePlacementRef.current) cancelMobilePlacement(false);
      if (candidateDrawerOpen) setCandidateDrawerOpen(false);
    }
  }, [mobileExecution, drawerOpen, quickAddOpen, aiOpen, utilityPanel, commandOpen, notificationCenterOpen, scheduleTemplateOpen]);

  useEffect(() => {
    if (!mobilePlacement) return;
    document.querySelector<HTMLButtonElement>(".df-mobile-placement-actions button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); cancelMobilePlacement(true); }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [mobilePlacement]);

  useEffect(() => {
    if (!placementPreview || mobilePlacementRef.current) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-placement-card="${placementPreview.taskId}"]`)) return;
      if (target?.closest(`[data-placement-preview-task="${placementPreview.taskId}"]`)) return;
      if (locatedPlacementTaskId === placementPreview.taskId) return;
      placementReturnScrollTopRef.current = null;
      setLocatedPlacementTaskId(null);
      setPlacementPreview(null);
      setPlacementChoices([]);
      setPendingTimelineFocus(null);
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", handlePointerDown), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [placementPreview, locatedPlacementTaskId]);

  useEffect(() => {
    if (!placementPreview || mobilePlacementRef.current) return;
    placementReturnScrollTopRef.current = null;
    setLocatedPlacementTaskId(null);
    setPlacementPreview(null);
    setPlacementChoices([]);
    setPendingTimelineFocus(null);
  }, [timelineView, drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if ((event.target as HTMLElement | null)?.closest(".df-dialog")) return;
      if (drawerSaveConfirmRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      if (editingId && addType === "task") {
        closeTaskDrawer({ autoSave: true });
        return;
      }
      closeTaskDrawer();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, editingId, addType, data, form]);

  useEffect(() => {
    if (!quickSchedule) return;
    const cancelQuickSchedule = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".df-quick-schedule") || target.closest(".df-timeline-canvas") || target.closest(".df-all-day-quick")) return;
      setQuickSchedule(null);
    };
    document.addEventListener("mousedown", cancelQuickSchedule);
    return () => document.removeEventListener("mousedown", cancelQuickSchedule);
  }, [quickSchedule]);

  useEffect(() => {
    if (!compactLayout || !resizeHintTaskId) return;
    const clearSelectedTimelineTask = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".df-time-block, .df-mobile-task-summary")) return;
      setResizeHintTaskId("");
      if (drawerOpen && mobileTaskSummary) closeTaskDrawer({ autoSave: true });
    };
    document.addEventListener("pointerdown", clearSelectedTimelineTask);
    return () => document.removeEventListener("pointerdown", clearSelectedTimelineTask);
  }, [compactLayout, resizeHintTaskId, drawerOpen, mobileTaskSummary]);

  // Dismiss timeline quick-add when its coordinate system changes.
  useEffect(() => {
    setDragCreate(null);
  }, [timelineView, drag, drawerOpen]);

  function revealResizeHandles(taskId: string) {
    setResizeHintTaskId(taskId);
  }

  function syncFailureMessage() {
    return lang === "zh" ? "同步稍后自动重试" : "Sync will retry automatically";
  }

  function manualSyncFailureMessage(error: unknown) {
    const message = String((error as Error)?.message || error);
    if (/PGRST30[12]|JWT|401/i.test(message)) {
      return lang === "zh"
        ? "云端令牌无效（401），请重新登录。"
        : "Cloud token rejected (401). Sign in again.";
    }
    return t(lang, "sync.failure");
  }

  function maybeShowSyncFailureNotice(kind: "data" | "settings") {
    const retryCount = kind === "data" ? dataSaveRetryCountRef.current : settingsSaveRetryCountRef.current;
    const shown = kind === "data" ? dataSaveNoticeShownRef.current : settingsSaveNoticeShownRef.current;
    if (retryCount < SYNC_FAILURE_NOTICE_AFTER || shown) return;
    if (kind === "data") dataSaveNoticeShownRef.current = true;
    else settingsSaveNoticeShownRef.current = true;
    showToast(syncFailureMessage());
  }

  function scheduleDataFlush(delay = SAVE_DEBOUNCE_MS) {
    if (dataSaveTimerRef.current) window.clearTimeout(dataSaveTimerRef.current);
    if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
    dataSaveTimerRef.current = window.setTimeout(() => {
      void flushPendingSave();
    }, delay);
  }

  function scheduleSettingsFlush(delay = SAVE_DEBOUNCE_MS) {
    if (settingsSaveTimerRef.current) window.clearTimeout(settingsSaveTimerRef.current);
    if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
    settingsSaveTimerRef.current = window.setTimeout(() => {
      void flushPendingSettings();
    }, delay);
  }

  function scheduleDataRetry() {
    const delay = SYNC_RETRY_DELAYS[Math.min(dataSaveRetryCountRef.current - 1, SYNC_RETRY_DELAYS.length - 1)];
    if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
    dataSaveRetryTimerRef.current = window.setTimeout(() => {
      void flushPendingSave();
    }, delay);
  }

  function scheduleSettingsRetry() {
    const delay = SYNC_RETRY_DELAYS[Math.min(settingsSaveRetryCountRef.current - 1, SYNC_RETRY_DELAYS.length - 1)];
    if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
    settingsSaveRetryTimerRef.current = window.setTimeout(() => {
      void flushPendingSettings();
    }, delay);
  }

  async function flushPendingSave(options: { urgent?: boolean } = {}): Promise<void> {
    if (dataSaveTimerRef.current) window.clearTimeout(dataSaveTimerRef.current);
    if (dataSaveRetryTimerRef.current) window.clearTimeout(dataSaveRetryTimerRef.current);
    dataSaveTimerRef.current = null;
    dataSaveRetryTimerRef.current = null;
    if (dataSaveInFlightRef.current) {
      await new Promise<void>((resolve) => dataSaveWaitersRef.current.push(resolve));
      return flushPendingSave(options);
    }
    dataSaveInFlightRef.current = true;
    try {
      while (pendingDataSaveRef.current) {
        const job = pendingDataSaveRef.current;
        pendingDataSaveRef.current = null;
        try {
          const saved = await window.plannerApi.saveData(job.payload);
          const acknowledgedRevision = Number(window.plannerApi.getKnownRemoteRevision?.() || 0);
          if (acknowledgedRevision > 0) remoteRevisionRef.current = Math.max(remoteRevisionRef.current, acknowledgedRevision);
          dataSaveRetryCountRef.current = 0;
          dataSaveNoticeShownRef.current = false;
          if (job.version === dataSaveVersionRef.current && !pendingDataSaveRef.current) {
            markSaveFeedback("data", "confirmed");
            dataRef.current = saved;
            setData(saved);
            const userId = authStateRef.current?.user?.id;
            const cached = readBootstrapCache(userId);
            if (settingsRef.current && canAcknowledgeBootstrapSave(cached, "data", job.pendingSavedAt)) {
              writeBootstrapCache(saved, settingsRef.current, userId, {
                dataDirty: false,
                dataPendingSavedAt: null,
                remoteRevision: remoteRevisionRef.current,
              });
            }
            scheduleSnapshotWrite();
          }
        } catch (caught) {
          const latestPending = pendingDataSaveRef.current as QueuedDataSave | null;
          const shouldRetry = shouldRequeueFailedSave(job.version, dataSaveVersionRef.current, latestPending?.version);
          if (shouldRetry) {
            pendingDataSaveRef.current = job;
            dataSaveRetryCountRef.current += 1;
            markSaveFeedback("data", "retrying");
            maybeShowSyncFailureNotice("data");
            scheduleDataRetry();
          }
          if (options.urgent) throw caught;
          break;
        }
      }
    } finally {
      dataSaveInFlightRef.current = false;
      const waiters = dataSaveWaitersRef.current.splice(0);
      waiters.forEach((resolve) => resolve());
      if (pendingDataSaveRef.current && !dataSaveRetryTimerRef.current && !options.urgent) scheduleDataFlush(0);
      else void refreshQueuedRemote();
    }
  }

  async function flushPendingSettings(options: { urgent?: boolean } = {}): Promise<void> {
    if (settingsSaveTimerRef.current) window.clearTimeout(settingsSaveTimerRef.current);
    if (settingsSaveRetryTimerRef.current) window.clearTimeout(settingsSaveRetryTimerRef.current);
    settingsSaveTimerRef.current = null;
    settingsSaveRetryTimerRef.current = null;
    if (settingsSaveInFlightRef.current) {
      await new Promise<void>((resolve) => settingsSaveWaitersRef.current.push(resolve));
      return flushPendingSettings(options);
    }
    settingsSaveInFlightRef.current = true;
    try {
      while (pendingSettingsSaveRef.current) {
        const job = pendingSettingsSaveRef.current;
        pendingSettingsSaveRef.current = null;
        try {
          const saved = await window.plannerApi.saveSettings(job.payload);
          const acknowledgedRevision = Number(window.plannerApi.getKnownRemoteRevision?.() || 0);
          if (acknowledgedRevision > 0) remoteRevisionRef.current = Math.max(remoteRevisionRef.current, acknowledgedRevision);
          settingsSaveRetryCountRef.current = 0;
          settingsSaveNoticeShownRef.current = false;
          if (job.version === settingsSaveVersionRef.current && !pendingSettingsSaveRef.current) {
            markSaveFeedback("settings", "confirmed");
            settingsRef.current = saved;
            setSettings(saved);
            if (saved.language) setLang(saved.language);
            const userId = authStateRef.current?.user?.id;
            const cached = readBootstrapCache(userId);
            if (dataRef.current && canAcknowledgeBootstrapSave(cached, "settings", job.pendingSavedAt)) {
              writeBootstrapCache(dataRef.current, saved, userId, {
                settingsDirty: false,
                settingsPendingSavedAt: null,
                remoteRevision: remoteRevisionRef.current,
              });
            }

            scheduleSnapshotWrite();
          }
        } catch (caught) {
          const latestPending = pendingSettingsSaveRef.current as QueuedSettingsSave | null;
          if (latestPending && latestPending.version > job.version) {
            pendingSettingsSaveRef.current = { ...latestPending, payload: {
              ...job.payload, ...latestPending.payload,
              ...((job.payload.extensionMcpAccess || latestPending.payload.extensionMcpAccess) && {
                extensionMcpAccess: { ...job.payload.extensionMcpAccess, ...latestPending.payload.extensionMcpAccess },
              }),
            } };
          }
          const shouldRetry = shouldRequeueFailedSave(job.version, settingsSaveVersionRef.current, latestPending?.version);
          if (shouldRetry) {
            pendingSettingsSaveRef.current = job;
            settingsSaveRetryCountRef.current += 1;
            markSaveFeedback("settings", "retrying");
            maybeShowSyncFailureNotice("settings");
            scheduleSettingsRetry();
          }
          if (options.urgent) throw caught;
          break;
        }
      }
    } finally {
      settingsSaveInFlightRef.current = false;
      const waiters = settingsSaveWaitersRef.current.splice(0);
      waiters.forEach((resolve) => resolve());
      if (pendingSettingsSaveRef.current && !settingsSaveRetryTimerRef.current && !options.urgent) scheduleSettingsFlush(0);
      else void refreshQueuedRemote();
    }
  }

  function saveData(next: PlannerData, source:AnalyticsSource="client"): Promise<void> {
    if(source!=="client")analyticsMutationSources.set(next,source);
    return extensionHostRef.current?.internal.services.saveData(next) ?? persistData(next);
  }

  function changeTaskOperations(workspaceKey: string, update: (entries: TaskOperation[]) => TaskOperation[]) {
    if (workspaceKey !== loadedWorkspaceKeyRef.current) return;
    const now = workspaceNow().getTime();
    setTaskOperations((entries) => recentTaskOperations(update(entries), now));
    if (!productDemo) {
      void updateSavedTaskOperations(workspaceKey, update, now)
        .catch((error) => console.warn("Activity history could not be saved:", error));
    }
  }

  function movePlanningTreeNode(source: TreeDragNode, target: TreeDropTarget) {
    const current = dataRef.current;
    if (!current) return;
    const next = moveTreeNode(current, source, target, workspaceNow().toISOString());
    if (next === current) return;
    const undo = captureTreeMoveUndo(current, next);
    void saveData(next);
    showUndoToast(lang === "zh" ? "任务层级与顺序已更新" : "Task hierarchy and order updated", t(lang, "toast.undo"), () => {
      const latest = dataRef.current;
      const restored = latest && undoTreeMove(latest, undo, workspaceNow().toISOString());
      if (restored) {
        void saveData(restored,"undo");
        showToast(t(lang, "toast.undone"));
      } else showToast(lang === "zh" ? "相关任务后来有改动，暂时无法撤销。" : "The affected tasks have since changed. This action can’t be undone yet.");
    });
  }

  function saveTaskOperation(next: PlannerData, kind: TaskOperationKind, options?: { title?: string; titles?: string[]; toast?: string; source?:AnalyticsSource }) {
    const previous = dataRef.current;
    const undo = previous && captureTaskUndo(previous, next);
    const saving = saveData(next,options?.source);
    if (!undo || !(undo.added.length || undo.removed.length || undo.changes.length)) return saving;
    const operation: TaskOperation = {
      id: uid("operation"),
      workspaceKey: loadedWorkspaceKeyRef.current,
      at: workspaceNow().toISOString(),
      kind,
      titles: options?.titles || (options?.title ? [options.title] : [...undo.added, ...undo.removed, ...undo.changes].map(({ title }) => title)),
      undo,
    };
    changeTaskOperations(operation.workspaceKey, (current) => [operation, ...current]);
    if (kind === "delete" && undo.removed.length) showToast(t(lang, "candidate.deletedTask"), "delete");
    else if (options?.toast) showUndoToast(options.toast, t(lang, "toast.undo"), () => undoTaskOperation(operation));
    return saving;
  }

  async function commitSyncBatch(pairId: string, before: Pick<PlannerData, "tasks" | "projects">, after: Pick<PlannerData, "tasks" | "projects">) {
    const current = dataRef.current;
    if (!current || syncUndoLockRef.current || pausedSyncPairsRef.current.has(pairId) || current.tasks !== before.tasks || current.projects !== before.projects) throw new Error("Sync paused or workspace changed. Retry.");
    const next = { ...current, ...after };
    const { undo, sync } = captureSyncBatch(current, next, pairId);
    if (!(undo.added.length || undo.removed.length || undo.changes.length || sync.projects.length)) return;
    const operation: TaskOperation = { id: uid("operation"), workspaceKey: loadedWorkspaceKeyRef.current, at: workspaceNow().toISOString(), kind: "sync", titles: [...undo.added, ...undo.removed, ...undo.changes].map(({title}) => title), undo, sync };
    const workspaceKey = operation.workspaceKey;
    // Persist the inverse before the mutation; failed history storage prevents untracked imports.
    if (!productDemo) await updateSavedTaskOperations(workspaceKey, entries => [operation, ...entries.filter(entry => entry.id !== operation.id)], workspaceNow().getTime());
    try {
      const latest = dataRef.current;
      if (!latest || workspaceKey !== loadedWorkspaceKeyRef.current || syncUndoLockRef.current || pausedSyncPairsRef.current.has(pairId) || latest.tasks !== before.tasks || latest.projects !== before.projects) throw new Error("Sync paused or workspace changed. Retry.");
      await saveData({ ...latest, ...after },"sync");
    } catch (error) {
      if (!productDemo) await updateSavedTaskOperations(workspaceKey, entries => entries.filter(entry => entry.id !== operation.id), workspaceNow().getTime());
      throw error;
    }
    if (workspaceKey === loadedWorkspaceKeyRef.current) setTaskOperations(entries => recentTaskOperations([operation,...entries.filter(entry => entry.id !== operation.id)], workspaceNow().getTime()));
    showUndoToast(lang === "zh" ? "已同步 Super Productivity，可在活动历史撤销" : "Super Productivity synced · undo in Activity history", t(lang,"toast.undo"), () => undoTaskOperation(operation));
  }

  async function undoSyncOperation(operation: TaskOperation) {
    if (!operation.sync || syncUndoLockRef.current) return;
    const sync = operation.sync, workspaceKey = operation.workspaceKey;
    const current = dataRef.current;
    if (!current || !undoSyncBatch(current, operation.undo, sync, workspaceNow().toISOString())) { showToast(lang === "zh" ? "同步涉及的数据后来有改动，无法安全撤销。" : "Synced records have changed since this batch; undo is unsafe."); return; }
    if (!window.confirm(lang === "zh" ? "撤销本次同步对 NavoPath 的更改？将先暂停双向同步，保留 SP 原始数据。之后需重新配对。" : "Undo this batch in NavoPath? Sync will pause first, preserving SP data. Pair again to resume.")) return;
    syncUndoLockRef.current = true;
    try {
      const api = window.plannerApi?.requestSuperProductivitySync;
      if (!api) throw new Error("Cloud sync API unavailable");
      const result = await api("/pause", "POST", { pairId: sync.pairId });
      if (result.status !== "paused" || result.pairId !== sync.pairId) throw new Error("Sync pause was not confirmed");
      pausedSyncPairsRef.current.add(sync.pairId);
      const latest = dataRef.current;
      if (!latest || workspaceKey !== loadedWorkspaceKeyRef.current) throw new Error("Workspace changed");
      const restored = undoSyncBatch(latest, operation.undo, sync, workspaceNow().toISOString());
      if (!restored) throw new Error(lang === "zh" ? "同步已暂停，但相关数据有后续修改，未撤销。" : "Sync paused, but later edits prevent undo.");
      preserveTimelineViewportOnNextDataChange();
      await saveData(restored,"undo");
      changeTaskOperations(workspaceKey, entries => entries.map(entry => entry.id === operation.id ? { ...entry, undone: true } : entry));
      showToast(lang === "zh" ? "已撤销本次同步；连接已暂停" : "Sync batch undone; connection paused");
    } catch (error) { showToast(error instanceof Error ? error.message : String(error)); }
    finally { syncUndoLockRef.current = false; }
  }

  function undoTaskOperation(operation: TaskOperation) {
    operation = taskOperationsRef.current.find((entry) => entry.id === operation.id) || operation;
    const current = dataRef.current;
    if (!current || operation.undone || operation.workspaceKey !== loadedWorkspaceKeyRef.current
      || Date.parse(operation.at) <= workspaceNow().getTime() - TASK_OPERATION_RETENTION_MS) return;
    if (operation.sync) { void undoSyncOperation(operation); return; }
    const next = undoTaskChanges(current, operation.undo, workspaceNow().toISOString());
    if (next === current) {
      showToast(lang === "zh" ? "相关任务后来有改动，暂时无法撤销。" : "The affected tasks have since changed. This action can’t be undone yet.");
      return;
    }
    preserveTimelineViewportOnNextDataChange();
    void saveData(next,"undo");
    changeTaskOperations(operation.workspaceKey, (entries) => entries.map((entry) =>
      entry.id === operation.id ? { ...entry, undone: true } : entry));
    showToast(t(lang, "toast.undone"));
  }
  async function persistData(next: PlannerData) {
    const source=analyticsMutationSources.get(next)||"client";analyticsMutationSources.delete(next);
    const savedAt = workspaceNow().toISOString();
    const previous = dataRef.current;
    const previousEvents = new Map(previous?.events.map(event => [event.id, event]));
    const events = next.events.map(event => event.calendarKind === "appointment" && previousEvents.get(event.id) !== event
      ? { ...event, updatedAt: savedAt }
      : event);
    const tracked = withDeletionTombstones(previous, { ...next, events }, savedAt);
    const optimistic = { ...tracked, aiProfile: buildAiProfile(tracked), savedAt };
    const version = dataSaveVersionRef.current + 1;
    dataSaveVersionRef.current = version;
    markSaveFeedback("data", "pending");
    pendingDataSaveRef.current = { payload: optimistic, version, pendingSavedAt: savedAt };
    dataRef.current = optimistic;
    setData(optimistic);
    if(previous&&!productDemo&&metricsPluginActive(extensionService.getSnapshot()))recordLocalAnalyticsChange(authStateRef.current?.user?.id||"preview",previous,optimistic,savedAt,source);
    if (settingsRef.current) writeBootstrapCache(optimistic, settingsRef.current, authStateRef.current?.user?.id, {
      dataDirty: true,
      dataPendingSavedAt: savedAt,
      remoteRevision: remoteRevisionRef.current,
    });
    scheduleDataFlush();
    advanceOnboarding(previous, optimistic);
  }

  function advanceOnboarding(previous: PlannerData | null, next: PlannerData) {
    const current = settingsRef.current;
    if (productDemo || !previous || !current || !cloudBaselineReadyRef.current) return;
    const stage = onboardingStage(current);
    if (stage !== "add" && stage !== "schedule") return;
    const target = stage === "schedule" ? onboardingTarget(current, next.tasks) : undefined;
    const newTasks = stage === "add" ? next.tasks.filter((task) => isOnboardingTask(task)
      && !previous.tasks.some(({ id }) => id === task.id)) : [];
    const task = target ?? (newTasks.length === 1 ? newTasks[0] : undefined);
    if (!task) return;
    const block = onboardingBlock(task);
    if (block) {
      void saveSettings({ workspaceGuideStep: "return", workspaceGuideTaskId: task.id });
      setSelectedDate(block.scheduledDate);
      setCompactExecuteView("schedule");
      if (timelineView === "month") setTimelineView("daily");
      setCandidateDrawerOpen(false);
      requestTimelineFocus({ date: block.scheduledDate, startTime: block.scheduledStart, taskId: block.id, source: "schedule" });
    } else if (stage === "add") {
      if (timelineView === "month") setTimelineView("daily");
      void saveSettings({ workspaceGuideStep: "schedule", workspaceGuideTaskId: task.id });
    }
  }

  useEffect(() => {
    if (productDemo || !data || !settings || !cloudBaselineReadyRef.current) return;
    const stage = onboardingStage(settings);
    if (stage !== "schedule" && stage !== "return") return;
    const task = onboardingTarget(settings, data.tasks);
    const block = onboardingBlock(task);
    if (stage === "return") {
      if (!block) void saveSettings({ workspaceGuideStep: "plan" });
    } else if (block) void saveSettings({ workspaceGuideStep: "return" });
    else if (!task || !isOnboardingTask(task)) void saveSettings(ONBOARDING_ADD);
  }, [data, settings]);

  useEffect(() => {
    if (!data) return;
    if (loadedWorkspaceKeyRef.current.startsWith("cloud:") && !cloudBaselineReadyRef.current) return;
    const result = reconcileOverdueTasks(data, todayIso());
    if (!result.changed) return;
    void saveData(result.data,"system");
    if (result.overdueReturnedCount > 0) {
      showToast(lang === "zh" ? `${result.overdueReturnedCount} 个逾期任务已回到任务` : `${result.overdueReturnedCount} overdue task${result.overdueReturnedCount === 1 ? "" : "s"} returned to Tasks`);
    }
  }, [data]);

  function makeSmartTask(nextForm: FormState) {
    const current = dataRef.current;
    const currentSettings = settingsRef.current;
    return makeTask(nextForm, current && currentSettings ? { data: current, projects: current.projects, settings: isAiActive() ? currentSettings : { ...currentSettings, autoEstimateTaskDuration: false, autoAssignTaskProject: false } } : undefined);
  }

  function enrichTaskInBackground(task: Task): Promise<Task | undefined> {
    if (productDemo || !isAiActive()) return Promise.resolve(task);
    const currentSettings = settingsRef.current;
    const hasJevDurationPrediction = task.aiInference?.duration?.source === "ai"
      && isJevModelVersion(task.aiInference.duration.modelVersion);
    const hasJevProjectPrediction = task.aiInference?.project?.source === "ai"
      && isJevModelVersion(task.aiInference.project.modelVersion);
    const requestDuration = currentSettings?.autoEstimateTaskDuration !== false
      && !task.aiInference?.duration?.userOverridden
      && !hasJevDurationPrediction;
    const requestProject = currentSettings?.autoAssignTaskProject !== false
      && !task.projectId
      && !task.aiInference?.project?.userOverridden
      && !hasJevProjectPrediction;
    if (!requestDuration && !requestProject) return Promise.resolve(task);

    const requestKey = `${task.id}|${task.title}|${task.estimatedHours || 0}|${task.projectId || ""}|${requestDuration ? 1 : 0}${requestProject ? 1 : 0}`;
    const inFlight = taskEnrichmentInFlightRef.current.get(requestKey);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const snapshot = dataRef.current;
      if (!snapshot) return undefined;
      const result = await callAiAssistant({
        mode: "enrich_task",
        message: task.title,
        context: {
          task: { id: task.id, title: task.title, estimatedMinutes: Math.round((task.estimatedHours || 0.5) * 60), projectId: task.projectId },
          projects: snapshot.projects
            .filter((project) => !project.completed)
            .map((project) => ({ id: project.id, title: project.title, notes: project.notes })),
          preferences: snapshot.aiProfile ? {
            durationByProject: snapshot.aiProfile.durationByProject,
            feedback: snapshot.aiProfile.feedback,
          } : undefined,
          requestDuration,
          requestProject,
        },
      });
      if (!isAiActive() || !result.ok || !result.enrichment) return undefined;
      const latest = dataRef.current;
      const currentTask = latest?.tasks.find((item) => item.id === task.id);
      if (!latest || !currentTask || currentTask.title !== task.title) return undefined;

      const commonConfidence = Math.max(0, Math.min(1, Number(result.enrichment.confidence) || 0));
      const rawDurationConfidence = Number(result.enrichment.durationConfidence);
      const rawProjectConfidence = Number(result.enrichment.projectConfidence);
      const durationConfidence = Number.isFinite(rawDurationConfidence)
        ? Math.max(0, Math.min(1, rawDurationConfidence))
        : commonConfidence;
      const projectConfidence = Number.isFinite(rawProjectConfidence)
        ? Math.max(0, Math.min(1, rawProjectConfidence))
        : commonConfidence;
      const durationMinutes = Math.max(15, Math.min(240, Math.round(Number(result.enrichment.durationMinutes) / 15) * 15));
      const modelVersion = result.enrichment.modelVersion || (result.enrichment.provider === "jev" ? "typesafe-ai/jev" : "gateway-enrich-v1");
      const isJevPrediction = result.enrichment.provider === "jev" || isJevModelVersion(modelVersion);
      const hasActiveSchedule = Boolean(currentTask.scheduledDate)
        || (currentTask.timelineRecords || []).some((record) => record.executionStatus === "scheduled");
      const canApplyDuration = requestDuration
        && durationConfidence >= 0.55
        && !hasActiveSchedule
        && !currentTask.aiInference?.duration?.userOverridden
        && currentTask.estimatedHours === task.estimatedHours
        && Number.isFinite(durationMinutes);

      const projectId = result.enrichment.projectId;
      const canSuggestProject = requestProject
        && projectConfidence >= 0.45
        && !currentTask.projectId
        && !currentTask.aiInference?.project?.userOverridden
        && typeof projectId === "string"
        && latest.projects.some((project) => project.id === projectId && !project.completed);
      const canApplyProject = canSuggestProject && projectConfidence >= 0.78;
      const shouldCacheJevDuration = isJevPrediction
        && requestDuration
        && Number.isFinite(durationMinutes)
        && !currentTask.aiInference?.duration?.userOverridden
        && currentTask.estimatedHours === task.estimatedHours;
      const shouldCacheJevProject = isJevPrediction
        && requestProject
        && !currentTask.projectId
        && !currentTask.aiInference?.project?.userOverridden;
      if (!canApplyDuration && !canSuggestProject && !shouldCacheJevDuration && !shouldCacheJevProject) return currentTask;

      const inferredAt = workspaceNow().toISOString();
      const validProjectId = typeof projectId === "string"
        && latest.projects.some((project) => project.id === projectId && !project.completed)
        ? projectId
        : "";
      const updatedTask: Task = {
        ...currentTask,
        ...(canApplyDuration ? { estimatedHours: durationMinutes / 60 } : {}),
        ...(canApplyProject ? { projectId } : {}),
        aiInference: {
          ...currentTask.aiInference,
          ...(canApplyDuration || shouldCacheJevDuration ? { duration: { minutes: durationMinutes, confidence: durationConfidence, source: "ai" as const, inferredAt, modelVersion } } : {}),
          ...(canSuggestProject || shouldCacheJevProject ? { project: { projectId: validProjectId, confidence: projectConfidence, source: "ai" as const, inferredAt, modelVersion } } : {}),
        },
        updatedAt: inferredAt,
      };
      const next = {
        ...latest,
        tasks: latest.tasks.map((item) => item.id === task.id ? updatedTask : item),
      };
      const workspaceKey = loadedWorkspaceKeyRef.current;
      await saveData(next);
      changeTaskOperations(workspaceKey, (entries) => entries.map((entry) => {
        if (entry.undone) return entry;
        const undo = refreshTaskCreationUndo(entry.undo, currentTask, updatedTask, next);
        return undo === entry.undo ? entry : { ...entry, undo };
      }));
      return updatedTask;
    })();

    taskEnrichmentInFlightRef.current.set(requestKey, promise);
    const clearInFlight = () => {
      if (taskEnrichmentInFlightRef.current.get(requestKey) === promise) taskEnrichmentInFlightRef.current.delete(requestKey);
    };
    void promise.then(clearInFlight, clearInFlight);
    return promise;
  }

  function saveSettings(patch: SettingsPatch): Promise<void> {
    return extensionHostRef.current?.internal.services.saveSettings(patch) ?? persistSettings(patch);
  }
  async function persistSettings(patch: SettingsPatch) {
    const current = settingsRef.current || settings;
    if (!current) return;
    const optimistic = normalizeSettings({
      ...current, ...patch,
      extensionMcpAccess: { ...current.extensionMcpAccess, ...patch.extensionMcpAccess },
    });
    const pendingSavedAt = workspaceNow().toISOString();
    const version = settingsSaveVersionRef.current + 1;
    settingsSaveVersionRef.current = version;
    markSaveFeedback("settings", "pending");
    const pending = pendingSettingsSaveRef.current?.payload;
    pendingSettingsSaveRef.current = { payload: {
      ...pending, ...patch,
      ...(patch.extensionMcpAccess && { extensionMcpAccess: { ...pending?.extensionMcpAccess, ...patch.extensionMcpAccess } }),
    }, version, pendingSavedAt };
    settingsRef.current = optimistic;
    setSettings(optimistic);
    if (optimistic.language) setLang(optimistic.language);
    if (dataRef.current) writeBootstrapCache(dataRef.current, optimistic, authStateRef.current?.user?.id, {
      settingsDirty: true,
      settingsPendingSavedAt: pendingSavedAt,
      remoteRevision: remoteRevisionRef.current,
    });

    scheduleSettingsFlush();
  }

  /**
   * Manual sync: push any pending local changes, pull the latest remote baseline,
   * then persist lastSyncedAt. Called by the Account → "Sync now" button and by
   * the auto-sync scheduler itself. Concurrent invocations share a single
   * in-flight run via the SyncScheduler.
   */
  async function handleSyncNow({ silent = false, direction = "both" }: { silent?: boolean; direction?: "push" | "pull" | "both" } = {}): Promise<boolean> {
    if (authState?.mode !== "cloud" || !authState.user) {
      if (!silent) showToast(lang === "zh" ? "登录后即可同步。" : "Sign in to sync.");
      return false;
    }
    const scheduler = syncSchedulerRef.current;
    if (!scheduler) {
      if (!silent) showToast(lang === "zh" ? "同步功能初始化中，请稍后再试。" : "Sync is initializing, please try again later.");
      return false;
    }
    if (!silent) {
      setIsManualSyncing(true);
      showToast(t(lang, "sync.syncing"));
    }
    try {
      if (direction === "push" || direction === "both") {
        await flushPendingSave({ urgent: true });
        await flushPendingSettings({ urgent: true });
      } else if (direction === "pull") {
        // Pull is intentionally non-destructive: acknowledge local work first,
        // then reconcile the cloud baseline. Import/restore remains the explicit
        // workflow for replacing local data.
        await Promise.all([
          flushPendingSave({ urgent: true }),
          flushPendingSettings({ urgent: true }),
        ]);
        queuedRemoteRefreshRef.current = true;
        await refreshQueuedRemote();
      }
      const result = direction === "push"
        ? await scheduler.runPushOnly()
        : direction === "pull"
          ? await scheduler.runPullOnly()
          : await scheduler.runNow();
      if (!silent) {
        if (!result.ok) {
          showToast(manualSyncFailureMessage(result.error));
        } else if (direction === "push") {
          showToast(result.pushedLocal
            ? (lang === "zh" ? "已推送本地数据到云端。" : "Pushed local data to cloud.")
            : (lang === "zh" ? "没有待推送的本地改动。" : "No local changes to push."));
        } else if (direction === "pull") {
          showToast(result.pulledRemote
            ? (lang === "zh" ? "已从云端拉取最新数据。" : "Pulled latest data from cloud.")
            : (lang === "zh" ? "云端无新数据。" : "No new data from cloud."));
        } else if (result.pushedLocal || result.pulledRemote) {
          showToast(lang === "zh" ? "同步完成。" : "Sync complete.");
        } else {
          showToast(lang === "zh" ? "已是最新数据。" : "Already up to date.");
        }
      }
      return result.ok;
    } catch (error) {
      if (!silent) showToast(manualSyncFailureMessage(error));
      console.warn("Manual sync failed", error);
      return false;
    } finally {
      if (!silent) setIsManualSyncing(false);
    }
  }

  function persistSyncTimestamp(syncedAt: string) {
    const current = settingsRef.current;
    if (!current) return;
    if (current.lastSyncedAt === syncedAt) return;
    // Avoid triggering the scheduler to re-arm during its own writeback.
    void saveSettings({ lastSyncedAt: syncedAt });
  }

  useEffect(() => {
    const scheduler = new SyncScheduler({
      isBusy: () =>
        Boolean(
          pendingDataSaveRef.current ||
            pendingSettingsSaveRef.current ||
            dataSaveInFlightRef.current ||
            settingsSaveInFlightRef.current,
        ),
      isPaused: () => (typeof document === "undefined" ? false : document.visibilityState !== "visible"),
      pushLocal: async () => {
        if (pendingDataSaveRef.current) await flushPendingSave({ urgent: true });
        if (pendingSettingsSaveRef.current) await flushPendingSettings({ urgent: true });
      },
      pullRemote: async () => {
        queuedRemoteRefreshRef.current = true;
        await refreshQueuedRemote();
      },
      onTick: (result) => {
        if (!result.ok) return;
        if (result.pushedLocal || result.pulledRemote) persistSyncTimestamp(result.syncedAt);
      },
    });
    syncSchedulerRef.current = scheduler;
    return () => {
      scheduler.stop();
      if (syncSchedulerRef.current === scheduler) syncSchedulerRef.current = null;
    };
  }, []);

  // Re-arm the scheduler whenever the user changes the sync interval.
  useEffect(() => {
    const scheduler = syncSchedulerRef.current;
    if (!scheduler) return;
    scheduler.setIntervalMinutes(readSyncInterval(settings));
  }, [settings?.syncIntervalMinutes, authState?.user?.id]);

  useEffect(() => {
    if(productDemo||!data||!settings||!metricsEnabled)return;
    const scope=authState?.user?.id||"preview";
    const capture=()=>{if(!metricsPluginActive(extensionService.getSnapshot()))return;if(loadedWorkspaceKeyRef.current.startsWith("cloud:")&&!cloudBaselineReadyRef.current)return;if(dataRef.current&&settingsRef.current&&(authStateRef.current?.user?.id||"preview")===scope)captureDailyPlan(scope,dataRef.current,workspaceNow().toISOString(),settingsRef.current.dayStartTime);};
    capture();const interval=window.setInterval(capture,60_000);return()=>window.clearInterval(interval);
  },[Boolean(data),Boolean(settings),authState?.user?.id,settings?.dayStartTime,metricsEnabled]);

  // The same live services power the application and trusted community plugins.
  useEffect(() => {
    if (productDemo || !dataRef.current || !settingsRef.current) {
      void extensionService.configure(null); return;
    }
    if (!extensionHostRef.current) extensionHostRef.current = {
      getData: () => dataRef.current!, saveData: next => saveData(next,"plugin"),
      getSettings: () => settingsRef.current!, saveSettings: patch => saveSettings(patch),
      getAccountId: () => authStateRef.current?.user?.id || null,
      toast: message => showToast(message),
      superProductivity: {
        commitBatch: (pairId, before, after) => commitSyncBatch(pairId, before, after),
        createPairingCode: () => window.plannerApi?.createSuperProductivityPairingCode?.() ?? Promise.reject(new Error("Cloud account required")),
        request: (path, method, body) => window.plannerApi?.requestSuperProductivitySync?.(path, method, body) ?? Promise.reject(new Error("Cloud account required")),
      },
      internal: { apiVersion: "1.5", services: { saveData: persistData, saveSettings: persistSettings }, plannerApi: window.plannerApi, window, document },
    };
    void extensionService.configure(extensionHostRef.current).catch(error => console.warn("[extensions] startup failed", error));
  }, [Boolean(data), Boolean(settings), settings?.extensions, settings?.extensionConfigs, authState?.user?.id]);

  useEffect(() => { if (data) emitPluginEvent("data:changed", data); }, [data]);
  useEffect(() => {
    const tick = advanceWidgetTimer(widgetTimerRuntime, widgetTimerPreferences, Date.now());
    emitPluginEvent("timer:changed", {
      mode: tick.runtime.mode,
      phase: tick.runtime.phase,
      running: tick.runtime.running,
      displaySeconds: tick.displaySeconds,
    });
  }, [widgetTimerRuntime, widgetTimerPreferences]);
  useEffect(() => {
    if (!settings) return;
    document.body.dataset.navopathBaseTheme = settings.theme;
    document.documentElement.dataset.theme = settings.theme;
    emitPluginEvent("settings:changed", settings);
    if (settings.baseMode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { const theme = media.matches ? "dark" : "light"; if (settingsRef.current?.theme !== theme) void saveSettings({ theme }); };
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings?.theme, settings?.baseMode, settings?.language]);

  useLayoutEffect(() => { applyMotionPreference(readMotionPreference()); }, []);
  useTaskLayoutMotion({
    root: () => document.querySelector<HTMLElement>(".df-app.mode-execute"),
    selector: EXECUTION_MOTION_SELECTOR,
    scope: timelineView + ":" + selectedDate + ":" + compactExecuteView + ":" + shelfViewId,
    revision: [data, settings?.hideCompleted, showScheduledCandidates, candidateDrawerOpen],
    blocked: !workspaceLoaded || workspaceSuspended || Boolean(drag || resizePreview || mobilePlacement),
  });
  const workspaceCornerRadius = settings?.workspaceCornerRadius ?? WORKSPACE_CORNER_RADIUS.defaultValue;
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--workspace-corner-radius", `${workspaceCornerRadius}px`);
    return () => { root.style.removeProperty("--workspace-corner-radius"); };
  }, [workspaceCornerRadius]);

  const today = todayIso();
  const timelineDate = selectedDate;
  const continuousTimelineEnabled = settings?.continuousCrossDayScroll !== false && timelineView !== "month";
  const timelineColumnCount = timelineView === "weekly" ? 7 : timelineView === "3day" ? 3 : 1;
  const timelineWindowAnchorDate = continuousTimelineEnabled ? visibleTimelineDate : timelineDate;
  const changeTimelineDate = useMotionSelection(timelineWindowAnchorDate, (date: string) => {
    setSelectedDate(date);
    setVisibleTimelineDate(date);
    setDragCreate(null);
  }, "timeline", (previous, next) => next < previous ? "backward" : "forward");
  const isViewingToday = timelineWindowAnchorDate === today;
  const projects = data?.projects || [];
  const tasks = data?.tasks || [];
  const [backgroundRevision, refreshBackgrounds] = useState(0);
  useEffect(()=>{ const off=subscribePluginEvent("calendar:backgrounds-changed",()=>refreshBackgrounds(v=>v+1)); return ()=>{void off();}; },[]);
  // The timeline only renders fixed timetable backgrounds from the event store.
  // Ordinary appointments are tasks now and must not reappear as Event blocks.
  const events = useMemo(()=>(data?.events || []).filter(event => event.fixedCourse && event.calendarKind !== "appointment" && isCalendarBackgroundVisible(event)),[data?.events,backgroundRevision]);

  const timerTask = useMemo(() => tasks.find((task) => task.id === timerTaskId) || null, [tasks, timerTaskId]);
  const timerProject = useMemo(() => timerTask?.projectId ? projects.find((p) => p.id === timerTask.projectId) || null : null, [timerTask, projects]);

  const stopAndSaveTimer = useCallback(() => {
    if (!timerOwnerRef.current?.isOwner()) { timerOwnerRef.current?.sendAction({ type: "timerStop" }); return; }
    const taskId = timerTaskRef.current;
    const currentData = dataRef.current;
    const elapsed = timerStartedAtRef.current !== null
      ? advanceTaskElapsedSeconds(timerElapsedBaseRef.current, timerStartedAtRef.current, Date.now())
      : timerElapsedRef.current;
    if(taskId)logTimerTransition("stop",taskId,Date.now(),elapsed);
    if (taskId && currentData && elapsed >= 1) {
      const now = workspaceNow().toISOString();
      const task=currentData.tasks.find(t=>t.id===taskId),link=timerRecordRef.current;
      const entry = {
        id: `te-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskId,
        projectId: task?.projectId,
        timelineRecordId: task?.timelineRecords?.some(r=>r.id===link)?link:undefined,
        startAt: new Date(Date.now() - elapsed * 1000).toISOString(),
        endAt: now,
        durationMinutes: Math.max(1, Math.round(elapsed / 60)),
        source: "timer" as const,
        createdAt: now,
        updatedAt: now,
      };
      void saveData({ ...currentData, timeEntries: [...(currentData.timeEntries || []), entry] });
    }
    timerTaskRef.current = null;
    discardTimer();
  }, [discardTimer, saveData]);

  /**
   * Build "virtual" Task objects for each active preview block. These are
   * rendered alongside real `scheduledTasks` so the timeline shows previews
   * using the same `TimeBlock` component and `computeConflictLayout` as real
   * events. The source task is NEVER modified.
   *
   * IMPORTANT: The virtual task uses the SAME `clonedTaskId` that will be
   * committed as a real task. So on accept, the block visually does NOT
   * change — only the `data-preview` attribute is removed. After accept,
   * the same id appears in `data.tasks` and edit/drag/resize work normally.
   */
  const previewTasks = useMemo<Task[]>(() => {
    if (schedulePreviews.length === 0) return [];
    return schedulePreviews.map((p) => {
      const source = tasks.find((t) => t.id === p.sourceTaskId);
      return {
        id: p.clonedTaskId,
        title: source?.title || p.title,
        dueDate: p.scheduledDate,
        category: source?.category || "personal",
        priority: p.priority,
        importance: p.priority,
        urgency: p.priority,
        notes: source?.notes || "",
        goalId: source?.goalId || "",
        completed: false,
        projectId: source?.projectId || p.projectId,
        parentTaskId: p.sourceTaskId,
        estimatedHours: p.durationMinutes / 60,
        scheduledDate: p.scheduledDate,
        scheduledStart: p.scheduledStart,
        scheduledEnd: p.scheduledEnd,
        plannedForDate: p.scheduledDate,
        subtasks: source?.subtasks || [],
        order: Date.now(),
        createdAt: p.id,
        updatedAt: p.id,
      } as Task;
    });
  }, [schedulePreviews, tasks]);

  // Map of clonedTaskId → previewId, used by TimeBlock to know which blocks
  // are previews (and thus should show pending badges and accept/cancel buttons).
  // A clonedTaskId is a preview ONLY if it is NOT yet in data.tasks.
  const previewIdByClonedId = useMemo(() => {
    const realTaskIds = new Set(tasks.map((t) => t.id));
    const m = new Map<string, string>();
    for (const p of schedulePreviews) {
      if (!realTaskIds.has(p.clonedTaskId)) m.set(p.clonedTaskId, p.id);
    }
    return m;
  }, [schedulePreviews, tasks]);

  const continuousAnchorDate = useMemo(() => {
    if (timelineView === "weekly") return getVisibleDays("weekly", timelineDate)[0];
    return timelineDate;
  }, [timelineDate, timelineView]);
  const continuousTimelineDates = useMemo(() => {
    if (!continuousTimelineEnabled) {
      if (timelineView === "daily") return [timelineDate];
      if (timelineView === "3day" || timelineView === "weekly") return getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
      return [];
    }
    return buildDailyContinuousDates(continuousAnchorDate, true, continuousTimelineDayCount(timelineColumnCount));
  }, [continuousAnchorDate, continuousTimelineEnabled, timelineColumnCount, timelineDate, timelineView]);
  const continuousTimelineStartDate = continuousTimelineDates[0] || timelineDate;
  const continuousTimelineBandCount = Math.max(1, Math.ceil(continuousTimelineDates.length / timelineColumnCount));
  const monthWeeks = useMemo(() => timelineView === "month"
    ? buildWeekWindow(timelineDate, 20, 30, settings?.weekStartsOn)
    : [], [timelineView, timelineDate, settings?.weekStartsOn]);
  const visibleTimelineDates = useMemo(() => new Set(timelineView === "month" ? monthWeeks.flat() : continuousTimelineDates), [timelineView, monthWeeks, continuousTimelineDates]);
  const dailyTimelineDates = continuousTimelineDates;
  const dailyTimelineCanvasHeight = dailyContinuousCanvasHeight(continuousTimelineBandCount, timelineSlotHeight);
  const dailyTimelineSlotCount = dailyContinuousSlotCount(continuousTimelineBandCount);

  useEffect(() => {
    if (timelineView === "month") {
      setNowInTimelineViewport(timelineWindowAnchorDate.slice(0, 7) === today.slice(0, 7));
      return;
    }
    const scrollElement = timelineRef.current;
    if (!scrollElement) return;

    const updateNowVisibility = () => {
      const now = workspaceNow();
      const nowDate = todayIso();
      if (!continuousTimelineDates.includes(nowDate) || scrollElement.clientHeight <= 0) {
        setNowInTimelineViewport(false);
        return;
      }
      let minutesFromDayStart = now.getHours() * 60 + now.getMinutes() - dayStartHour * 60;
      if (minutesFromDayStart < 0) minutesFromDayStart += 24 * 60;
      const nowTop = continuousTimelineEnabled
        ? continuousTimedTop(nowDate, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)
        : (minutesFromDayStart / SLOT_MINUTES) * timelineSlotHeight;
      const viewportTop = scrollElement.scrollTop;
      const viewportBottom = viewportTop + scrollElement.clientHeight;
      const visible = nowTop >= viewportTop + 2 && nowTop <= viewportBottom - 2;
      setNowInTimelineViewport((current) => current === visible ? current : visible);
    };

    const frame = window.requestAnimationFrame(updateNowVisibility);
    const interval = window.setInterval(updateNowVisibility, 60_000);
    const resizeObserver = new ResizeObserver(updateNowVisibility);
    resizeObserver.observe(scrollElement);
    scrollElement.addEventListener("scroll", updateNowVisibility, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      resizeObserver.disconnect();
      scrollElement.removeEventListener("scroll", updateNowVisibility);
    };
  }, [compactExecuteView, continuousTimelineDates, continuousTimelineEnabled, continuousTimelineStartDate, dayStartHour, timelineColumnCount, timelineSlotHeight, timelineView, timelineWindowAnchorDate, today, workspaceLoaded, workspaceSuspended]);

  const showBackToNow = !productPresentation && !nowInTimelineViewport;

  function getTimelineRangeFor(view: TimelineView, anchorDate: string) {
    if (view === "daily") return [anchorDate];
    if (view === "3day") return getVisibleDays("3day", anchorDate);
    if (view === "weekly") return getVisibleDays("weekly", anchorDate);
    return [anchorDate];
  }

  // Expand modern timeline records into per-day display tasks while retaining
  // deprecated direct schedules until their migration is complete.
  function expandTimelineRecords(dates: Set<string>) {
    const expansion = expandTaskTimelineSlices(tasks, [...dates]);
    const result = [...expansion.tasks];
    for (const task of tasks) {
      if ((!task.timelineRecords || task.timelineRecords.length === 0) && task.scheduledDate && task.scheduledStart && dates.has(task.scheduledDate)) {
        let { scheduledStart, scheduledEnd } = task;
        const durationMinutes = taskDuration(task);
        if (!scheduledEnd || timeToMinutes(scheduledEnd) <= timeToMinutes(scheduledStart)) {
          scheduledEnd = addMinutes(scheduledStart, durationMinutes);
        }
        const computedEndMinutes = timeToMinutes(scheduledEnd);
        const computedStartMinutes = timeToMinutes(scheduledStart);
        const actualDuration = computedEndMinutes - computedStartMinutes;
        if (durationMinutes > 0 && actualDuration > durationMinutes * 3) {
          console.warn("[timeline] short task rendered too tall", {
            taskId: task.id,
            title: task.title,
            durationMinutes,
            actualDuration,
            scheduledStart,
            scheduledEnd,
          });
          scheduledEnd = addMinutes(scheduledStart, durationMinutes);
        }
        result.push({
          ...task,
          scheduledDate: task.scheduledDate,
          scheduledStart,
          scheduledEnd,
          executionStatus: task.executionStatus || "scheduled",
        } as Task);
      }
    }
    return {
      ...expansion,
      tasks: result.sort((a, b) =>
        (a.scheduledDate || "").localeCompare(b.scheduledDate || "")
        || timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart)
      ),
    };
  }

  function expandRecurrenceOccurrences(dates: Set<string>, sourceTasks = tasks) {
    const ownerMap = new Map<string, Task>();
    const expanded: Task[] = [];
    if (dates.size === 0) return { tasks: expanded, ownerMap };
    for (const task of sourceTasks) {
      if (!isRecurringScheduledTask(task) || !task.recurrence?.startTime) continue;
      const blockedDates = new Set(
        (task.timelineRecords || [])
          .filter((record) =>
            dates.has(record.scheduledDate) &&
            (record.executionStatus === "scheduled" ||
              record.executionStatus === "completed" ||
              record.executionStatus === "returned_unfinished" ||
              record.executionStatus === "skipped" ||
              record.executionStatus === "cancelled")
          )
          .map((record) => record.scheduledDate)
      );
      if (task.scheduledDate && task.scheduledStart && dates.has(task.scheduledDate)) {
        blockedDates.add(task.scheduledDate);
      }
      for (const date of enumerateRecurrenceDates(task.recurrence, dates)) {
        if (blockedDates.has(date)) continue;
        const occurrenceId = buildRecurrenceOccurrenceId(task.id, date, task.recurrence.startTime);
        expanded.push({
          ...task,
          id: occurrenceId,
          scheduledDate: date,
          scheduledStart: task.recurrence.startTime,
          scheduledEnd: addMinutes(task.recurrence.startTime, task.recurrence.durationMinutes || taskDuration(task)),
          executionStatus: "scheduled",
        } as Task);
        ownerMap.set(occurrenceId, task);
      }
    }
    expanded.sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
    return { tasks: expanded, ownerMap };
  }

  function expandCourseBackgrounds(dates: Set<string>) {
    const expanded: Task[] = [];
    for (const event of events) {
      if (event.startTime) {
        for (const slice of expandTimedCalendarEvent(event, [...dates])) {
          expanded.push({
            id: slice.id,
            fixedCourse: true,
            title: event.title,
            dueDate: slice.date,
            category: event.category,
            priority: "medium",
            notes: event.details,
            goalId: "",
            completed: false,
            estimatedHours: slice.durationMinutes / 60,
            scheduledDate: slice.date,
            scheduledStart: slice.startTime,
            scheduledEnd: slice.endTime,
            recurrence: event.recurrence,
            createdAt: event.createdAt,
            updatedAt: event.createdAt,
          });
        }
        continue;
      }
      const occurrenceDates = event.recurrence
        ? enumerateRecurrenceDates(event.recurrence, dates)
        : [...dates].filter((date) => date >= (event.startDate || event.date) && date <= (event.endDate || event.startDate || event.date));
      for (const date of occurrenceDates) {
        const id = `event_occ_${event.id}_${date}_all`;
        expanded.push({
          id, fixedCourse: true, title: event.title, dueDate: date, category: event.category, priority: "medium",
          notes: event.details, goalId: "", completed: false, estimatedHours: 0.5,
          scheduledDate: date,
          recurrence: event.recurrence, createdAt: event.createdAt, updatedAt: event.createdAt,
        });
      }
    }
    return expanded;
  }

  function expandExternalCalendarOccurrences(dates: Set<string>) {
    const resizeEdges = new Map<string, { start: boolean; end: boolean }>();
    const expanded: Task[] = [];
    const enabledSources = new Set(externalCalendarSources.filter((source) => source.enabled).map((source) => source.id));
    for (const occurrence of externalCalendarOccurrences) {
      if (!enabledSources.has(occurrence.source_id) || occurrence.status === "cancelled") continue;
      const createdAt = occurrence.start_at || workspaceNow().toISOString();
      if (occurrence.all_day) {
        for (const date of dates) {
          if (date < occurrence.start_date || date > occurrence.end_date) continue;
          const id = `event_occ_external_${occurrence.id}_${date}_all`;
          expanded.push({
            id, title: occurrence.title, dueDate: date, category: "personal", priority: "medium",
            notes: [occurrence.location, occurrence.description].filter(Boolean).join(" · "), goalId: "", completed: false,
            estimatedHours: 0.5, scheduledDate: date, createdAt, updatedAt: createdAt,
          });
          resizeEdges.set(id, { start: false, end: false });
        }
        continue;
      }
      const start = new Date(occurrence.start_at);
      const end = new Date(occurrence.end_at);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) continue;
      const startDate = localIsoDate(start);
      const endDate = localIsoDate(end);
      const time = (value: Date) => `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
      const event: CalendarEvent = {
        id: `external_${occurrence.id}`,
        title: occurrence.title,
        date: startDate,
        startDate,
        endDate,
        startTime: time(start),
        endTime: time(end),
        category: "personal",
        details: [occurrence.location, occurrence.description].filter(Boolean).join(" · "),
        createdAt,
      };
      for (const slice of expandTimedCalendarEvent(event, [...dates])) {
        const id = `event_occ_external_${occurrence.id}_${slice.date}_${slice.startTime.replace(":", "")}`;
        expanded.push({
          id, title: occurrence.title, dueDate: slice.date, category: "personal", priority: "medium",
          notes: event.details, goalId: "", completed: false, estimatedHours: slice.durationMinutes / 60,
          scheduledDate: slice.date, scheduledStart: slice.startTime, scheduledEnd: slice.endTime,
          createdAt, updatedAt: createdAt,
        });
        resizeEdges.set(id, { start: false, end: false });
      }
    }
    return { tasks: expanded, resizeEdges };
  }

  const explicitVisibleTimeline = useMemo(
    () => expandTimelineRecords(visibleTimelineDates),
    [tasks, visibleTimelineDates],
  );

  const allDayTimelineTasks = useMemo(
    () => expandTaskAllDayRecords(tasks, [...visibleTimelineDates]),
    [tasks, visibleTimelineDates],
  );

  const recurrenceVisibleTimeline = useMemo(() => {
    return expandRecurrenceOccurrences(visibleTimelineDates);
  }, [tasks, visibleTimelineDates]);

  const eventVisibleTimeline = useMemo(() => {
    const external = expandExternalCalendarOccurrences(visibleTimelineDates);
    return { ...external, tasks: [...expandCourseBackgrounds(visibleTimelineDates), ...external.tasks] };
  }, [events, externalCalendarOccurrences, externalCalendarSources, visibleTimelineDates]);

  const conflictTimelineDates = useMemo(() => {
    const dates = new Set<string>();
    for (const date of visibleTimelineDates) {
      dates.add(addDays(date, -1));
      dates.add(date);
      dates.add(addDays(date, 1));
    }
    return dates;
  }, [visibleTimelineDates]);

  function expandConflictTimelineTasks(dates: Set<string>) {
    return [
      ...expandTimelineRecords(dates).tasks,
      ...expandRecurrenceOccurrences(dates).tasks,
      ...expandExternalCalendarOccurrences(dates).tasks.filter((task) => task.scheduledStart),
      ...previewTasks.filter((task) => dates.has(task.scheduledDate || "")),
    ];
  }

  const conflictTimelineTasks = useMemo(
    () => expandConflictTimelineTasks(conflictTimelineDates),
    [tasks, externalCalendarOccurrences, externalCalendarSources, conflictTimelineDates, previewTasks],
  );

  const expandedVisibleTimelineTasks = useMemo(
    () => [...explicitVisibleTimeline.tasks, ...recurrenceVisibleTimeline.tasks, ...eventVisibleTimeline.tasks.filter((item) => item.scheduledStart)].sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart)),
    [explicitVisibleTimeline.tasks, recurrenceVisibleTimeline.tasks, eventVisibleTimeline.tasks],
  );

  // Record ID → real task resolution map (for operations like project change, note save)
  const recordToTaskMap = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) {
      for (const record of (task.timelineRecords || [])) {
        map.set(record.id, task);
      }
    }
    explicitVisibleTimeline.ownerByDisplayId.forEach((task, id) => map.set(id, task));
    return map;
  }, [tasks, explicitVisibleTimeline.ownerByDisplayId]);

  // Record ID → record data map (for operations like uncomplete, toggleDone)
  const recordByIdMap = useMemo(() => {
    const map = new Map<string, TimelineRecord>();
    for (const task of tasks) {
      for (const record of (task.timelineRecords || [])) {
        map.set(record.id, record);
      }
    }
    explicitVisibleTimeline.recordByDisplayId.forEach((record, id) => map.set(id, record));
    return map;
  }, [tasks, explicitVisibleTimeline.recordByDisplayId]);

  const occurrenceToTaskMap = recurrenceVisibleTimeline.ownerMap;

  function resolveOwningTask(taskOrId: Task | string) {
    const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
    return occurrenceToTaskMap.get(id) || recordToTaskMap.get(id);
  }

  function isResolvedUnfinished(task: Task) {
    return task.executionStatus === "returned_unfinished" && resolveOwningTask(task)?.completed === true;
  }

  function resolveTimelineRecordId(displayId: string) {
    return explicitVisibleTimeline.sourceIdByDisplayId.get(displayId) || displayId;
  }

  const placementPreviewTask = useMemo(
    () => mobilePlacement && data ? shelfTask(data, mobilePlacement.taskId, mobilePlacement.subtask)
      : placementPreview ? tasks.find((task) => task.id === placementPreview.taskId) : undefined,
    [data, mobilePlacement, placementPreview, tasks],
  );

  // Real scheduled tasks for current timeline date, expanded from timelineRecords.
  // Each timeline record becomes a virtual Task with id = record.id.
  // Previews are appended but not in data.tasks yet.
  const scheduledTasks = useMemo(
    () => {
      const expanded = expandedVisibleTimelineTasks.filter((task) => dailyTimelineDates.includes(task.scheduledDate || ""));
      const virtual = previewTasks.filter((task) => dailyTimelineDates.includes(task.scheduledDate || ""));
      return [...expanded, ...virtual].sort((a, b) => timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart));
    },
    [expandedVisibleTimelineTasks, dailyTimelineDates, previewTasks],
  );
  // Measure daily canvas width for conflict layout.
  // Must be placed AFTER scheduledTasks declaration (above) so it can
  // safely reference scheduledTasks in its dependency array.
  useEffect(() => {
    const el = timelineCanvasRef.current;
    if (!el || timelineView !== "daily") return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setDailyCanvasWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [timelineView, selectedDate, scheduledTasks, workspaceSuspended]);

  const todayCandidates = useMemo(
    () => tasks.filter((task) => {
      if (task.completed) return false;
      const lane = getExecutionLane(task);
      if (lane === "queued") return false;
      const hasActiveSchedule = (task.timelineRecords || []).some((r) => r.executionStatus === "scheduled") || Boolean(task.scheduledDate);
      if (hasActiveSchedule) return false;
      if (hasRecurrenceOccurrenceOnDate(task, today)) return false;
      return task.plannedForDate === today || Boolean(task.plannedForDate && task.plannedForDate < today);
    }).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [tasks, today]
  );
  const dailyCapacityRisk = useMemo(() => {
    const start = timeToMinutes(settings?.scheduleDayStartTime || "08:00");
    const end = timeToMinutes(settings?.dayEndTime || "22:00");
    const scheduledMinutes = scheduledTasks
      .filter((task) => !task.fixedCourse && task.scheduledDate === today && !task.id.startsWith("preview_"))
      .reduce((total, task) => total + taskDuration(task), 0);
    const availableMinutes = Math.max(end - start - scheduledMinutes, 0);
    const demandMinutes = todayCandidates.reduce((total, task) => total + taskDuration(task), 0);
    const ratio = availableMinutes > 0 ? demandMinutes / availableMinutes : demandMinutes > 0 ? 2 : 0;
    return {
      availableMinutes,
      demandMinutes,
      level: ratio > 1 ? "high" as const : ratio >= 0.8 ? "medium" as const : "comfortable" as const,
    };
  }, [settings?.scheduleDayStartTime, settings?.dayEndTime, scheduledTasks, todayCandidates, today]);
  const completedCandidates = useMemo(
    () => tasks.filter((task) => task.completed && (
      Boolean(task.plannedForDate && task.plannedForDate <= today)
      || task.scheduledDate === today
      || (task.timelineRecords || []).some((record) => record.scheduledDate === today && record.executionStatus === "completed")
    )).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [tasks, today]
  );
  // Only committed draft time changes can alter conflict columns; pointer
  // coordinates and an uncommitted drag preview do not invalidate this map.
  const conflictDraftDate = dragCreate?.committed ? dragCreate.date : undefined;
  const conflictDraftStart = dragCreate?.committed ? dragCreate.startMinutes : undefined;
  const conflictDraftEnd = dragCreate?.committed ? dragCreate.endMinutes : undefined;
  // Conflict layout: maps taskId → { index, count } for overlapping tasks
  const conflictLayout = useMemo(() => {
    const map = new Map<string, { index: number; count: number }>();
    if (timelineView !== "month") {
      const byDate = new Map<string, Task[]>();
      for (const task of scheduledTasks) {
        if (task.fixedCourse) continue;
        const date = task.scheduledDate || "";
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(task);
      }
      if (conflictDraftDate !== undefined && conflictDraftStart !== undefined && conflictDraftEnd !== undefined) {
        const draftTask = { id: "__timeline_draft__", scheduledDate: conflictDraftDate, scheduledStart: minutesToTime(conflictDraftStart), scheduledEnd: minutesToTime(conflictDraftEnd) } as Task;
        const group = byDate.get(conflictDraftDate) || [];
        byDate.set(conflictDraftDate, [...group, draftTask]);
      }
      for (const [, group] of byDate) computeConflictLayout(group).forEach((v, k) => map.set(k, v));
    }
    return map;
  }, [timelineView, scheduledTasks, conflictDraftDate, conflictDraftStart, conflictDraftEnd]);
  const draftConflictStyle = (state: NonNullable<DragCreateState>, view: TimelineView) => {
    const style = computeConflictStyle("__timeline_draft__", conflictLayout, state.width, state.left, view === "weekly" ? 3 : 4, view);
    return style ? { left: style.left, width: style.width } : { left: state.left, width: state.width };
  };

  const unscheduledShelfTasks = useMemo(() => tasks.filter((task) =>
    !task.completed && !hasActiveTaskSchedule(task) && !hasRecurrenceOccurrenceOnDate(task, today)
  ), [tasks, today]);
  const guidePlanTaskId = cloudBaselineReadyRef.current && onboardingStage(settings) === "plan" ? settings?.workspaceGuideTaskId : undefined;
  const visibleCandidates = useMemo(() => {
    const candidateTasks = productDemo ? (showCompletedCandidates ? [...todayCandidates, ...completedCandidates] : todayCandidates) :
      tasks.filter((task) =>
        (task.id === guidePlanTaskId && !task.completed) ||
        ((showCompletedCandidates || !task.completed) &&
          (showScheduledCandidates || (!hasActiveTaskSchedule(task) && !hasRecurrenceOccurrenceOnDate(task, today))))
      );
    return [...candidateTasks].sort((first, second) => (first.order || 0) - (second.order || 0));
  }, [tasks, today, todayCandidates, completedCandidates, showScheduledCandidates, showCompletedCandidates, guidePlanTaskId]);
  function focusCandidateSchedule(schedule: CandidateScheduleSummary) {
    setCompactExecuteView("schedule");
    setTimelineView("daily");
    setSelectedDate(schedule.date);
    requestTimelineFocus({ date: schedule.date, startTime: schedule.startTime, source: "schedule" });
  }
  const headerTask = useMemo(
    () => timerTask || todayCandidates.find((task) => task.workflowStatus === "doing") || todayCandidates[0] || null,
    [timerTask, todayCandidates],
  );
  const headerProject = useMemo(
    () => headerTask?.projectId ? projects.find((project) => String(project.id) === String(headerTask.projectId)) || null : null,
    [headerTask, projects],
  );
  const executeStats = useMemo(() => {
    const planned = tasks.filter((task) => !task.completed && task.plannedForDate === today);
    const scheduled = planned.filter((task) =>
      (task.timelineRecords || []).some((r) => r.scheduledDate === today && r.executionStatus === "scheduled") ||
      Boolean(task.scheduledDate === today && task.scheduledStart) ||
      hasRecurrenceOccurrenceOnDate(task, today)
    );
    const scheduledHours = scheduled.reduce((sum, task) => {
      const active = (task.timelineRecords || []).find((r) => r.scheduledDate === today && r.executionStatus === "scheduled");
      if (active) return sum + clockTimeSpanMinutes(active.scheduledStart, active.scheduledEnd) / 60;
      if (task.scheduledDate === today && task.scheduledStart) {
        return sum + clockTimeSpanMinutes(task.scheduledStart, task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task))) / 60;
      }
      if (isRecurringScheduledTask(task) && task.recurrence?.startTime && task.recurrence.durationMinutes && hasRecurrenceOccurrenceOnDate(task, today)) {
        return sum + task.recurrence.durationMinutes / 60;
      }
      return sum;
    }, 0);
    const totalHours = planned.reduce((sum, task) => sum + (task.estimatedHours || 0.5), 0);
    return { planned, scheduled, scheduledHours, totalHours };
  }, [tasks, today]);

  function projectName(task: Task) {
    const realTask = resolveOwningTask(task) || task;
    return projects.find((project) => String(project.id) === String(realTask.projectId || ""))?.title || "未归属";
  }

  function projectSnapshot(list: Project[], title: string, color = PROJECT_COLOR_PRESETS[0]) {
    const cleanTitle = title.trim();
    const existing = list.find((project) => project.title.toLowerCase() === cleanTitle.toLowerCase());
    if (existing) return { projectId: existing.id, projects: list, created: false };
    const project = makeProject({ ...defaultForm("project"), title: cleanTitle, projectColor: color });
    return { projectId: project.id, projects: [...list, project], created: true };
  }

  function updateTask(taskId: string, patch: Partial<Task>) {
    const current = dataRef.current;
    if (!current) return;
    const existing = current.tasks.find((task) => task.id === taskId);
    const durationChanged = existing && patch.estimatedHours !== undefined && patch.estimatedHours !== existing.estimatedHours;
    const projectChanged = existing && Object.prototype.hasOwnProperty.call(patch, "projectId") && patch.projectId !== existing.projectId;
    const titleChanged = existing && typeof patch.title === "string" && patch.title !== existing.title;
    const inferredAt = workspaceNow().toISOString();
    const nextProfile = current.aiProfile || buildAiProfile(current);
    let updatedTask: Task | undefined;
    const next = {
      ...current,
      aiProfile: {
        ...nextProfile,
        feedback: {
          ...nextProfile.feedback,
          durationCorrections: nextProfile.feedback.durationCorrections + (durationChanged ? 1 : 0),
          projectCorrections: nextProfile.feedback.projectCorrections + (projectChanged ? 1 : 0),
          assignmentUndos: nextProfile.feedback.assignmentUndos + (projectChanged && existing?.aiInference?.project && !patch.projectId ? 1 : 0),
        },
      },
      tasks: current.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const durationInference = durationChanged
          ? { minutes: Math.max(15, Math.round(Number(patch.estimatedHours) * 60)), confidence: 1, source: "user" as const, inferredAt, modelVersion: "user", userOverridden: true }
          : titleChanged && !task.aiInference?.duration?.userOverridden ? undefined : task.aiInference?.duration;
        const projectInference = projectChanged
          ? { projectId: patch.projectId || "", confidence: 1, source: "user" as const, inferredAt, modelVersion: "user", userOverridden: true }
          : titleChanged && !task.aiInference?.project?.userOverridden ? undefined : task.aiInference?.project;
        updatedTask = {
          ...task,
          ...patch,
          aiInference: durationInference || projectInference
            ? { duration: durationInference, project: projectInference }
            : undefined,
          updatedAt: inferredAt,
        };
        return updatedTask;
      })
    };
    const updated = typeof patch.completed === "boolean" ? setTaskCompletion(next, taskId, patch.completed, inferredAt) : next;
    const saving = updated.habitDailyStates !== current.habitDailyStates
      ? saveData(updated)
      : saveTaskOperation(updated, typeof patch.completed === "boolean" && patch.completed !== existing?.completed
        ? (patch.completed ? "complete" : "reopen") : "edit");
    if (titleChanged && updatedTask) void enrichTaskInBackground(updatedTask);
    return saving;
  }

  /** Delete a subtask by ID — uses dataRef.current to avoid stale-closure races. */
  function markSubtaskPlanned(subtasks: Subtask[] | undefined, subtaskId: string, plannedTaskId: string): Subtask[] {
    return (subtasks || []).map((subtask) => {
      const nested = subtask.subtasks ? markSubtaskPlanned(subtask.subtasks, subtaskId, plannedTaskId) : subtask.subtasks;
      if (subtask.id === subtaskId) return { ...subtask, plannedTaskId, subtasks: nested };
      return nested === subtask.subtasks ? subtask : { ...subtask, subtasks: nested };
    });
  }

  function hasLinkedSubtask(subtasks: Subtask[] | undefined, plannedTaskId: string): boolean {
    return Boolean(subtasks?.some((node) => node.plannedTaskId === plannedTaskId || hasLinkedSubtask(node.subtasks, plannedTaskId)));
  }

  function shelfTask(snapshot: PlannerData, taskId: string, subtask?: ShelfSubtask): Task | undefined {
    const task = snapshot.tasks.find((item) => item.id === taskId);
    if (!task || !subtask) return task;
    const node = findSubtaskInTree(task.subtasks || [], subtask.id);
    if (!node || node.completed || node.done) return;
    const linked = snapshot.tasks.find((item) => item.id === node.plannedTaskId && item.parentTaskId === task.id);
    if (linked) return linked;
    if (!node.plannedTaskId) {
      const legacy = snapshot.tasks.filter((item) => item.parentTaskId === task.id && item.title === node.title
        && !item.completed && !hasLinkedSubtask(task.subtasks, item.id));
      if (legacy.length === 1) return legacy[0];
    }
    const now = workspaceNow().toISOString();
    return {
      ...task, id: subtask.draftTaskId, title: node.title, parentTaskId: task.id, subtasks: [],
      completed: false, completedAt: undefined, workflowStatus: "backlog", order: Date.now(),
      recurrence: undefined, timelineRecords: [], plannedForDate: undefined, executionLane: undefined,
      scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, executionStatus: undefined,
      createdAt: now, updatedAt: now,
    };
  }

  function canScheduleShelfTask(task: Task, date: string, replaceLegacyAllDay = false) {
    return !task.completed && !isEventDisplayTask(task)
      && (replaceLegacyAllDay || !hasActiveTaskSchedule(task)) && !hasRecurrenceOccurrenceOnDate(task, date);
  }

  function commitShelfSchedule(taskId: string, date: string, startTime: string, options: { subtask?: ShelfSubtask; moveLegacyAllDay?: boolean } = {}): TimelineRecord | undefined {
    const current = dataRef.current;
    if (!current) return;
    const { subtask, moveLegacyAllDay } = options;
    const task = shelfTask(current, taskId, subtask);
    if (!task || task.completed) return;
    const replaceLegacyAllDay = moveLegacyAllDay && isAllDayTask(task)
      && (!task.executionStatus || task.executionStatus === "scheduled");
    if (!canScheduleShelfTask(task, date, replaceLegacyAllDay)) return;
    const record = startTime ? createScheduledRecord(task, date, startTime, taskDuration(task)) : {
      id: uid("record"), taskId: task.id, scheduledDate: date, scheduledStart: "", scheduledEnd: "",
      executionStatus: "scheduled" as const, createdAt: workspaceNow().toISOString(),
    };
    const nextTask: Task = {
      ...task, plannedForDate: date, executionLane: undefined,
      ...(replaceLegacyAllDay ? { scheduledDate: undefined, executionStatus: undefined } : {}),
      timelineRecords: [...(task.timelineRecords || []), record],
      updatedAt: record.createdAt,
    };
    const nextTasks = current.tasks.map((item) => {
      if (item.id === task.id) return nextTask;
      if (subtask && item.id === taskId) {
        return { ...item, subtasks: markSubtaskPlanned(item.subtasks, subtask.id, task.id), updatedAt: record.createdAt };
      }
      return item;
    });
    if (subtask && task.id === subtask.draftTaskId) nextTasks.push(nextTask);
    const next = { ...current, tasks: nextTasks };
    preserveTimelineViewportOnNextDataChange();
    void saveTaskOperation(next, "schedule", { title: task.title, toast: lang === "zh" ? "已安排到时间轴" : "Scheduled on the timeline" });
    return record;
  }

  function beginCandidateSubtaskDrag(event: React.PointerEvent, parentTask: Task, subtaskId: string) {
    event.stopPropagation();
    const current = dataRef.current;
    if (!current) return;
    const subtask = { id: subtaskId, draftTaskId: uid("task") };
    const task = shelfTask(current, parentTask.id, subtask);
    if (task) beginShelfDrag(event, task, "candidate", {
      allowCandidateReorder: false,
      onSchedule: (date, startTime) => { commitShelfSchedule(parentTask.id, date, startTime, { subtask }); },
    });
  }

  function beginViewTouchScheduleDrag(event: React.PointerEvent, task: Task, subtaskId?: string) {
    if (subtaskId) beginCandidateSubtaskDrag(event, task, subtaskId);
    else beginShelfDrag(event, task, "candidate", {
      allowCandidateReorder: false,
      dragElement: (event.target as HTMLElement).closest<HTMLElement>(".df-task-block") || undefined,
    });
  }

  function openShelfTaskPlacement(task: Task) {
    const schedule = candidateScheduleSummary(task, today);
    if (schedule) {
      if (mobileExecution) closeCandidateDrawer();
      focusCandidateSchedule(schedule);
      return;
    }
    if (mobileExecution) void startMobilePlacement(task.id);
    else openTaskEdit(task);
  }

  async function openShelfSubtaskPlacement(task: Task, subtaskId: string) {
    const subtask = { id: subtaskId, draftTaskId: uid("task") };
    if (mobileExecution) { await startMobilePlacement(task.id, subtask); return; }
    const startTime = await dialog.prompt(lang === "zh" ? `安排到 ${timelineDate} 的几点？（HH:MM）` : `Schedule on ${timelineDate} at what time? (HH:MM)`, "09:00");
    if (startTime && /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(startTime.trim())) {
      commitShelfSchedule(task.id, timelineDate, startTime.trim(), { subtask });
    }
  }

  function reorderTodayCandidate(dragId: string, targetId: string, position: "before" | "after") {
    if (!dragId || !targetId || dragId === targetId) return;
    const current = dataRef.current;
    if (!current) return;
    const sourceId = resolveOwningTask(dragId)?.id || dragId;
    const destinationId = resolveOwningTask(targetId)?.id || targetId;
    const visibleIds = visibleCandidates
      .filter((task) => !isEventDisplayTask(task))
      .map((task) => resolveOwningTask(task)?.id || task.id);
    const next = reorderTodayCandidates(current, visibleIds, sourceId, destinationId, position, groupByProject);
    if (next !== current) void saveTaskOperation(next, "reorder", { title: resolveOwningTask(sourceId)?.title });
  }

  function moveTodayCandidateToProjectGroup(taskId: string, projectId: string | undefined) {
    const sourceId = resolveOwningTask(taskId)?.id || taskId;
    updateTask(sourceId, { projectId });
  }

  function deleteSubtaskById(subtaskId: string) {
    const current = dataRef.current;
    if (!current) return;
    let found = false;
    const nextTasks = current.tasks.map((task) => {
      if (!findSubtaskInTree(task.subtasks || [], subtaskId)) return task;
      found = true;
      return { ...task, subtasks: removeSubtaskFromTree(task.subtasks || [], subtaskId), updatedAt: workspaceNow().toISOString() };
    });
    if (!found) return;
    void saveTaskOperation({ ...current, tasks: nextTasks }, "edit");
  }

  /** Update a specific TimelineRecord by recordId. Finds the owning task. */
  function updateTimelineRecord(recordId: string, patch: Partial<TimelineRecord>) {
    const current = dataRef.current;
    if (!current) return;
    const sourceRecordId = resolveTimelineRecordId(recordId);
    void saveTaskOperation({
      ...current,
      tasks: current.tasks.map((task) => {
        const records = task.timelineRecords;
        if (!records) return task;
        const idx = records.findIndex((r) => r.id === sourceRecordId);
        if (idx === -1) return task;
        const updated = [...records];
        updated[idx] = { ...updated[idx], ...patch };
        return { ...task, timelineRecords: updated, updatedAt: workspaceNow().toISOString() };
      }),
    }, "reschedule");
  }

  function toggleTaskDone(taskId: string) {
    const current = dataRef.current;
    if (!current) return;
    const occurrenceMeta = parseRecurrenceOccurrenceId(taskId);
    if (occurrenceMeta) {
      const realTask = current.tasks.find((task) => task.id === occurrenceMeta.taskId);
      if (!realTask) return;
      const recurrence = realTask.recurrence;
      if (!recurrence?.startTime) return;
      const duration = recurrence.durationMinutes || taskDuration(realTask);
      const completedRecord: TimelineRecord = {
        id: `${realTask.id}_rec_done_${occurrenceMeta.scheduledDate}_${occurrenceMeta.scheduledStart}`.replace(/[^a-zA-Z0-9_:-]/g, "_"),
        taskId: realTask.id,
        scheduledDate: occurrenceMeta.scheduledDate,
        scheduledStart: occurrenceMeta.scheduledStart,
        ...calculateTimelineRecordEnd(occurrenceMeta.scheduledDate, occurrenceMeta.scheduledStart, duration),
        executionStatus: "completed",
        createdAt: workspaceNow().toISOString(),
      };
      void saveTaskOperation({
        ...current,
        tasks: current.tasks.map((task) => task.id === realTask.id
          ? { ...task, timelineRecords: [...(task.timelineRecords || []), completedRecord], updatedAt: completedRecord.createdAt }
          : task),
      }, "complete");
      return;
    }

    const sourceRecordId = resolveTimelineRecordId(taskId);
    const owner = current.tasks.find((task) => task.id === sourceRecordId || task.timelineRecords?.some((record) => record.id === sourceRecordId));
    if (!owner) return;
    const record = owner.timelineRecords?.find((item) => item.id === sourceRecordId);
    const next = toggleTaskCompletion(current, sourceRecordId, workspaceNow().toISOString());
    if (next === current) return;
    if (next.habitDailyStates !== current.habitDailyStates) void saveData(next);
    else void saveTaskOperation(next, (record ? record.executionStatus === "completed" : owner.completed) ? "reopen" : "complete");
  }

  function toggleCandidateTaskDone(task: Task) {
    if (task.completed || isEventDisplayTask(task)) {
      toggleTaskDone(task.id);
      return;
    }
    if (completionHandlesRef.current.has(task.id)) return;

    setCompletingTaskIds((current) => new Set(current).add(task.id));
    completionHandlesRef.current.set(task.id, null);
    const handle = scheduleMotionCommit(() => {
      completionHandlesRef.current.delete(task.id);
      toggleTaskDone(task.id);
      setCompletingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }, MOTION.complete);
    if (completionHandlesRef.current.has(task.id)) completionHandlesRef.current.set(task.id, handle);
  }

  function deleteTaskById(taskId: string) {
    const current = dataRef.current;
    if (!current) return;
    // Check if this is a recurrence occurrence
    const occurrenceMeta = parseRecurrenceOccurrenceId(taskId);
    if (occurrenceMeta) {
      const realTask = occurrenceToTaskMap.get(taskId);
      if (!realTask) return;
      // Cancel this occurrence instead of deleting the whole task
      const now = workspaceNow().toISOString();
      void saveTaskOperation({
        ...current,
        tasks: current.tasks.map((task) => {
          if (task.id !== realTask.id) return task;
          const records = task.timelineRecords || [];
          const hasExisting = records.some((record) => matchesOccurrence(record, occurrenceMeta.scheduledDate, occurrenceMeta.scheduledStart));
          return {
            ...task,
            timelineRecords: hasExisting
              ? records.map((record) =>
                  matchesOccurrence(record, occurrenceMeta.scheduledDate, occurrenceMeta.scheduledStart)
                    ? { ...record, executionStatus: "cancelled" as const }
                    : record
                )
              : [...records, createOccurrenceExceptionRecord(task, occurrenceMeta.scheduledDate, occurrenceMeta.scheduledStart, "cancelled")],
            updatedAt: now,
          };
        }),
      }, "unschedule");
      showToast(t(lang, "toast.cancelledPlan"));
      return;
    }
    // Check if this is a timeline record
    const sourceRecordId = resolveTimelineRecordId(taskId);
    const realTask = current.tasks.find((task) => task.timelineRecords?.some((record) => record.id === sourceRecordId));
    if (realTask) {
      const remainingRecords = (realTask.timelineRecords || []).filter((r) => r.id !== sourceRecordId);
      const removeTask = remainingRecords.length === 0 && !hasRecurringRule(realTask) && !realTask.plannedForDate;
      const nextTasks = removeTask ? current.tasks.filter((task) => task.id !== realTask.id)
        : current.tasks.map((task) => task.id === realTask.id
          ? { ...task, timelineRecords: remainingRecords, updatedAt: workspaceNow().toISOString() }
          : task);
      void saveTaskOperation({ ...current, tasks: nextTasks }, removeTask ? "delete" : "unschedule");
      if (!removeTask) showToast(t(lang, "toast.cancelledPlan"));
      return;
    }
    // Regular task deletion
    if (!current.tasks.some((task) => task.id === taskId)) return;
    void saveTaskOperation({ ...current, tasks: current.tasks.filter((task) => task.id !== taskId) }, "delete");
  }

  function getTemplateApplication(date: string, periods: TemplatePeriod[], currentTasks = tasks) {
    return templateApplication(periods, date, (day) => {
      const dateRange = new Set([addDays(day, -1), day]);
      const recurrence = expandRecurrenceOccurrences(dateRange, currentTasks).tasks.map((task) => ({ ...task, timelineRecords: undefined }));
      const external = expandExternalCalendarOccurrences(new Set([day])).tasks.map((task) =>
        task.scheduledStart ? task : { ...task, scheduledStart: "00:00", scheduledEnd: "00:00" });
      return scheduledTaskIntervalsOnDate([...currentTasks, ...recurrence, ...external], day);
    }, lang === "zh" ? "模板时间段" : "Template block");
  }

  function applyTemplateToDate(date: string, periods: TemplatePeriod[]) {
    const snapshot = dataRef.current;
    if (!snapshot || date < todayIso()) return;

    const { available, skipped } = getTemplateApplication(date, periods, snapshot.tasks);
    if (available.length === 0) return;
    const createdTasks = available.map(({ title, startMinutes, durationMinutes }) => {
      const task = makeTask({
        ...defaultForm("task"),
        title,
        dueDate: addDays(date, 1),
        estimatedHours: durationMinutes / 60,
      });
      return {
        ...task,
        estimatedHours: durationMinutes / 60,
        plannedForDate: date,
        executionLane: undefined,
        timelineRecords: [createScheduledRecord(task, date, minutesToTime(startMinutes), durationMinutes, { preserveTime: true })],
      };
    });

    void saveTaskOperation({ ...snapshot, tasks: [...snapshot.tasks, ...createdTasks] }, "schedule");
    setScheduleTemplateOpen(false);
    const firstRecord = createdTasks[0].timelineRecords[0];
    locateTaskOnTimeline(date, firstRecord.scheduledStart, firstRecord.id);
    const added = createdTasks.length;
    showToast(lang === "zh"
      ? (skipped.size ? "已添加 " + added + " 个时间块，跳过 " + skipped.size + " 个冲突时间块" : "已添加 " + added + " 个模板时间块")
      : (skipped.size ? "Added " + added + " blocks and skipped " + skipped.size + " conflicting blocks" : "Added " + added + " template blocks"));
  }

  function batchUpdateTasks(updates: { taskId: string; patch: Partial<Task> }[]) {
    if (!data || updates.length === 0) return;
    const map = new Map(updates.map((u) => [u.taskId, u.patch]));
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        const p = map.get(task.id);
        return p ? { ...task, ...p, updatedAt: workspaceNow().toISOString() } : task;
      }),
    });
  }

  function updateProject(projectId: string, patch: Partial<Project>) {
    if (!data) return;
    void saveData({
      ...data,
      projects: data.projects.map((project) => project.id === projectId ? { ...project, ...patch, updatedAt: workspaceNow().toISOString() } : project)
    });
  }

  function completeProject(projectId: string) {
    if (!data) return;
    const result = validateProjectCompletion(projectId, data.tasks);
    if (!result.ok) {
      showToast(lang === "zh" ? "请先完成项目下所有任务" : "Complete every task in this project first");
      return;
    }
    updateProject(projectId, { completed: true });
    showToast(lang === "zh" ? "项目已完成" : "Project completed");
  }

  function showToast(message: string, kind?: "delete") {
    const notice = { message, deletionId: kind === "delete" ? uid("deleted") : undefined };
    setToast(notice);
    setToastAction(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast((current) => current === notice ? null : current);
      setToastAction(null);
    }, 2600);
  }

  /**
   * Show a toast with an undo action. The action button is clickable for 5
   * seconds. If clicked, the onClick callback fires and the toast is dismissed.
   * If ignored, the toast disappears automatically.
   */
  function showUndoToast(message: string, actionLabel: string, onUndo: () => void) {
    setToast({ message });
    setToastAction({ label: actionLabel, undo: true, onClick: () => { dismissToast(); onUndo(); } });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      setToastAction(null);
    }, 5000);
  }

  function showToastWithAction(message: string, actionLabel: string, onAction: () => void) {
    setToast({ message });
    setToastAction({ label: actionLabel, onClick: () => { onAction(); dismissToast(); } });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      setToastAction(null);
    }, 5000);
  }

  function dismissToast() {
    setToast(null);
    setToastAction(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
  }

  function focusQuickAddForProject(projectId: string) {
    if (compactLayout) return openQuickTaskAdd(projectId);
    setQuickProjectId(projectId === "__unassigned__" ? "" : projectId);
    setQuickProjectOpen(false);
    window.requestAnimationFrame(() => quickCandidateInputRef.current?.focus());
  }

  function quickAddTask(sample = quickCandidateInputRef.current?.dataset.taskExampleValue, addToToday = true) {
    let title = quickTitle.trim() || sample || "";
    if (!data || !title) return;
    let targetDate = today;
    const yearMatch = addToToday ? title.match(/^\/(\d{4})\s+/) : null;
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 2000 && year <= 2100) {
        title = title.replace(yearMatch[0], "").trim();
        const currentDateObj = new Date(`${selectedDate}T00:00:00`);
        const month = currentDateObj.getMonth();
        const day = Math.min(currentDateObj.getDate(), daysInMonth(year, month));
        targetDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        setSelectedDate(targetDate);
      }
    }
    if (!title.trim()) return;
    const task = makeSmartTask({
      ...defaultForm("task"),
      title,
      projectId: quickProjectId,
    });
    const createdTask: Task = addToToday ? { ...task, plannedForDate: targetDate, executionLane: "candidate", order: Date.now() } : task;
    void saveTaskOperation({ ...data, tasks: [...data.tasks, createdTask] }, "create");
    void enrichTaskInBackground(createdTask);
    if (!compactLayout) setQuickTitle("");
    setQuickAddOpen(false);
    const inferredProject = !quickProjectId && task.projectId ? projects.find((project) => project.id === task.projectId) : undefined;
    if (inferredProject) {
      window.setTimeout(() => showUndoToast(
        lang === "zh" ? `已估时 ${Math.round((task.estimatedHours || 0.5) * 60)} 分钟，并归入「${inferredProject.title}」` : `Estimated ${Math.round((task.estimatedHours || 0.5) * 60)} min and assigned to “${inferredProject.title}”`,
        lang === "zh" ? "撤销归属" : "Undo assignment",
        () => updateTask(task.id, { projectId: undefined }),
      ), 0);
    } else {
      showToast(lang === "zh" ? `已添加任务 · 预计 ${Math.round((task.estimatedHours || 0.5) * 60)} 分钟` : `Task added · ${Math.round((task.estimatedHours || 0.5) * 60)} min`);
    }
  }

  function finishMobileQuickAdd(more = false, sample?: string) {
    const title = quickTitle.trim() || (!more && mobileQuickAddKind === "task" ? sample || "" : "");
    if (!data || (mobileQuickAddKind === "habit" && !habitsEnabled) || (!title && (!more || mobileQuickAddKind === "habit"))) return;
    if (!more && mobileQuickAddKind === "task") {
      if (mobileQuickAddDate) {
        createAllDayTask(title, mobileQuickAddDate, quickProjectId);
        setQuickAddOpen(false);
        return;
      }
      quickAddTask(title, !mobileQuickAddFromProjectTree);
      return;
    }
    setQuickAddOpen(false);
    if (more && mobileQuickAddKind !== "habit") {
      openAdd(mobileQuickAddKind === "project" ? "project" : "task");
      if (mobileQuickAddKind === "task") setMobileQuickAddDate(mobileQuickAddDate);
      setForm((current) => ({ ...current, title, ...(mobileQuickAddKind === "project" ? { projectColor: quickProjectColor } : { projectId: quickProjectId, ...(mobileQuickAddDate ? { dueDate: mobileQuickAddDate } : {}) }) }));
    } else if (mobileQuickAddKind === "project") {
      const project = makeProject({ ...defaultForm("project"), title, projectColor: quickProjectColor });
      void saveData({ ...data, projects: [...data.projects, project] });
      showToast(lang === "zh" ? "项目已创建" : "Project created");
    } else if (mobileQuickAddKind === "habit") {
      const now = workspaceNow().toISOString();
      const habit: Habit = { id: uid("habit"), title, projectId: quickProjectId || undefined, defaultDurationMinutes: mobileQuickHabitMinutes, frequencyRule: "daily", activeWeekdays: [1, 2, 3, 4, 5], order: Date.now(), createdAt: now, updatedAt: now };
      if (more) {
        setNewHabitDraft(habit);
        setEditingHabitId(habit.id);
        setHabitPanel("detail");
      } else {
        void saveData({ ...data, habits: [...(data.habits || []), habit] });
        showToast(lang === "zh" ? "习惯已创建" : "Habit created");
      }
    }
  }

  /** Quick-add entry point used by the desktop widget (title comes from IPC). */
  function widgetQuickAdd(title: string) {
    const currentData = dataRef.current;
    if (!currentData || !title.trim()) return;
    const task = makeSmartTask({ ...defaultForm("task"), title: title.trim(), projectId: "" });
    const candidate: Task = { ...task, plannedForDate: todayIso(), executionLane: "candidate", order: Date.now() };
    void saveTaskOperation({ ...currentData, tasks: [...currentData.tasks, candidate] }, "create");
    void enrichTaskInBackground(candidate);
    showToast(t(lang, "toast.addedToCandidates"));
    return candidate.id;
  }

  /** Build a WidgetSnapshot from the current live React state. */
  function buildWidgetSnapshot(): WidgetSnapshot {
    const snapshotNow = Date.now();
    const snapshotTasks = dataRef.current?.tasks || tasks;
    const pomodoroTaskId = resolvePomodoroSessionTaskId(widgetTimerRuntime, timerTaskId);
    const pomodoroTask = snapshotTasks.find(task => task.id === pomodoroTaskId);
    let selection = resolveWidgetTimelineSelection(snapshotTasks, snapshotNow);
    if (pomodoroTaskId !== undefined) {
      const linked = pomodoroTask && resolveWidgetTimelineSelection([pomodoroTask], snapshotNow);
      selection = linked?.state === "active" ? linked : undefined;
    } else if (widgetTimerRuntime.unlinked) selection = undefined;
    if (widgetTimerRuntime.mode === "countdown" && widgetTimerRuntime.running && widgetTimerRuntime.countdownTaskId && widgetTimerRuntime.countdownTargetAt && snapshotNow >= widgetTimerRuntime.countdownTargetAt) {
      const overrunTask = snapshotTasks.find((item) => item.id === widgetTimerRuntime.countdownTaskId);
      const overrunBounds = timelineRecordBounds(overrunTask, widgetTimerRuntime.countdownRecordId, widgetTimerRuntime.countdownTargetAt - 1);
      if (overrunTask && overrunBounds) selection = { task: overrunTask, ...overrunBounds, state: "active" };
    }
    const task = pomodoroTaskId !== undefined ? pomodoroTask : selection?.task;
    const project = task?.projectId ? projects.find((p) => String(p.id) === String(task.projectId)) || null : null;
    const widgetTimerTick = advanceWidgetTimer(widgetTimerRuntime, widgetTimerPreferences, snapshotNow);
    const taskTimerMatches = Boolean(task && timerTaskId === task.id);
    let timerDisplaySeconds = getWidgetTimerSnapshotDisplaySeconds(
      widgetTimerPreferences.mode,
      widgetTimerTick.displaySeconds,
      taskTimerMatches ? timerElapsedBaseRef.current : 0,
      taskTimerMatches && timerRunning,
      taskTimerMatches ? timerStartedAtRef.current : null,
      snapshotNow,
    );
    let timerPhase = widgetTimerTick.runtime.phase;
    if (selection?.state === "upcoming") {
      timerDisplaySeconds = Math.max(0, Math.ceil((selection.startAt - snapshotNow) / 1_000));
      timerPhase = "countdown";
    } else if (selection?.state === "active" && widgetTimerPreferences.mode === "countdown") {
      const sameCountdown = widgetTimerRuntime.countdownTaskId === task?.id
        && (!widgetTimerRuntime.countdownRecordId || widgetTimerRuntime.countdownRecordId === selection.recordId);
      const targetAt = sameCountdown && widgetTimerRuntime.countdownTargetAt
        ? widgetTimerRuntime.countdownTargetAt
        : selection.endAt;
      timerDisplaySeconds = Math.max(0, Math.ceil(Math.abs(targetAt - snapshotNow) / 1_000));
      timerPhase = snapshotNow >= targetAt ? "overrun" : "countdown";
    } else if (!selection && !widgetTimerRuntime.unlinked && pomodoroTaskId === undefined) {
      timerDisplaySeconds = 0;
    }
    return {
      taskId: pomodoroTaskId ?? task?.id,
      taskTitle: task?.title || (pomodoroTaskId !== undefined || widgetTimerRuntime.unlinked ? (lang === "zh" ? "未关联任务" : "No linked task") : ""),
      taskDueDate: task?.dueDate,
      taskScheduleRecordId: selection?.recordId,
      taskScheduleStartAt: selection?.startAt,
      taskScheduleEndAt: selection?.endAt,
      timelineState: pomodoroTaskId !== undefined ? "active" : selection?.state || "empty",
      taskProjectColor: project?.color,
      elapsedSeconds: timerElapsed,
      timerRunning: taskTimerMatches && timerRunning,
      candidateCount: todayCandidates.length,
      lang,
      alwaysOnTop: settings?.widgetAlwaysOnTop !== false,
      appearance: normalizeWidgetAppearance(settings?.widgetAppearance),
      appearanceConfigured: settings?.widgetAppearanceMigrated === true,
      theme: settings?.theme === "dark" ? "dark" : "light",
      timerModes: availableTimerModes(),
      extensionTheme: extensionService.getActiveThemeDescriptor(),
      timerCountsAsWork: widgetTimerTick.countsAsWork,
      timerSnapshotAt: snapshotNow,
      timerPreferences: widgetTimerPreferences,
      timerRuntime: pomodoroTaskId === undefined ? widgetTimerTick.runtime : { ...widgetTimerTick.runtime, pomodoroTaskId },
      timerDisplaySeconds,
      timerPhase,
      popoverOpen: widgetPopoverOpen,
    };
  }

  function syncActiveTaskScheduleFromTimer(actualEnd: number) {
    const currentData = dataRef.current;
    const runtime = widgetTimerRuntimeRef.current;
    if (!currentData || runtime.mode !== "countdown" || runtime.phase !== "overrun" || !runtime.countdownTaskId || !runtime.countdownTargetAt) return;
    const task = currentData.tasks.find((item) => item.id === runtime.countdownTaskId);
    const bounds = timelineRecordBounds(task, runtime.countdownRecordId, runtime.countdownTargetAt - 1);
    if (!task || !bounds) return;
    const extendedEnd = nextOverrunExtensionEnd(bounds.endAt, actualEnd);
    if (!extendedEnd) return;
    const updatedTask = extendActiveTimelineRecord(task, bounds.recordId, extendedEnd);
    if (updatedTask === task) return;
    void saveData({ ...currentData, tasks: currentData.tasks.map((item) => item.id === task.id ? updatedTask : item) });
  }

  function setPomodoroRuntime(runtime: WidgetTimerRuntime, now: number) {
    widgetTimerRuntimeRef.current = runtime;
    widgetTimerAdvancedAtRef.current = now;
    setWidgetTimerRuntime(runtime);
  }

  function finishPomodoro(save: boolean) {
    if (resolvePomodoroSessionTaskId(widgetTimerRuntimeRef.current, timerTaskRef.current) === undefined) return;
    if (save) {
      if (widgetTimerRuntimeRef.current.running) advanceWidgetTimerNow();
      stopAndSaveTimer();
    } else {
      discardTimer();
    }
    widgetManagesTaskTimerRef.current = false;
    widgetTimerRemainderMsRef.current = 0;
    const now = Date.now();
    setPomodoroRuntime(preparePomodoroRuntime(now, widgetTimerPreferences), now);
  }

  function togglePomodoro(requestedTaskId?: string, startOnly = false) {
    const now = Date.now();
    const current = widgetTimerRuntimeRef.current;
    let taskId = resolvePomodoroSessionTaskId(current, timerTaskRef.current);
    if (taskId !== undefined && startOnly) return;

    if (current.running) {
      advanceWidgetTimerNow(now);
      const advanced = widgetTimerRuntimeRef.current;
      setPomodoroRuntime({ ...advanced, pomodoroTaskId: taskId, running: false, pausedAt: advanced.pausedAt ?? now }, now);
      timerStartedAtRef.current = null;
      setTimerRunning(false);
      setTimerStartedAt(null);
      return;
    }

    let prepared = current;
    if (taskId === undefined) {
      const target = resolvePomodoroTask(dataRef.current?.tasks || [], now, requestedTaskId);
      if (requestedTaskId && !target.task) {
        showToast(lang === "zh" ? "任务暂不可用，请重新选择" : "Task unavailable. Choose a task again.");
        return;
      }
      taskId = target.task?.id ?? null;
      if (timerTaskRef.current && timerTaskRef.current !== taskId) stopAndSaveTimer();
      prepared = { ...preparePomodoroRuntime(now, widgetTimerPreferences, target.scheduleEndAt), pomodoroStartedAt: now };
      widgetTimerRemainderMsRef.current = 0;
      if (taskId && timerTaskRef.current !== taskId) startTimer(taskId);
    }

    const tick = advanceWidgetTimer({ ...prepared, pomodoroTaskId: taskId, unlinked: taskId === null, running: true }, widgetTimerPreferences, now);
    const runtime = tick.runtime;
    setPomodoroRuntime(runtime, now);
    widgetManagesTaskTimerRef.current = Boolean(taskId);
    const counting = Boolean(taskId && runtime.running && tick.countsAsWork);
    timerElapsedBaseRef.current = timerElapsedRef.current;
    timerStartedAtRef.current = counting ? now : null;
    setTimerRunning(counting);
    setTimerStartedAt(counting ? now : null);
  }

  /**
   * Process an action request relayed from the desktop widget. Reads the
   * latest state via refs so the handler stays correct even though the
   * IPC listener is registered once.
   */
  function handleWidgetAction(action: WidgetAction) {
    if (!timerOwnerRef.current?.isOwner()) { timerOwnerRef.current?.sendAction(action); return; }
    switch (action.type) {
      case "requestSnapshot":
        if (nativeFeatureActive(extensionService.getSnapshot(), "desktop-widget")) window.desktopApi?.widget?.pushSnapshot(buildWidgetSnapshot());
        break;
      case "quickAdd":
        widgetQuickAdd(action.title);
        break;
      case "timerStart":
        if (widgetTimerRuntimeRef.current.mode === "pomodoro") togglePomodoro(action.taskId, true);
        else if (action.taskId) startTimer(action.taskId);
        else {
          const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], Date.now());
          if (selection?.state === "active") startTimer(selection.task.id,selection.recordId);
        }
        break;
      case "timerPause":
        if (widgetTimerRuntimeRef.current.mode === "pomodoro") {
          if (widgetTimerRuntimeRef.current.running) togglePomodoro();
        } else {
          syncActiveTaskScheduleFromTimer(Date.now());
          pauseTimer();
        }
        break;
      case "timerResume":
        if (widgetTimerRuntimeRef.current.mode === "pomodoro") {
          if (!widgetTimerRuntimeRef.current.running) togglePomodoro();
        } else resumeTimer();
        break;
      case "timerStop":
        if (widgetTimerRuntimeRef.current.mode === "pomodoro") finishPomodoro(true);
        else {
          syncActiveTaskScheduleFromTimer(Date.now());
          stopAndSaveTimer();
        }
        break;
      case "startPomodoro":
        if (widgetTimerRuntimeRef.current.mode === "pomodoro") togglePomodoro(action.taskId, true);
        break;
      case "finishPomodoro":
        if (widgetTimerRuntimeRef.current.pomodoroStartedAt === action.startedAt) finishPomodoro(action.save);
        break;
      case "discardTimer":
        discardTimer();
        break;
      case "complete":
        if (action.taskId) toggleTaskDone(action.taskId);
        else {
          const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], Date.now());
          if (selection?.state === "active") toggleTaskDone(selection.task.id);
        }
        break;
      case "setAlwaysOnTop":
        if (nativeFeatureActive(extensionService.getSnapshot(), "desktop-widget")) void window.desktopApi?.widget?.setAlwaysOnTop(action.enabled);
        void saveSettings({ widgetAlwaysOnTop: action.enabled });
        break;
      case "updateAppearance":
      case "updateWidgetAppearance":
        void saveSettings({
          widgetAppearance: normalizeWidgetAppearance({ ...settings?.widgetAppearance, ...action.patch }),
          widgetAppearanceMigrated: true,
        });
        break;
      case "setTimerMode": {
        if (action.mode === "countdown" && !nativeFeatureActive(extensionService.getSnapshot(), "countdown") && !productDemo) break;
        if (widgetTimerRuntimeRef.current.mode === "pomodoro") {
          if (action.mode === "pomodoro") break;
          finishPomodoro(true);
        }
        const now = Date.now();
        const taskAction = getWidgetTimerModeChangeTaskAction(
          widgetTimerPreferences.mode,
          timerTaskRef.current,
          timerElapsedBaseRef.current,
          timerStartedAtRef.current,
          now,
        );
        if (taskAction?.type === "pause") pauseTimerAt(now);
        else if (widgetTimerRuntimeRef.current.running && widgetTimerRuntimeRef.current.mode !== "stopwatch") advanceWidgetTimerNow();
        widgetManagesTaskTimerRef.current = false;
        timerStartedAtRef.current = null;
        setTimerRunning(false);
        setTimerStartedAt(null);
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], now);
        const activeTask = selection?.task;
        const countdownTargetAt = action.mode === "countdown" ? selection?.endAt : undefined;
        const { preferences, runtime: transitionedRuntime } = createWidgetTimerModeTransition(
          action.mode,
          widgetTimerPreferences,
          now,
          countdownTargetAt,
        );
        let runtime: WidgetTimerRuntime = action.mode === "countdown" && activeTask && selection
          ? { ...transitionedRuntime, countdownTaskId: activeTask.id, countdownRecordId: selection.recordId }
          : transitionedRuntime;
        const scheduleEnd = selection?.endAt;
        if (scheduleEnd && scheduleEnd > now) runtime = createDeadlineAlignedTimerRuntime(action.mode, now, scheduleEnd, preferences) || runtime;
        widgetTimerAdvancedAtRef.current = now;
        widgetTimerRemainderMsRef.current = 0;
        widgetTimerRuntimeRef.current = runtime;
        setWidgetTimerRuntime(runtime);
        void saveSettings({ widgetTimerPreferences: preferences });
        break;
      }
      case "updateTimerPreferences": {
        if (action.patch.mode === "countdown" && !nativeFeatureActive(extensionService.getSnapshot(), "countdown") && !productDemo) break;
        const preferences = normalizeWidgetTimerPreferences({ ...widgetTimerPreferences, ...action.patch });
        void saveSettings({ widgetTimerPreferences: preferences });
        break;
      }
      case "saveTimerSettings": {
        if (action.draft.mode === "countdown" && !nativeFeatureActive(extensionService.getSnapshot(), "countdown") && !productDemo) break;
        const now = Date.now();
        const preferences = normalizeWidgetTimerPreferences(action.draft);
        if (widgetTimerRuntimeRef.current.mode === "pomodoro") {
          if (preferences.mode === "pomodoro" && resolvePomodoroSessionTaskId(widgetTimerRuntimeRef.current, timerTaskRef.current) !== undefined) {
            void saveSettings({ widgetTimerPreferences: preferences });
            break;
          }
          finishPomodoro(true);
        }
        if (preferences.mode !== widgetTimerRuntimeRef.current.mode && widgetTimerRuntimeRef.current.running) {
          syncActiveTaskScheduleFromTimer(now);
          if (widgetTimerRuntimeRef.current.mode === "stopwatch") pauseTimerAt(now);
          else advanceWidgetTimerNow();
          widgetManagesTaskTimerRef.current = false;
          timerStartedAtRef.current = null;
          setTimerRunning(false);
          setTimerStartedAt(null);
        }
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], now);
        const activeTask = selection?.task;
        const target = preferences.mode === "countdown"
          ? resolveWidgetCountdownTarget(activeTask?.dueDate, activeTask?.id, widgetTimerRuntimeRef.current, selection?.endAt)
          : undefined;
        let runtime: WidgetTimerRuntime = createWidgetTimerModeTransition(preferences.mode, preferences, now, target).runtime;
        const scheduleEnd = selection?.endAt;
        if (scheduleEnd && scheduleEnd > now) runtime = createDeadlineAlignedTimerRuntime(preferences.mode, now, scheduleEnd, preferences) || runtime;
        if (preferences.mode === "countdown" && activeTask && selection) {
          runtime.countdownTaskId = activeTask.id;
          runtime.countdownRecordId = selection.recordId;
        }
        widgetTimerRuntimeRef.current = runtime;
        widgetTimerAdvancedAtRef.current = now;
        widgetTimerRemainderMsRef.current = 0;
        setWidgetTimerRuntime(runtime);
        void saveSettings({ widgetTimerPreferences: preferences });
        break;
      }
      case "resetWidgetTimer": {
        if (widgetTimerRuntimeRef.current.mode === "pomodoro") {
          finishPomodoro(false);
          break;
        }
        const now = Date.now();
        const preferences = normalizeWidgetTimerPreferences(action.draft);
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], now);
        const activeTask = selection?.task;
        const target = preferences.mode === "countdown"
          ? resolveWidgetCountdownTarget(activeTask?.dueDate, activeTask?.id, widgetTimerRuntimeRef.current, selection?.endAt)
          : undefined;
        let runtime: WidgetTimerRuntime = createWidgetTimerModeTransition(preferences.mode, preferences, now, target).runtime;
        const scheduleEnd = selection?.endAt;
        if (scheduleEnd && scheduleEnd > now) runtime = createDeadlineAlignedTimerRuntime(preferences.mode, now, scheduleEnd, preferences) || runtime;
        if (preferences.mode === "countdown" && activeTask && selection) {
          runtime.countdownTaskId = activeTask.id;
          runtime.countdownRecordId = selection.recordId;
        }
        widgetTimerRuntimeRef.current = runtime;
        widgetTimerAdvancedAtRef.current = now;
        widgetTimerRemainderMsRef.current = 0;
        setWidgetTimerRuntime(runtime);
        break;
      }
      case "scheduleWidgetCountdown": {
        if (!nativeFeatureActive(extensionService.getSnapshot(), "countdown") && !productDemo) break;
        const duration = Math.round(action.durationMinutes);
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], Date.now());
        const activeTask = selection?.task;
        const currentData = dataRef.current;
        if (!activeTask || !currentData || !Number.isInteger(duration) || duration < 1 || duration > 1_440) break;
        const now = Date.now();
        const scheduled = scheduleWidgetCountdown(activeTask, new Date(now), duration);
        const record = createScheduledRecord(activeTask, scheduled.record.scheduledDate, scheduled.record.scheduledStart, duration);
        void saveData({ ...currentData, tasks: currentData.tasks.map((task) => task.id === activeTask.id ? { ...task, timelineRecords: [...(task.timelineRecords || []), record] } : task) });
        const runtime = { ...createWidgetTimerRuntime("countdown", now, { ...widgetTimerPreferences, mode: "countdown" }, scheduled.countdownTargetAt), running: false, pausedAt: now, countdownTaskId: activeTask.id, countdownRecordId: record.id };
        widgetTimerRuntimeRef.current = runtime;
        widgetTimerAdvancedAtRef.current = now;
        widgetTimerRemainderMsRef.current = 0;
        setWidgetTimerRuntime(runtime);
        break;
      }
      case "toggleWidgetTimer": {
        if (widgetTimerRuntimeRef.current.mode === "pomodoro") {
          togglePomodoro();
          break;
        }
        const now = Date.now();
        const selection = resolveWidgetTimelineSelection(dataRef.current?.tasks || [], now);
        let current = widgetTimerRuntimeRef.current;
        // Unlinked focus uses the same clock but never attaches its elapsed time
        // to a task that becomes active later. Reset starts a fresh linked session.
        if (getTimerMode(current.mode) && (current.unlinked || selection?.state !== "active")) {
          const running = !current.running;
          if (!current.unlinked && timerTaskRef.current) { advanceWidgetTimerNow(); stopAndSaveTimer(); }
          if (current.running) advanceWidgetTimerNow();
          current = widgetTimerRuntimeRef.current;
          const runtime: WidgetTimerRuntime = { ...current, unlinked: true, running };
          if (running) {
            const shift = Math.max(0, now - (current.pausedAt ?? now));
            runtime.phaseStartedAt += shift;
            if (!runtime.plan && runtime.phaseEndsAt !== undefined) runtime.phaseEndsAt += shift;
            delete runtime.pausedAt;
          } else runtime.pausedAt = now;
          timerRecordRef.current=undefined;
          timerTaskRef.current = null; timerElapsedRef.current = 0; timerElapsedBaseRef.current = 0; timerStartedAtRef.current = null;
          setTimerTaskId(null); setTimerElapsed(0); setTimerRunning(false); setTimerStartedAt(null);
          widgetManagesTaskTimerRef.current = false;
          widgetTimerRemainderMsRef.current = 0; widgetTimerAdvancedAtRef.current = now;
          widgetTimerRuntimeRef.current = runtime; setWidgetTimerRuntime(runtime);
          break;
        }
        if (selection?.state !== "active") break;
        if (current.mode === "stopwatch") {
          if (timerTaskRef.current && timerTaskRef.current !== selection.task.id) stopAndSaveTimer();
          const taskAction = getStopwatchTaskTimerAction(
            timerTaskRef.current === selection.task.id ? timerTaskRef.current : null,
            timerElapsedBaseRef.current,
            timerStartedAtRef.current,
            now,
          );
          if (taskAction.type === "pause") { syncActiveTaskScheduleFromTimer(now); pauseTimerAt(now); }
          else if (taskAction.type === "resume") resumeTimer();
          else startTimer(selection.task.id,selection.recordId);
          const running = taskAction.type !== "pause";
          const runtime = { ...current, running, ...(running ? {} : { pausedAt: now }) };
          if (running) delete runtime.pausedAt;
          widgetManagesTaskTimerRef.current = false;
          widgetTimerAdvancedAtRef.current = now;
          widgetTimerRuntimeRef.current = runtime;
          setWidgetTimerRuntime(runtime);
          break;
        }
        if (current.mode === "countdown" && (current.countdownTaskId !== selection.task.id || current.countdownRecordId !== selection.recordId)) {
          current = {
            ...createWidgetTimerRuntime("countdown", now, widgetTimerPreferences, selection.endAt),
            running: false,
            pausedAt: now,
            countdownTaskId: selection.task.id,
            countdownRecordId: selection.recordId,
          };
        }
        if (current.running) {
          syncActiveTaskScheduleFromTimer(now);
          advanceWidgetTimerNow();
          const advanced = widgetTimerRuntimeRef.current;
          const runtime = { ...advanced, running: false, pausedAt: now };
          widgetManagesTaskTimerRef.current = false;
          timerStartedAtRef.current = null;
          setTimerRunning(false);
          setTimerStartedAt(null);
          widgetTimerAdvancedAtRef.current = now;
          widgetTimerRuntimeRef.current = runtime;
          setWidgetTimerRuntime(runtime);
        } else {
          if (current.mode === "countdown" && current.countdownTargetAt === undefined) break;
          const scheduleEnd = selection.endAt;
          const prepared = scheduleEnd && scheduleEnd > now && current.pausedAt === current.phaseStartedAt
            ? createDeadlineAlignedTimerRuntime(current.mode, now, scheduleEnd, widgetTimerPreferences) || current
            : current;
          const runtime = { ...prepared, running: true };
          delete runtime.pausedAt;
          widgetTimerAdvancedAtRef.current = now;
          widgetTimerRuntimeRef.current = runtime;
          setWidgetTimerRuntime(runtime);
          widgetManagesTaskTimerRef.current = true;
          if (timerTaskRef.current !== selection.task.id) startTimer(selection.task.id,selection.recordId);
          const countsAsWork = advanceWidgetTimer(runtime, widgetTimerPreferences, now).countsAsWork;
          timerElapsedBaseRef.current = timerElapsedRef.current;
          timerStartedAtRef.current = countsAsWork ? now : null;
          setTimerRunning(Boolean(timerTaskRef.current) && countsAsWork);
          setTimerStartedAt(Boolean(timerTaskRef.current) && countsAsWork ? now : null);
        }
        break;
      }
      case "resetPosition":
        if (nativeFeatureActive(extensionService.getSnapshot(), "desktop-widget")) void window.desktopApi?.widget?.setBounds({ x: 80, y: 80, width: 400, height: 80 });
        break;
    }
  }

  // Keep a ref to the latest action handler so the IPC listener (registered
  // once) always calls the current closure with up-to-date state.
  const widgetActionHandlerRef = useRef(handleWidgetAction);
  widgetActionHandlerRef.current = handleWidgetAction;
  useEffect(() => onTimerModeOpening((mode, owner) => {
    const current = workspacePanelRef.current;
    if (current?.kind === "timer" && (owner ? current.owner === owner : current.id === mode)) {
      setWorkspacePanel(null);
      return;
    }
    if (widgetTimerRuntimeRef.current.mode !== mode) widgetActionHandlerRef.current({ type: "setTimerMode", mode });
    setWorkspacePanel({ kind: "timer", id: mode, owner });
  }), []);
  const widgetSnapshotBuilderRef = useRef(buildWidgetSnapshot);
  widgetSnapshotBuilderRef.current = buildWidgetSnapshot;

  useEffect(() => {
    if (!data || !settings || productDemo) return;
    const accountId = authState?.user?.id || "preview";
    const owner = createTimerOwner({ accountId,
      onOwnershipChange(owns) {
        setOwnsTimerClock(owns);
        if (owns && mirroredTimerRef.current) {
          const next = mirroredTimerRef.current;
          timerElapsedBaseRef.current = next.elapsedSeconds;
          const started = next.timerRunning && next.timerRuntime.mode === "stopwatch" ? next.timerSnapshotAt || Date.now() : null;
          timerStartedAtRef.current = started; timerLastActivityAtRef.current = Date.now(); setTimerStartedAt(started);
        }
      },
      onAction: action => widgetActionHandlerRef.current(action),
      onSnapshot(next) {
        if (!settingsRef.current || !dataRef.current || (authStateRef.current?.user?.id || "preview") !== accountId) return;
        mirroredTimerRef.current = next;
        const taskId = next.timerRuntime.mode === "pomodoro"
          ? next.timerRuntime.pomodoroTaskId ?? null
          : next.timerRuntime.unlinked ? null : next.taskId || null;
        timerRecordRef.current=undefined; // a mirrored clock does not carry verified execution identity
        timerTaskRef.current = taskId; timerElapsedRef.current = next.elapsedSeconds; timerElapsedBaseRef.current = next.elapsedSeconds;
        timerStartedAtRef.current = null; setTimerStartedAt(null);
        setTimerTaskId(taskId); setTimerElapsed(next.elapsedSeconds); setTimerRunning(next.timerRunning);
        widgetTimerRuntimeRef.current = next.timerRuntime; widgetTimerAdvancedAtRef.current = next.timerSnapshotAt || Date.now(); setWidgetTimerRuntime(next.timerRuntime);
        if (JSON.stringify(settingsRef.current.widgetTimerPreferences) !== JSON.stringify(next.timerPreferences)) {
          const mirrored = { ...settingsRef.current, widgetTimerPreferences: next.timerPreferences };
          settingsRef.current = mirrored; setSettings(mirrored);
        }
      },
    });
    timerOwnerRef.current = owner;
    return () => { owner.dispose(); timerOwnerRef.current = null; mirroredTimerRef.current = null; setOwnsTimerClock(false); };
  }, [Boolean(data), Boolean(settings), authState?.user?.id]);

  // Register the widget action listener once. Desktop-only.
  useEffect(() => {
    if (!widgetEnabled || !window.desktopApi?.widget) return;
    const unsubscribe = window.desktopApi.widget.onAction((action) => {
      widgetActionHandlerRef.current(action);
    });
    return unsubscribe;
  }, [widgetEnabled]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!timerOwnerRef.current?.isOwner()) return;
      const snapshot = widgetSnapshotBuilderRef.current(); timerOwnerRef.current.publish(snapshot); if (nativeFeatureActive(extensionService.getSnapshot(), "desktop-widget")) window.desktopApi?.widget?.pushSnapshot(snapshot);
    }, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  // Push a fresh snapshot to the widget whenever relevant state changes so
  // the widget stays in sync without polling (timer ticks, task complete,
  // quick add, candidate changes). Throttled to avoid flooding on rapid
  // timer ticks (every second).
  useEffect(() => {
    if (!timerOwnerRef.current?.isOwner()) return;
    const snapshot = buildWidgetSnapshot(); timerOwnerRef.current.publish(snapshot); if (widgetEnabled) window.desktopApi?.widget?.pushSnapshot(snapshot);
  }, [timerElapsed, timerRunning, timerTaskId, data, settings?.widgetAlwaysOnTop, settings?.widgetAppearance, settings?.widgetAppearanceMigrated, settings?.theme, widgetTimerPreferences, widgetTimerRuntime, widgetPopoverOpen, lang, extensionSnapshot, ownsTimerClock]);

  useEffect(() => {
    const running = widgetTimerPreferences.mode === "stopwatch" ? timerRunning : widgetTimerRuntime.running;
    if (running && timerOwnerRef.current?.isOwner()) syncActiveTaskScheduleFromTimer(Date.now());
  }, [timerElapsed, timerRunning, widgetTimerRuntime, widgetTimerPreferences.mode]);

  // Auto-open the widget on launch if the user opted in. Runs once.
  const widgetAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (widgetAutoOpenedRef.current) return;
    if (!window.desktopApi?.widget) return;
    if (settings?.widgetOpenOnLaunch !== true) return;
    if (!widgetEnabled) return;
    widgetAutoOpenedRef.current = true;
    void window.desktopApi.widget.open();
  }, [settings?.widgetOpenOnLaunch, widgetEnabled]);
  useEffect(() => {
    if (!isCompactWindowRoute && !widgetEnabled && extensionService.isReady()) {
      widgetAutoOpenedRef.current = false;
      void window.desktopApi?.widget?.close();
    }
  }, [widgetEnabled, extensionSnapshot.busy, settings?.extensions]);

  // Apply always-on-top setting to an existing widget window when it changes.
  useEffect(() => {
    if (!widgetEnabled || !window.desktopApi?.widget) return;
    if (settings?.widgetAlwaysOnTop === undefined) return;
    void window.desktopApi.widget.setAlwaysOnTop(settings.widgetAlwaysOnTop !== false);
  }, [settings?.widgetAlwaysOnTop, widgetEnabled]);

  useEffect(() => {
    if (!window.desktopApi?.compactWindow) return;
    if (settings?.compactWindowAlwaysOnTop === undefined) return;
    void window.desktopApi.compactWindow.setAlwaysOnTop(settings.compactWindowAlwaysOnTop !== false);
  }, [settings?.compactWindowAlwaysOnTop]);

  function createQuickProject() {
    if (!data || !quickProjectTitle.trim()) return;
    const snapshot = projectSnapshot(data.projects, quickProjectTitle, quickProjectColor);
    if (snapshot.created) void saveData({ ...data, projects: snapshot.projects });
    setQuickProjectId(snapshot.projectId);
    setQuickProjectTitle("");
    setQuickProjectOpen(false);
  }

  function quickCreateProject(title: string) {
    if (!data || !title.trim()) return "";
    const snapshot = projectSnapshot(data.projects, title);
    if (snapshot.created) void saveData({ ...data, projects: snapshot.projects });
    setForm((current) => ({ ...current, projectId: snapshot.projectId }));
    showToast(snapshot.created ? t(lang, "toast.projectCreated") : t(lang, "toast.projectSelected"));
    return snapshot.projectId;
  }

  function createProjectForTask(taskId: string, title: string) {
    if (!data || !title.trim()) return "";
    const realTaskId = resolveOwningTask(taskId)?.id || taskId;
    const snapshot = projectSnapshot(data.projects, title);
    void saveData({
      ...data,
      projects: snapshot.projects,
      tasks: data.tasks.map((task) => task.id === realTaskId ? { ...task, projectId: snapshot.projectId, updatedAt: workspaceNow().toISOString() } : task)
    });
    showToast(snapshot.created ? t(lang, "toast.createdAndAssigned") : t(lang, "toast.assignedToProject"));
    return snapshot.projectId;
  }

  function createTaskInProject(projectId: string) {
    if (compactLayout) return openQuickTaskAdd(projectId, true);
    rememberLayerTrigger("drawer");
    setAddType("task");
    setEditingId("");
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    const initialForm = { ...defaultForm("task"), projectId };
    drawerInitialFormRef.current = initialForm;
    setForm(initialForm);
    setDrawerOpen(true);
  }

  function saveQuickSchedule() {
    if (!data || !quickSchedule?.title.trim()) return;
    if (quickSchedule.isAllDay) {
      const hashProjectTitle = quickSchedule.title.match(/#([^\s#]+)\s*$/)?.[1]?.trim() || "";
      let projectId = quickSchedule.projectId;
      let nextProjects = data.projects;
      if (hashProjectTitle && hashProjectTitle.toLowerCase() !== "inbox") {
        const projectExists = projectId && nextProjects.some((project) => String(project.id) === String(projectId));
        if (!projectExists) {
          const snapshot = projectSnapshot(nextProjects, hashProjectTitle);
          projectId = snapshot.projectId;
          nextProjects = snapshot.projects;
        }
      }
      const cleanTitle = quickSchedule.title.replace(/#[^\s#]+/g, "").trim() || quickSchedule.title.trim();
      const durationMinutes = learnedTaskDurationMinutes(cleanTitle, data.tasks, projectId);
      const task = makeSmartTask({
        ...defaultForm("task"),
        title: cleanTitle,
        projectId,
        dueDate: addDays(timelineDate, 1),
        estimatedHours: durationMinutes / 60
      });
      void saveTaskOperation({
        ...data,
        projects: nextProjects,
        tasks: [...data.tasks, {
          ...task,
          plannedForDate: timelineDate,
          executionLane: undefined,
          scheduledDate: timelineDate,
          scheduledStart: undefined,
          scheduledEnd: undefined
        }]
      }, "create");
      setQuickSchedule(null);
      showToast(t(lang, "toast.addedToAllDay"));
      return;
    }
    const hashProjectTitle = quickSchedule.title.match(/#([^\s#]+)\s*$/)?.[1]?.trim() || "";
    let projectId = quickSchedule.projectId;
    let nextProjects = data.projects;
    if (hashProjectTitle && hashProjectTitle.toLowerCase() !== "inbox") {
      const projectExists = projectId && nextProjects.some((project) => String(project.id) === String(projectId));
      if (!projectExists) {
        const snapshot = projectSnapshot(nextProjects, hashProjectTitle);
        projectId = snapshot.projectId;
        nextProjects = snapshot.projects;
      }
    }
    const cleanTitle = quickSchedule.title.replace(/#[^\s#]+/g, "").trim() || quickSchedule.title.trim();
    const durationMinutes = learnedTaskDurationMinutes(cleanTitle, data.tasks, projectId);
    const endTime = addMinutes(quickSchedule.startTime, durationMinutes);
    const task = makeSmartTask({
      ...defaultForm("task"),
      title: cleanTitle,
      projectId,
      dueDate: addDays(timelineDate, 1),
      estimatedHours: durationMinutes / 60
    });
    const scheduledRecord = createScheduledRecord(task, timelineDate, quickSchedule.startTime, durationMinutes);
    void saveTaskOperation({
      ...data,
      projects: nextProjects,
      tasks: [...data.tasks, {
        ...task,
        plannedForDate: timelineDate,
        executionLane: undefined,
        timelineRecords: [scheduledRecord],
      }]
    }, "create");
    requestTimelineFocus({ date: timelineDate, startTime: quickSchedule.startTime, taskId: scheduledRecord.id, source: "schedule" });
    setQuickSchedule(null);
    showToast(t(lang, "toast.addedToTimeline"));
  }

  function createAllDayTask(title: string, targetDate: string, projectId: string | null) {
    if (!data || !title.trim()) return;
    let nextProjects = data.projects;
    let pid = projectId || "";
    if (!pid) {
      // Check for #project in title (already stripped, but handle projectId)
    }
    const cleanTitle = title.trim();
    const estimatedMinutes = learnedTaskDurationMinutes(cleanTitle, data.tasks, pid || undefined);
    const task = makeSmartTask({ ...defaultForm("task"), title: cleanTitle, projectId: pid, dueDate: addDays(targetDate, 1), estimatedHours: estimatedMinutes / 60 });
    void saveTaskOperation({
      ...data,
      projects: nextProjects,
      tasks: [...data.tasks, { ...task, plannedForDate: targetDate, executionLane: undefined, scheduledDate: targetDate, scheduledStart: undefined, scheduledEnd: undefined }]
    }, "create");
    setAllDayQuickAdd(null);
    showToast(t(lang, "toast.allDayTaskAdded"));
  }

  function makeAllDay(taskId: string, targetDate: string) {
    // If taskId is a record ID (from expanded timeline), convert the record to all-day
    const realTask = recordToTaskMap.get(taskId);
    if (realTask && data) {
      const sourceRecordId = resolveTimelineRecordId(taskId);
      // Update the record: remove start/end times (mark as all-day)
      void saveData({
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === realTask.id
            ? {
                ...t,
                dueDate: t.dueDate || addDays(targetDate, 1),
                plannedForDate: targetDate,
                executionLane: undefined,
                timelineRecords: (t.timelineRecords || []).map((r) =>
                  r.id === sourceRecordId
                    ? { ...r, scheduledDate: targetDate, scheduledStart: "", scheduledEndDate: undefined, scheduledEnd: "" }
                    : r
                ),
                updatedAt: workspaceNow().toISOString(),
              }
            : t
        ),
      });
    } else {
      // Legacy: direct task ID
      const task = data?.tasks.find((item) => item.id === taskId);
      updateTask(taskId, { dueDate: task?.dueDate || addDays(targetDate, 1), plannedForDate: targetDate, executionLane: undefined, scheduledDate: targetDate, scheduledStart: undefined, scheduledEnd: undefined });
    }
    showToast(t(lang, "toast.setToAllDay"));
    setDrag(null);
  }

  function hasScheduleConflict(date: string, startTime: string, endTime: string, ignoreTaskId?: string, timelineTasks = conflictTimelineTasks) {
    const ignoredRecordId = ignoreTaskId ? recordByIdMap.get(ignoreTaskId)?.id : undefined;
    return timelineTasks.some((task) => {
      if (task.fixedCourse) return false;
      const sameRecord = ignoredRecordId
        && (task.id === ignoredRecordId || task.id.startsWith(`${ignoredRecordId}__day__`));
      if (task.id === ignoreTaskId || sameRecord || !task.scheduledDate || !task.scheduledStart || !task.scheduledEnd) return false;
      return scheduledDateTimesOverlap(date, startTime, endTime, task.scheduledDate, task.scheduledStart, task.scheduledEnd);
    });
  }

  function findNextFreeSlot(duration: number) {
    const now = workspaceNow();
    const earliest = clampSlot(Math.max(now.getHours() * 60 + now.getMinutes(), TIMELINE_START * 60));
    const latestStart = TIMELINE_END * 60 - duration;
    for (let cursor = earliest; cursor <= latestStart; cursor += SLOT_MINUTES) {
      const start = minutesToTime(cursor);
      const end = minutesToTime(cursor + duration);
      if (!hasScheduleConflict(today, start, end)) return start;
    }
    return minutesToTime(Math.max(TIMELINE_START * 60, latestStart));
  }

  function quickRescheduleTask(taskId: string, date: string, recordId?: string) {
    const current = dataRef.current;
    const task = current?.tasks.find((item) => item.id === taskId);
    if (!current || !task) return;
    const record = (task.timelineRecords || []).find((item) => item.id === recordId)
      || (task.timelineRecords || []).find((item) => item.executionStatus === "scheduled");
    const duration = record ? timelineRecordDurationMinutes(record) : taskDuration(task);
    const startTime = record?.scheduledStart || task.scheduledStart || task.recurrence?.startTime || "09:00";
    const dates = new Set<string>([addDays(date, -1)]);
    const endDate = calculateTimelineRecordEnd(date, startTime, duration).scheduledEndDate || date;
    for (let cursor = date; cursor <= endDate; cursor = addDays(cursor, 1)) dates.add(cursor);
    const targetTimelineTasks = expandConflictTimelineTasks(dates);
    if (hasScheduleConflict(date, startTime, addMinutes(startTime, duration), record?.id || taskId, targetTimelineTasks)) {
      showToast(lang === "zh" ? "这段时间已有安排，请调整时间" : "This time is already booked. Adjust the time.");
      return;
    }

    const now = workspaceNow().toISOString();
    const nextTasks = current.tasks.map((item) => {
      if (item.id !== task.id) return item;
      const records = item.timelineRecords || [];
      const target = records.find((entry) => entry.id === record?.id);
      return {
        ...item,
        completed: false,
        plannedForDate: date,
        executionLane: undefined,
        scheduledDate: undefined,
        scheduledStart: undefined,
        scheduledEnd: undefined,
        executionStatus: undefined,
        timelineRecords: target
          ? records.map((entry) => entry.id === target.id
              ? { ...rescheduleTimelineRecord(entry, date, startTime, duration), executionStatus: "scheduled" as const }
              : entry)
          : [...records.filter((entry) => entry.executionStatus !== "scheduled"), createScheduledRecord(item, date, startTime, duration)],
        updatedAt: now,
      };
    });
    void saveTaskOperation({ ...current, tasks: nextTasks }, "reschedule");
    const dateLabel = date === addDays(today, 1) ? (lang === "zh" ? "明天" : "tomorrow") : shortDate(date);
    showToastWithAction(
      lang === "zh" ? `已安排到${dateLabel} ${startTime}` : `Scheduled for ${dateLabel} at ${startTime}`,
      lang === "zh" ? "查看日程" : "View schedule",
      () => {
        locateTaskOnTimeline(date, startTime, record?.id || taskId);
      },
    );
  }

  // Show scrollbar only when actually scrolling
  useEffect(() => {
    const timers = new WeakMap<HTMLElement, number>();
    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!(target instanceof HTMLElement)) return;
      target.classList.add("is-scrolling");
      clearTimeout(timers.get(target)!);
      timers.set(target, window.setTimeout(() => {
        target.classList.remove("is-scrolling");
      }, 500));
    };
    document.addEventListener("scroll", onScroll, { capture: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  function dailyTargetFromPointer(clientY: number) {
    const gridEl = timelineCanvasRef.current;
    if (!gridEl) return { date: timelineDate, startTime: "09:00", endTime: "09:15", dayIndex: 0, minutes: 9 * 60 };
    return dailyContinuousTargetFromContentY({
      contentY: clientY - gridEl.getBoundingClientRect().top,
      anchorDate: continuousTimelineStartDate,
      dayStartHour,
      dayCount: continuousTimelineBandCount,
      hourHeight: timelineHourHeight,
    });
  }

  function continuousDateOffset(date: string) {
    return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${continuousTimelineStartDate}T00:00:00`).getTime()) / 86400000);
  }

  function continuousTimedTop(date: string, startTime: string) {
    if (timelineColumnCount === 1) {
      return dailyContinuousBlockTop(date, startTime, continuousTimelineStartDate, dayStartHour, timelineHourHeight);
    }
    const offset = continuousDateOffset(date);
    const bandIndex = Math.floor(offset / timelineColumnCount);
    let minutesFromDayStart = timeToMinutes(startTime) - dayStartHour * 60;
    if (minutesFromDayStart < 0) minutesFromDayStart += 24 * 60;
    return bandIndex * ((24 * 60 / SLOT_MINUTES) * timelineSlotHeight) + (minutesFromDayStart / SLOT_MINUTES) * timelineSlotHeight;
  }

  function continuousPointerTarget(clientX: number, clientY: number, gridElement: HTMLElement) {
    const rect = gridElement.getBoundingClientRect();
    const columnWidth = rect.width / timelineColumnCount;
    const columnIndex = Math.min(Math.max(Math.floor((clientX - rect.left) / columnWidth), 0), timelineColumnCount - 1);
    const pxPerMinute = timelineSlotHeight / SLOT_MINUTES;
    const snappedFromTop = Math.min(
      continuousTimelineBandCount * 24 * 60 - SLOT_MINUTES,
      Math.max(0, Math.round(((clientY - rect.top) / pxPerMinute) / SLOT_MINUTES) * SLOT_MINUTES),
    );
    const bandIndex = Math.floor(snappedFromTop / (24 * 60));
    const minutesFromDayStart = snappedFromTop % (24 * 60);
    const minutes = (dayStartHour * 60 + minutesFromDayStart) % (24 * 60);
    const startTime = minutesToTime(minutes);
    return {
      date: addDays(continuousTimelineStartDate, bandIndex * timelineColumnCount + columnIndex),
      startTime,
      endTime: addMinutes(startTime, SLOT_MINUTES),
      dayIndex: columnIndex,
      minutes,
    };
  }

  function slotFromPointer(clientY: number, offsetMinutes = 0, clientX?: number) {
    const { gridEl, scrollEl, visDays } = getDropGridAndDays();
    if (!gridEl || !scrollEl) return "09:00";
    if (timelineView === "daily" && settings?.continuousCrossDayScroll !== false) {
      return minutesToTime(clampSlot(dailyTargetFromPointer(clientY).minutes - offsetMinutes));
    }
    const rect = gridEl.getBoundingClientRect();
    const target = pointerToDateTime({
      clientX: clientX ?? rect.left + rect.width / 2,
      clientY,
      gridElement: gridEl,
      scrollElement: scrollEl,
      visibleDays: visDays,
      startHour: dayStartHour,
      hourHeight: timelineHourHeight,
    });
    return minutesToTime(clampSlot(target.minutes - offsetMinutes));
  }

  /**
   * Unified pointer → {date, startTime} resolver for timeline drag/drop/resize.
   *
   * In continuous cross-day mode the date MUST come from the Y band index
   * (via `continuousPointerTarget`), never from `currentDate`/`timelineDate`.
   * In non-continuous mode the date comes from the X column via
   * `getDropTargetFromPointer`. Both paths return the snapped slot time.
   */
  function resolveDropTarget(clientX: number, clientY: number): { date: string; startTime: string; minutes: number } | null {
    const { gridEl, scrollEl, visDays } = getDropGridAndDays();
    if (!gridEl) return null;
    if (continuousTimelineEnabled) {
      const target = continuousPointerTarget(clientX, clientY, gridEl);
      return { date: target.date, startTime: target.startTime, minutes: target.minutes };
    }
    if (!scrollEl) return null;
    const target = getDropTargetFromPointer({
      clientX,
      clientY,
      gridElement: gridEl,
      scrollElement: scrollEl,
      visibleDays: visDays,
      startHour: dayStartHour,
      hourHeight: timelineHourHeight,
    });
    return { date: target.date, startTime: target.startTime, minutes: target.minutes };
  }

  /**
   * Subtract a pointer offset (in minutes) from a {date, time} pair, rolling
   * the date backwards when the subtraction crosses midnight. Used by drag to
   * keep the grabbed point under the cursor when the pointer sits near 00:00.
   */
  function subtractOffsetFromDateTime(date: string, time: string, offsetMinutes: number): { date: string; startTime: string } {
    let total = timeToMinutes(time) - offsetMinutes;
    let dayShift = 0;
    while (total < 0) {
      total += 24 * 60;
      dayShift -= 1;
    }
    const snapped = clampSlot(total);
    return { date: addDays(date, dayShift), startTime: minutesToTime(snapped) };
  }

  /**
   * Continuous absolute minutes (from `continuousTimelineStartDate`) for a
   * `{date, time}` point. Used by resize to compute durations across midnight
   * without the `end - start` negative-wrap bug.
   */
  function dateTimeToContinuousAbs(date: string, time: string): number {
    const offset = continuousDateOffset(date);
    return offset * 24 * 60 + timeToMinutes(time);
  }

  function pointerOutsideTimeline(clientX: number, clientY: number) {
    const rect = (timelineView === "3day" || timelineView === "weekly")
      ? timelineRef.current?.getBoundingClientRect()
      : timelineCanvasRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const scrollRect = timelineRef.current?.getBoundingClientRect();
    const compactLeftReturn = Boolean(compactLayout
      && scrollRect
      && clientX >= 0
      && clientX < rect.left
      && clientY >= scrollRect.top
      && clientY <= scrollRect.bottom);
    if (compactLeftReturn) return true;
    return clientX < rect.left - 80 || clientX > rect.right + 80 || clientY < rect.top - 40 || clientY > rect.bottom + 40;
  }

  function getScheduledEventsForRange(dateRange: string[]) {
    const visibleSet = new Set(dateRange);
    const explicitExpansion = expandTimelineRecords(visibleSet);
    const explicit = explicitExpansion.tasks.map((task) => ({
      id: task.id,
      taskId: explicitExpansion.ownerByDisplayId.get(task.id)?.id || task.id,
      title: task.title,
      scheduledDate: task.scheduledDate,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
    }));
    const recurrence = expandRecurrenceOccurrences(visibleSet).tasks.map((task) => ({
      id: task.id,
      taskId: resolveOwningTask(task.id)?.id || task.id,
      title: task.title,
      scheduledDate: task.scheduledDate,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
    }));
    const fixedEvents = blockingCalendarEvents(events)
      .filter((event) => dateRange.includes(event.startDate || event.date) && event.startTime && event.endTime)
      .map((event) => ({
        id: event.id,
        title: event.title,
        scheduledDate: event.startDate || event.date,
        scheduledStart: event.startTime,
        scheduledEnd: event.endTime,
      }));
    const externalEvents = expandExternalCalendarOccurrences(visibleSet).tasks
      .map((task) => ({
        id: task.id,
        title: task.title,
        scheduledDate: task.scheduledDate,
        scheduledStart: task.scheduledStart || "00:00",
        scheduledEnd: task.scheduledEnd || "23:59",
      }));
    return [...explicit, ...recurrence, ...fixedEvents, ...externalEvents];
  }

  type CandidatePlacementSnapshot = {
    visibleRange: string[];
    visibleEvents: ReturnType<typeof getScheduledEventsForRange>;
  };

  function findCandidatePlacementForRange(task: Task, dateRange: string[], scheduledEvents = getScheduledEventsForRange(dateRange)) {
    return autoScheduleTasks({
      tasks: [{
        id: task.id,
        title: task.title,
        priority: (task.priority || "medium") as "high" | "medium" | "low",
        estimatedMinutes: taskDuration(task),
        dueDate: task.dueDate,
        projectId: task.projectId,
        completed: task.completed,
      }],
      scheduledEvents,
      dateRange,
      settings: {
        dayStart: settings?.scheduleDayStartTime || "08:00",
        dayEnd: settings?.dayEndTime || "22:00",
        bufferMinutes: settings?.scheduleBufferMinutes ?? 5,
        preferredStartHourByProject: data?.aiProfile?.preferredStartHourByProject || {},
        allowTaskSplitting: false,
      },
    }).proposedEvents[0];
  }

  function placementChoiceFromProposal(taskId: string, proposed: ReturnType<typeof findCandidatePlacementForRange>): PlacementChoice | null {
    if (!proposed) return null;
    return {
      taskId,
      date: proposed.scheduledDate,
      startTime: proposed.scheduledStart,
      endTime: proposed.scheduledEnd,
      durationMinutes: proposed.durationMinutes,
      source: "candidate-calendar",
    };
  }

  function findCandidatePlacementChoices(task: Task, cached?: CandidatePlacementSnapshot) {
    const visibleRange = cached?.visibleRange || getTimelineRangeFor(timelineView, timelineWindowAnchorDate);
    const visibleEvents = cached?.visibleEvents || getScheduledEventsForRange(visibleRange);
    const choices = visibleRange.slice(0, 7).flatMap((date) => {
      const proposed = findCandidatePlacementForRange(task, [date], visibleEvents.filter((event) => event.scheduledDate === date));
      const choice = placementChoiceFromProposal(task.id, proposed);
      return choice ? [choice] : [];
    });
    if (choices.length > 0) return choices;
    return [];
  }

  function cancelPlacementPreview() {
    placementPreviewRef.current = null;
    placementReturnScrollTopRef.current = null;
    setLocatedPlacementTaskId(null);
    setPlacementPreview(null);
    setPlacementChoices([]);
    setPendingTimelineFocus(null);
  }

  async function startMobilePlacement(taskId: string, subtask?: ShelfSubtask, guided = false, recordId?: string) {
    const { mobilePlacementVersion } = await import("./utils/mobilePlacement");
    if ((!mobileExecutionRef.current && !guided) || !dataRef.current || mobilePlacementRef.current) return;
    const task = shelfTask(dataRef.current, taskId, subtask);
    if (!task || task.completed) return;
    const savedBlock = recordId ? onboardingBlock(task, false) : undefined;
    if (recordId ? savedBlock?.id !== recordId : hasActiveTaskSchedule(task)) return;
    const existingRecord = task.timelineRecords?.find((item) => item.id === recordId);
    if (existingRecord && existingRecord.executionStatus !== "scheduled") return;
    const durationMinutes = existingRecord ? timelineRecordDurationMinutes(existingRecord)
      : savedBlock ? clockTimeSpanMinutes(savedBlock.scheduledStart, task.scheduledEnd || addMinutes(savedBlock.scheduledStart, taskDuration(task)))
      : taskDuration(task);
    const date = savedBlock?.scheduledDate ?? timelineWindowAnchorDate;
    const choice: PlacementChoice | null = savedBlock ? {
      taskId: task.id, date, startTime: savedBlock.scheduledStart, endTime: addMinutes(savedBlock.scheduledStart, durationMinutes),
      durationMinutes, source: "candidate-calendar",
    } : placementChoiceFromProposal(task.id, findCandidatePlacementForRange(task, [date]));
    const session = { guided, taskId, subtask, recordId, durationMinutes, version: mobilePlacementVersion(task), view: timelineView, date: selectedDate, visibleDate: visibleTimelineDate,
      scrollTop: timelineRef.current?.scrollTop || 0, drawerOpen: candidateDrawerOpen, noSuggestedSlotDate: choice ? undefined : date };
    if (!shelfView) {
      candidateScrollRef.current = candidatePanelRef.current?.querySelector(".df-candidate-list")?.scrollTop || 0;
    }
    mobileCommitRef.current = false;
    mobilePlacementRef.current = session;
    setMobilePlacement(session);
    setCandidateDrawerOpen(false);
    if (guided) showTimelineWorkspace();
    setMobileDatePickerOpen(false);
    setResizeHintTaskId("");
    setDragCreate(null);
    setSelectedDate(date);
    setVisibleTimelineDate(date);
    setTimelineView("daily");
    setPlacementPreview(choice);
    placementPreviewRef.current = choice;
    setPlacementChoices(choice ? [choice] : []);
    if (choice) requestTimelineFocus({ date: choice.date, startTime: choice.startTime, source: "placement" });
  }

  function cancelMobilePlacement(reopen: boolean) {
    const session = mobilePlacementRef.current;
    if (!session) return;
    mobilePlacementRef.current = null;
    setMobilePlacement(null);
    cancelPlacementPreview();
    setTimelineView(session.view);
    setSelectedDate(session.date);
    setVisibleTimelineDate(session.visibleDate);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (timelineRef.current) timelineRef.current.scrollTop = session.scrollTop;
      if (reopen && session.drawerOpen) setCandidateDrawerOpen(true);
      else candidateTriggerRef.current?.focus();
    }));
  }

  async function confirmMobilePlacement() {
    if (mobileCommitRef.current) return;
    mobileCommitRef.current = true;
    const { mobilePlacementVersion } = await import("./utils/mobilePlacement");
    const session = mobilePlacementRef.current;
    const choice = placementPreviewRef.current;
    const current = dataRef.current;
    if (!session || !choice || !current) { mobileCommitRef.current = false; return; }
    const task = shelfTask(current, session.taskId, session.subtask);
    if (!task || task.completed || mobilePlacementVersion(task) !== session.version) {
      cancelMobilePlacement(true);
      showToast(lang === "zh" ? "任务已变更，请重新安排" : "Task changed. Please schedule it again.");
      return;
    }
    let recordId = session.recordId;
    if (recordId) {
      const block = onboardingBlock(task, false);
      if (block?.id !== recordId) { cancelMobilePlacement(true); return; }
      if (block.scheduledDate !== choice.date || block.scheduledStart !== choice.startTime) {
        moveTimelineRecord(recordId, choice.startTime, choice.date);
      }
    } else {
      recordId = commitShelfSchedule(session.taskId, choice.date, choice.startTime, { subtask: session.subtask })?.id;
      if (!recordId) { cancelMobilePlacement(true); return; }
    }
    mobilePlacementRef.current = null;
    setMobilePlacement(null);
    cancelPlacementPreview();
    requestTimelineFocus({ date: choice.date, startTime: choice.startTime, taskId: recordId, source: "schedule" });
    if (onboardingStage(settingsRef.current) === "plan" && session.guided) {
      void saveSettings({ workspaceGuideStep: "views" });
      revealTasks();
    }
  }

  function selectMobilePlacement(event: React.MouseEvent) {
    const session = mobilePlacementRef.current;
    if (!session) return false;
    if (mobileExecution && mobileTapRef.current.moved) return true;
    const target = resolveDropTarget(event.clientX, event.clientY);
    const task = dataRef.current && shelfTask(dataRef.current, session.taskId, session.subtask);
    if (target && task) {
      const durationMinutes = session.durationMinutes;
      const choice: PlacementChoice = { taskId: task.id, date: target.date, startTime: target.startTime, endTime: addMinutes(target.startTime, durationMinutes), durationMinutes, source: "candidate-calendar" };
      placementPreviewRef.current = choice;
      setPlacementPreview(choice);
      setPlacementChoices([choice]);
    }
    return true;
  }

  function startPlacementPreview(taskId: string) {
    if (mobileExecution) { startMobilePlacement(taskId); return; }
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (placementPreview?.taskId === taskId) {
      cancelPlacementPreview();
      return;
    }
    placementReturnScrollTopRef.current = null;
    setLocatedPlacementTaskId(null);
    const visibleRange = getTimelineRangeFor(timelineView, timelineWindowAnchorDate);
    const placementSnapshot = {
      visibleRange,
      visibleEvents: getScheduledEventsForRange(visibleRange),
    };
    const choices = findCandidatePlacementChoices(task, placementSnapshot);
    const preview = choices[0];
    if (!preview) {
      const noSlotMessage = visibleRange.length === 1
        ? visibleRange[0] === today ? "toast.noSlotToday" : "toast.noSlotOnDate"
        : "toast.noSlotFound";
      showToast(t(lang, noSlotMessage));
      return;
    }
    placementPreviewRef.current = preview;
    setPlacementPreview(preview);
    setPlacementChoices(choices);
    void enrichTaskInBackground(task).then((updatedTask) => {
      if (!updatedTask || taskDuration(updatedTask) === taskDuration(task) || placementPreviewRef.current?.taskId !== taskId) return;
      const calibratedChoices = findCandidatePlacementChoices(updatedTask, placementSnapshot);
      const calibratedPreview = calibratedChoices[0];
      if (!calibratedPreview || placementPreviewRef.current?.taskId !== taskId) return;
      placementPreviewRef.current = calibratedPreview;
      setPlacementPreview(calibratedPreview);
      setPlacementChoices(calibratedChoices);
    });
  }

  function locateCandidatePlacement(taskId: string, schedule: CandidateScheduleSummary) {
    if (!timelineRef.current) return;
    placementReturnScrollTopRef.current = timelineRef.current.scrollTop;
    setLocatedPlacementTaskId(taskId);
    requestTimelineFocus({ date: schedule.date, startTime: schedule.startTime, source: "placement", behavior: "smooth" });
  }

  function returnFromCandidatePlacement(taskId: string) {
    const scrollTop = placementReturnScrollTopRef.current;
    if (scrollTop !== null && timelineRef.current) timelineRef.current.scrollTo({ top: scrollTop, behavior: "smooth" });
    placementReturnScrollTopRef.current = null;
    setLocatedPlacementTaskId(null);
    if (placementPreviewRef.current?.taskId === taskId) cancelPlacementPreview();
  }

  function confirmPlacementPreview(taskId: string) {
    if (!placementPreview || placementPreview.taskId !== taskId) return;
    confirmPlacementChoice(placementPreview);
  }

  function confirmPlacementChoice(choice: PlacementChoice) {
    preserveTimelineViewportOnNextDataChange();
    applyCandidateTimeSettings(choice.taskId, {
      date: choice.date,
      startTime: choice.startTime,
      durationMinutes: choice.durationMinutes,
      allDay: false,
    }, { focusTimeline: false });
    placementPreviewRef.current = null;
    placementReturnScrollTopRef.current = null;
    setLocatedPlacementTaskId(null);
    setPlacementPreview(null);
    setPlacementChoices([]);
  }

  function scheduleCandidateOnDate(taskId: string, date: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const proposed = findCandidatePlacementForRange(task, [date]);
    const choice = placementChoiceFromProposal(taskId, proposed);
    if (!choice) {
      showToast(t(lang, date === today ? "toast.noSlotToday" : "toast.noSlotOnDate"));
      return;
    }
    confirmPlacementChoice(choice);
  }

  function saveTaskRecurrence(taskId: string, recurrence?: TaskRecurrence) {
    updateTask(taskId, {
      recurrence,
      ...(recurrence?.mode === "scheduled"
        ? { plannedForDate: recurrence.startDate || today, executionLane: undefined }
        : {}),
    });
    if (recurrence?.mode === "scheduled" && recurrence.startDate && recurrence.startTime) {
      requestTimelineFocus({
        date: recurrence.startDate,
        startTime: recurrence.startTime,
        taskId,
        source: "recurrence",
      });
    }
  }

  function createScheduledRecord(task: Task, scheduledDate: string, scheduledStart: string, durationMinutes: number, { preserveTime = false } = {}): TimelineRecord {
    const now = workspaceNow().toISOString();
    const startTime = preserveTime ? scheduledStart : normalizeTaskStartTime(scheduledStart);
    const duration = preserveTime ? durationMinutes : normalizeTaskDuration(durationMinutes);
    return {
      id: uid(`${task.id}_rec`),
      taskId: task.id,
      scheduledDate,
      scheduledStart: startTime,
      ...calculateTimelineRecordEnd(scheduledDate, startTime, duration),
      executionStatus: "scheduled",
      createdAt: now,
    };
  }

  function commitDragCreatedTask(state: NonNullable<DragCreateState>, title: string, projectId: string | null, subtasks: Subtask[] = [], openDetails = false) {
    const current = dataRef.current;
    if (!current) return;
    const { date, startMinutes, endMinutes } = state;
    const startTime = minutesToTime(startMinutes);
    const durationMinutes = endMinutes - startMinutes;
    const task = makeSmartTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: addDays(date, 1), estimatedHours: durationMinutes / 60 });
    const scheduledRecord = createScheduledRecord(task, date, startTime, durationMinutes);
    void saveTaskOperation({ ...current, tasks: [...current.tasks, { ...task, subtasks, plannedForDate: date, executionLane: undefined, timelineRecords: [scheduledRecord] }] }, "create");
    requestTimelineFocus({ date, startTime, taskId: scheduledRecord.id, source: "schedule" });
    revealResizeHandles(scheduledRecord.id);
    setDragCreate(null);
    if (openDetails) {
      rememberLayerTrigger("drawer");
      setAddType("task");
      setEditingId(task.id);
      setEditingRecordId(scheduledRecord.id);
      setEditingOccurrence(null);
      setMobileTaskSummary(false);
      setForm({
        ...defaultForm("task"),
        title: task.title,
        projectId: task.projectId || "",
        dueDate: addDays(date, 1),
        dueTime: startTime,
        endDate: date,
        endTime: scheduledRecord.scheduledEnd,
        category: task.category,
        priority: task.priority,
        importance: task.importance ?? null,
        urgency: task.urgency ?? null,
        estimatedHours: durationMinutes / 60,
      });
      setDrawerOpen(true);
    }
    showToast(t(lang, "timeline.addedToTimeline"));
  }

  function updateDragCreateRange(edge: "start" | "end", minutes: number) {
    setDragCreate((current) => {
      if (!current) return current;
      const snapped = Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
      let startMinutes = current.startMinutes;
      let endMinutes = current.endMinutes;
      if (edge === "start") startMinutes = Math.min(Math.max(snapped, TIMELINE_START * 60), endMinutes - SLOT_MINUTES);
      else endMinutes = Math.max(Math.min(snapped, TIMELINE_END * 60), startMinutes + SLOT_MINUTES);
      return {
        ...current,
        startMinutes,
        endMinutes,
        top: current.top + ((startMinutes - current.startMinutes) / SLOT_MINUTES) * timelineSlotHeight,
        height: ((endMinutes - startMinutes) / SLOT_MINUTES) * timelineSlotHeight,
      };
    });
  }

  function beginDragCreateResize(event: React.PointerEvent, edge: "start" | "end") {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const initial = dragCreate;
    if (!initial) return;
    const captureTarget = event.currentTarget;
    try { captureTarget.setPointerCapture(event.pointerId); } catch { /* Pointer may already be captured. */ }
    dragCreateSuppressClickRef.current = true;
    const nativeEvent = event.nativeEvent;
    void import("./MobileTaskSummary").then(({ beginVerticalResize }) => beginVerticalResize(
      nativeEvent,
      timelineSlotHeight,
      (steps) => updateDragCreateRange(edge, (edge === "start" ? initial.startMinutes : initial.endMinutes) + steps * SLOT_MINUTES),
      () => window.setTimeout(() => { dragCreateSuppressClickRef.current = false; }, 80),
      captureTarget,
    ));
  }

  function createOccurrenceExceptionRecord(task: Task, scheduledDate: string, scheduledStart: string, executionStatus: TimelineRecord["executionStatus"]) {
    const end = calculateTimelineRecordEnd(
      scheduledDate,
      scheduledStart,
      task.recurrence?.durationMinutes || taskDuration(task),
    );
    return {
      id: `${task.id}_occ_${executionStatus}_${Date.now().toString(36)}`,
      taskId: task.id,
      scheduledDate,
      scheduledStart,
      ...end,
      executionStatus,
      createdAt: workspaceNow().toISOString(),
    } as TimelineRecord;
  }

  function cancelRecurringOccurrence(taskId: string, occurrence: EditingOccurrence) {
    if (!data || !occurrence) return;
    const now = workspaceNow().toISOString();
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const records = task.timelineRecords || [];
        const hasExisting = records.some((record) => matchesOccurrence(record, occurrence.scheduledDate, occurrence.scheduledStart));
        return {
          ...task,
          timelineRecords: hasExisting
            ? records.map((record) =>
                matchesOccurrence(record, occurrence.scheduledDate, occurrence.scheduledStart)
                  ? { ...record, executionStatus: "cancelled" as const }
                  : record
              )
            : [...records, createOccurrenceExceptionRecord(task, occurrence.scheduledDate, occurrence.scheduledStart, "cancelled")],
          updatedAt: now,
        };
      }),
    });
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    showToast(t(lang, "toast.cancelledPlan"));
  }

  function editTaskSchedule(taskId: string, source: TaskScheduleRange, next: TaskScheduleRange, duration: number, recordId?: string, occurrence?: EditingOccurrence) {
    const current = dataRef.current;
    const task = current?.tasks.find((item) => item.id === taskId);
    if (!current || !task) return lang === "zh" ? "找不到此任务。" : "This task is no longer available.";
    const records = task.timelineRecords || [];
    const record = records.find((item) => item.id === recordId);
    const previousDate = record?.scheduledDate || occurrence?.scheduledDate || task.scheduledDate;
    const previousStart = record?.scheduledStart || occurrence?.scheduledStart || task.scheduledStart;
    if ((recordId && !record) || previousDate !== source.date || previousStart !== source.start
      || (record && (record.scheduledEnd !== source.end || normalizeTimelineRecord(record).scheduledEndDate !== source.endDate))
      || (occurrence && (!hasRecurrenceOccurrenceOnDate(task, occurrence.scheduledDate) || records.some((item) => item.scheduledDate === occurrence.scheduledDate)))) {
      return lang === "zh" ? "日程已更新，请关闭弹窗后重试。" : "This schedule changed. Close the editor and try again.";
    }
    if (next.date !== source.date && hasRecurrenceOccurrenceOnDate(task, next.date)
      && !records.some((item) => item.scheduledDate === next.date)) {
      return lang === "zh" ? "这天已有此任务的重复日程，请选另一天。" : "This task already repeats on that date. Choose another date.";
    }
    const moved = record
      ? rescheduleTimelineRecord(record, next.date, next.start, duration)
      : createScheduledRecord(task, next.date, next.start, duration, { preserveTime: true });
    const nextRecords = record ? records.map((item) => item.id === record.id ? moved : item) : [...records, moved];
    if (next.date !== source.date && hasRecurrenceOccurrenceOnDate(task, source.date)
      && !nextRecords.some((item) => item.scheduledDate === source.date)) {
      nextRecords.push(createOccurrenceExceptionRecord(task, source.date, task.recurrence!.startTime!, "cancelled"));
    }
    const legacy = !record && !occurrence;
    if (legacy) moved.executionStatus = task.executionStatus || (task.completed ? "completed" : "scheduled");
    const updated: Task = {
      ...task,
      ...(legacy ? { scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, executionStatus: undefined } : {}),
      timelineRecords: nextRecords,
      updatedAt: workspaceNow().toISOString(),
    };
    void saveTaskOperation({ ...current, tasks: current.tasks.map((item) => item.id === taskId ? updated : item) }, "reschedule");
    setEditingRecordId(moved.id);
    setEditingOccurrence(null);
    return undefined;
  }

  function replanRecurringOccurrence(taskId: string, occurrence: EditingOccurrence) {
    if (!data || !occurrence) return;
    const sourceTask = data.tasks.find((task) => task.id === taskId);
    if (!sourceTask) return;
    const now = workspaceNow().toISOString();
    const candidateTask: Task = {
      ...sourceTask,
      id: uid("task"),
      recurrence: undefined,
      completed: false,
      plannedForDate: today,
      executionLane: "candidate",
      dueDate: occurrence.scheduledDate,
      scheduledDate: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined,
      executionStatus: undefined,
      timelineRecords: [],
      parentTaskId: sourceTask.id,
      createdAt: now,
      updatedAt: now,
    };
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const records = task.timelineRecords || [];
        const hasExisting = records.some((record) => matchesOccurrence(record, occurrence.scheduledDate, occurrence.scheduledStart));
        return {
          ...task,
          timelineRecords: hasExisting
            ? records.map((record) =>
                matchesOccurrence(record, occurrence.scheduledDate, occurrence.scheduledStart)
                  ? { ...record, executionStatus: "cancelled" as const }
                  : record
              )
            : [...records, createOccurrenceExceptionRecord(task, occurrence.scheduledDate, occurrence.scheduledStart, "cancelled")],
          updatedAt: now,
        };
      }).concat(candidateTask),
    });
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    showToast(t(lang, "toast.oneTimeCandidateCreated"));
  }

  function cancelAllRecurringFuture(taskId: string, cutoffDate: string) {
    if (!data) return;
    const now = workspaceNow().toISOString();
    void saveData({
      ...data,
      tasks: data.tasks.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          recurrence: undefined,
          scheduledDate: task.scheduledDate && task.scheduledDate >= cutoffDate ? undefined : task.scheduledDate,
          scheduledStart: task.scheduledDate && task.scheduledDate >= cutoffDate ? undefined : task.scheduledStart,
          scheduledEnd: task.scheduledDate && task.scheduledDate >= cutoffDate ? undefined : task.scheduledEnd,
          timelineRecords: (task.timelineRecords || []).filter((record) =>
            record.executionStatus === "completed" || record.scheduledDate < cutoffDate
          ),
          updatedAt: now,
        };
      }),
    });
    showToast(t(lang, "toast.futureRecurringCleared"));
  }

  function applyCandidateTimeSettings(taskId: string, settings: CandidateTimeSettings, options: { focusTimeline?: boolean } = {}) {
    const task = data?.tasks.find((item) => item.id === taskId);
    if (!task || !data) return;
    const now = workspaceNow().toISOString();
    const filteredRecords = (task.timelineRecords || []).filter((record) => record.executionStatus !== "scheduled");
    const updatedTask: Task = settings.clearSchedule || settings.allDay
      ? {
          ...task,
          dueDate: task.dueDate || addDays(settings.date, 1),
          dueDateSource: task.dueDate ? task.dueDateSource : "automatic",
          plannedForDate: settings.date,
          executionLane: settings.clearSchedule ? "candidate" : undefined,
          scheduledDate: settings.allDay ? settings.date : undefined,
          scheduledStart: undefined,
          scheduledEnd: undefined,
          executionStatus: undefined,
          timelineRecords: filteredRecords,
          updatedAt: now,
        }
      : {
          ...task,
          dueDate: task.dueDate || addDays(settings.date, 1),
          dueDateSource: task.dueDate ? task.dueDateSource : "automatic",
          plannedForDate: settings.date,
          executionLane: undefined,
          scheduledDate: undefined,
          scheduledStart: undefined,
          scheduledEnd: undefined,
          executionStatus: undefined,
          timelineRecords: [
            ...(mobileExecution ? task.timelineRecords || [] : filteredRecords),
            createScheduledRecord(task, settings.date, settings.startTime, settings.durationMinutes),
          ],
          updatedAt: now,
        };
    void saveTaskOperation({
      ...data,
      tasks: data.tasks.map((item) => item.id === taskId ? updatedTask : item),
    }, settings.clearSchedule ? "unschedule" : "schedule");
    if (!settings.clearSchedule && !settings.allDay && options.focusTimeline !== false) {
      requestTimelineFocus({
        date: settings.date,
        startTime: settings.startTime,
        taskId,
        source: "schedule",
      });
    }
    showToast(settings.clearSchedule ? t(lang, "toast.clearedSchedule") : settings.allDay ? t(lang, "toast.setToAllDay") : t(lang, "drawer.scheduledOnTimeline"));
  }

  function scheduleTask(taskId: string, startTime: string, moveLegacyAllDay = false) {
    preserveTimelineViewportOnNextDataChange();
    const targetDate = dragTargetDateRef.current || timelineDate;
    if (taskId.startsWith("habit:")) {
      scheduleHabitAt(taskId.slice("habit:".length), targetDate, startTime, false);
      setHoverSlot("");
      setDrag(null);
      dragTargetDateRef.current = "";
      return;
    }
    if (isEventDisplayTask(taskId)) {
      setHoverSlot("");
      setDrag(null);
      dragTargetDateRef.current = "";
      return;
    }
    const allDayRecord = recordByIdMap.get(taskId);
    const allDayOwner = recordToTaskMap.get(taskId);
    if (allDayRecord && allDayOwner && !allDayRecord.scheduledStart && !allDayRecord.scheduledEnd) {
      moveTimelineRecord(taskId, startTime, targetDate, taskDuration(allDayOwner));
      setHoverSlot("");
      setDrag(null);
      dragTargetDateRef.current = "";
      return;
    }
    if (!commitShelfSchedule(taskId, targetDate, startTime, { moveLegacyAllDay })) return;
    setHoverSlot("");
    setDrag(null);
    dragTargetDateRef.current = "";
  }

  function toggleHabitDaily(habitId: string, completed: boolean) {
    const current = dataRef.current;
    if (!current || !habitsEnabled) return;
    void saveData(toggleHabitCompletion(current, habitId, today, completed));
  }

  function toggleHabitForDate(habitId: string, date: string, completed: boolean) {
    const current = dataRef.current;
    if (!current || !habitsEnabled) return;
    void saveData(toggleHabitCompletion(current, habitId, date, completed));
  }

  function scheduleHabitAt(habitId: string, date: string, startTime: string, focusTimeline = true) {
    const current = dataRef.current;
    if (!current || !habitsEnabled) return;
    if (!focusTimeline) preserveTimelineViewportOnNextDataChange();
    const result = scheduleHabitRecord(current, habitId, date, startTime);
    void saveData(result.data);
    if (focusTimeline) requestTimelineFocus({ date, startTime, taskId: result.recordId, source: "schedule" });
    showToast(lang === "zh" ? "习惯已安排" : "Habit scheduled");
  }

  function focusHabitSchedule(recordId: string) {
    const current = dataRef.current;
    if (!current) return;
    const owner = current.tasks.find((item) => (item.timelineRecords || []).some((record) => record.id === recordId));
    const record = owner?.timelineRecords?.find((item) => item.id === recordId);
    if (!owner || !record) return;
    setSelectedDate(record.scheduledDate);
    setTimelineView("daily");
    requestTimelineFocus({ date: record.scheduledDate, startTime: record.scheduledStart, taskId: record.id, source: "schedule" });
  }

  function openHabitDetail(habitId: string) {
    if (!settings || !habitsEnabled) return;
    setNewHabitDraft(null);
    setEditingHabitId(habitId);
    setHabitPanel("detail");
  }

  function openHabitOverview() {
    if (!settings || !habitsEnabled) return;
    setNewHabitDraft(null);
    setEditingHabitId(null);
    setHabitPanel("overview");
  }

  function createHabit() {
    if (!data || !habitsEnabled) return;
    const now = workspaceNow().toISOString();
    const habit: Habit = {
      id: uid("habit"),
      title: "",
      defaultDurationMinutes: 15,
      startDate: today,
      frequencyRule: "daily",
      activeWeekdays: [1, 2, 3, 4, 5],
      order: Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    setNewHabitDraft(habit);
    setEditingHabitId(habit.id);
    setHabitPanel("detail");
  }

  function saveHabitEdit(habitId: string, patch: Partial<Habit>) {
    const current = dataRef.current;
    if (!current || !habitsEnabled) return;
    const source = newHabitDraft?.id === habitId && !current.habits?.some((habit) => habit.id === habitId)
      ? { ...current, habits: [...(current.habits || []), newHabitDraft] }
      : current;
    const next = updateHabit(source, habitId, patch);
    void saveData(next);
  }

  function toggleHabitArchive(habitId: string, archived: boolean) {
    if (!data) return;
    const next = archiveHabit(data, habitId, archived);
    void saveData(next);
    showToast(archived ? (lang === "zh" ? "习惯已归档" : "Habit archived") : (lang === "zh" ? "习惯已恢复" : "Habit restored"));
  }

  function deleteHabitPermanently(habitId: string) {
    if (!data) return;
    setNewHabitDraft(null);
    void saveData({
      ...data,
      habits: (data.habits || []).filter((habit) => habit.id !== habitId),
      habitDailyStates: (data.habitDailyStates || []).filter((state) => state.habitId !== habitId),
    });
    setEditingHabitId(null);
    setHabitPanel("overview");
  }

  function unscheduleHabit(habitId: string, date: string) {
    if (!data) return;
    const next = unscheduleHabitRecord(data, habitId, date);
    void saveData(next);
    showToast(lang === "zh" ? "习惯已移回候选区" : "Habit moved back to candidates");
    setDrag(null);
    setHoverSlot("");
  }

  function habitScheduleFromTimelineTask(taskId: string) {
    const current = dataRef.current;
    return current ? habitScheduleForTask(current, resolveTimelineRecordId(taskId)) : null;
  }

  function shelfTimelineDropTarget(point: { x: number; y: number }) {
    const element = document.elementFromPoint(point.x, point.y);
    const monthDate = element?.closest<HTMLElement>(".df-month-cell[data-date]")?.dataset.date;
    const allDayDate = element?.closest<HTMLElement>("[data-all-day-date]")?.dataset.allDayDate;
    if (monthDate || allDayDate) return { date: (monthDate || allDayDate)!, startTime: "" };
    if (!element || !timelineRef.current?.contains(element)) return;
    return resolveDropTarget(point.x, point.y);
  }

  function previewShelfTimelineDrop(owner: Task, point: { x: number; y: number } | null, subtaskId?: string) {
    const snapshot = dataRef.current;
    const task = point && snapshot ? shelfTask(snapshot, owner.id,
      subtaskId ? { id: subtaskId, draftTaskId: `shelf-preview:${subtaskId}` } : undefined) : undefined;
    const hit = point && task ? shelfTimelineDropTarget(point) : undefined;
    const target = hit && task && canScheduleShelfTask(task, hit.date) ? hit : undefined;
    setHoverSlot(target?.startTime || "");
    dragTargetDateRef.current = target?.date || "";
    setMonthDropDate(timelineView === "month" ? target?.date || "" : "");
    setAllDayDragDate(timelineView !== "month" && target && !target.startTime ? target.date : "");
    setDrag(target && task ? { taskId: task.id, shelfTask: task, kind: "candidate", source: "candidate", duration: taskDuration(task) } : null);
  }

  function commitShelfTimelineDrop(task: Task, point: { x: number; y: number }, subtaskId?: string) {
    const target = shelfTimelineDropTarget(point);
    if (!target) return false;
    const subtask = subtaskId ? { id: subtaskId, draftTaskId: uid("task") } : undefined;
    return Boolean(commitShelfSchedule(task.id, target.date, target.startTime, { subtask }));
  }

  function returnTimelineTaskToCandidates(taskId: string, date = today) {
    const habitSchedule = habitScheduleFromTimelineTask(taskId);
    if (habitSchedule) {
      unscheduleHabit(habitSchedule.habitId, habitSchedule.date);
      return;
    }
    const current = dataRef.current;
    if (!current) return;
    let next = returnScheduledTaskToToday(current, resolveTimelineRecordId(taskId), date).data;
    const recurringOwner = next === current ? occurrenceToTaskMap.get(taskId) : undefined;
    const occurrence = recurringOwner && scheduledTasks.find((task) => task.id === taskId);
    if (recurringOwner && occurrence?.scheduledDate && occurrence.scheduledStart) {
      const exception = createOccurrenceExceptionRecord(recurringOwner, occurrence.scheduledDate, occurrence.scheduledStart, "cancelled");
      next = { ...current, tasks: current.tasks.map((task) => task.id === recurringOwner.id
        ? { ...task, timelineRecords: [...(task.timelineRecords || []), exception], updatedAt: exception.createdAt }
        : task) };
    }
    if (next === current) return;
    preserveTimelineViewportOnNextDataChange();
    const guide = settingsRef.current;
    const guideTask = guide?.workspaceGuideStep === "return" && onboardingTarget(guide, current.tasks);
    void saveTaskOperation(next, "unschedule", { toast: lang === "zh" ? "已取消这个时间块" : "Time block removed" });
    if (guideTask && onboardingBlock(guideTask, false)?.id === resolveTimelineRecordId(taskId)) {
      void saveSettings({ workspaceGuideStep: "plan" });
      revealTasks();
    }
    setDrag(null);
    setHoverSlot("");
  }

  function beginHabitDrag(event: React.PointerEvent, habit: Habit) {
    if (!settings || !habitsEnabled) return;
    beginShelfDrag(event, habitDragTask(habit, timelineDate), "candidate", {
      allowCandidateReorder: false,
      onSchedule: (date, startTime) => scheduleHabitAt(habit.id, date, startTime, false),
    });
  }

  function unscheduleTask(taskId: string) {
    if (!data) return;
    preserveTimelineViewportOnNextDataChange();
    void saveTaskOperation({
      ...data,
      tasks: data.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              plannedForDate: today,
              executionLane: "candidate",
              scheduledDate: undefined,
              scheduledStart: undefined,
              scheduledEnd: undefined,
              executionStatus: undefined,
              timelineRecords: (t.timelineRecords || []).filter((r) => r.executionStatus === "completed"),
              updatedAt: workspaceNow().toISOString(),
            }
          : t
      ),
    }, "unschedule");
    showToast(t(lang, "toast.movedBackToCandidates"));
    setDrag(null);
    setHoverSlot("");
  }

  function markCandidateUnfinished(taskId: string) {
    const current = dataRef.current;
    if (!current) return;
    preserveTimelineViewportOnNextDataChange();
    const now = workspaceNow().toISOString();
    void saveData({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? {
        ...task,
        completed: false,
        plannedForDate: today,
        executionLane: "candidate",
        executionStatus: "returned_unfinished",
        timelineRecords: (task.timelineRecords || []).map((record) => record.executionStatus === "scheduled"
          ? { ...record, executionStatus: "returned_unfinished" as const }
          : record),
        updatedAt: now,
      } : task),
    });
    showToast(lang === "zh" ? "已保留为未完成任务" : "Kept as incomplete");
  }

  function returnToPlanning(taskId: string) {
    updateTask(taskId, {
      plannedForDate: undefined,
      executionLane: undefined,
      scheduledDate: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined
    });
    showToast(t(lang, "toast.putBackToPlanning"));
  }

  function getDropGridAndDays(): { gridEl: HTMLElement | null; scrollEl: HTMLElement | null; visDays: string[] } {
    const visDays = timelineView === "daily"
      ? dailyTimelineDates
      : getVisibleDays(timelineView === "weekly" ? "weekly" : timelineView === "3day" ? "3day" : "daily", timelineDate);
    if (timelineView === "3day" || timelineView === "weekly") {
      const gridEl = timeGridRef.current || document.querySelector('.df-time-grid');
      const scrollEl = timelineRef.current;
      return { gridEl: gridEl as HTMLElement | null, scrollEl, visDays };
    }
    return { gridEl: timelineCanvasRef.current, scrollEl: timelineRef.current, visDays };
  }

  /** Move a TimelineRecord to a new start time, preserving duration. */
  function moveTimelineRecord(recordId: string, newStart: string, newDate?: string, durationMinutes?: number) {
    const current = dataRef.current;
    if (!current) return;
    const sourceRecordId = resolveTimelineRecordId(recordId);
    const now = workspaceNow().toISOString();
    void saveTaskOperation({
      ...current,
      tasks: current.tasks.map((task) => {
        const records = task.timelineRecords;
        if ((!records || records.length === 0) && task.id === sourceRecordId && task.scheduledStart) {
          // Cross-midnight spans (e.g. 23:30→00:30) must keep their 60m duration
          // instead of collapsing to a negative / wrap-broken value.
          const duration = clockTimeSpanMinutes(task.scheduledStart, task.scheduledEnd || addMinutes(task.scheduledStart, taskDuration(task)));
          return {
            ...task,
            scheduledDate: newDate || task.scheduledDate,
            scheduledStart: newStart,
            scheduledEnd: addMinutes(newStart, duration),
            updatedAt: now,
          };
        }
        if (!records) return task;
        const idx = records.findIndex((r) => r.id === sourceRecordId);
        if (idx === -1) return task;
        const updated = [...records];
        updated[idx] = rescheduleTimelineRecord(
          updated[idx],
          newDate || updated[idx].scheduledDate,
          newStart,
          durationMinutes,
        );
        return { ...task, timelineRecords: updated, updatedAt: now };
      }),
    }, "reschedule");
  }

  function beginBlockDrag(event: React.PointerEvent, task: Task) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;
    if (isExternalCalendarDisplayTask(task)) {
      showToast(lang === "zh" ? "外部日历事项为只读" : "External calendar events are read-only");
      return;
    }
    if (isEventDisplayTask(task)) return;
    const target = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const owningRecord = recordByIdMap.get(task.id);
    const duration = owningRecord ? timelineRecordDurationMinutes(owningRecord) : taskDuration(task);
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetPx = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    const offsetMinutes = Math.max(Math.round((offsetPx / timelineSlotHeight) * SLOT_MINUTES), 0);
    let active = false;
    let holdCancelled = false;
    let holdReady = !compactLayout || event.pointerType !== "touch";
    let latestPointer = event.nativeEvent;
    let autoScrollFrame = 0;
    const holdTimer = holdReady ? undefined : window.setTimeout(() => {
      holdReady = true;
      revealResizeHandles(resolveTimelineRecordId(task.id));
      target.dataset.touchDragArmed = "true";
      window.navigator.vibrate?.(8);
    }, 320);
    // Keep native scrolling until the hold is armed. Changing touch-action
    // mid-gesture cannot prevent the browser from cancelling pointer events.
    const holdTouch = (touchEvent: TouchEvent) => {
      if (holdReady && !holdCancelled && touchEvent.touches.length === 1) touchEvent.preventDefault();
    };
    target.addEventListener("touchmove", holdTouch, { passive: false });
    const clearHold = () => {
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      window.cancelAnimationFrame(autoScrollFrame);
      setAllDayDragOver(false);
      setAllDayDragDate("");
      delete target.dataset.touchDragArmed;
      target.removeEventListener("touchmove", holdTouch);
    };
    const jumpDate = (tap: PointerEvent) => {
      if (!active || tap.pointerId === pointerId) return;
      const control = document.elementFromPoint(tap.clientX, tap.clientY)?.closest<HTMLElement>("[data-date],.df-compact-date-picker-trigger");
      const date = control?.dataset.date;
      if (date) {
        setSelectedDate(date);
        dragTargetDateRef.current = date;
        window.navigator.vibrate?.(6);
      } else if (control?.classList.contains("df-compact-date-picker-trigger")) setMobileDatePickerOpen(true);
    };
    suppressBlockClickRef.current = false;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      latestPointer = moveEvent;
      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!holdReady) {
        if (distance >= 8) {
          holdCancelled = true;
          clearHold();
        }
        return;
      }
      if (holdCancelled) return;
      if (!active && distance < 5) return;
      if (!active) {
        moveEvent.preventDefault();
        active = true;
        autoScrollFrame = window.requestAnimationFrame(scrollAtEdge);
        if (holdTimer !== undefined) window.clearTimeout(holdTimer);
        delete target.dataset.touchDragArmed;
        target.classList.add("is-dragging");
        target.classList.add("is-dragging-source");
        document.body.classList.add("df-timeline-pointer-drag");
        suppressBlockClickRef.current = true;
        setDragCreate(null);
        const blockRect = rect;
        const offX = Math.min(Math.max(event.clientX - blockRect.left, 0), blockRect.width);
        const offY = Math.min(Math.max(event.clientY - blockRect.top, 0), blockRect.height);
        setDrag({
          taskId: task.id,
          kind: "block",
          source: "timeline",
          duration,
          offsetMinutes,
          pointer: { x: moveEvent.clientX, y: moveEvent.clientY },
          sourceRect: { width: blockRect.width, height: blockRect.height },
          offset: { x: offX, y: offY },
          outsideTimeline: pointerOutsideTimeline(moveEvent.clientX, moveEvent.clientY),
        });
      }
      setDragOverlayPointer({ x: moveEvent.clientX, y: moveEvent.clientY });
      const outsideTimeline = pointerOutsideTimeline(moveEvent.clientX, moveEvent.clientY);
      setDrag((current) => current && current.taskId === task.id ? { ...current, pointer: { x: moveEvent.clientX, y: moveEvent.clientY }, outsideTimeline } : current);
      const allDayCell = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest<HTMLElement>("[data-all-day-date]");
      const allDayDate = allDayCell?.dataset.allDayDate || "";
      setAllDayDragOver(Boolean(allDayDate));
      setAllDayDragDate(allDayDate);
      if (allDayDate) {
        setHoverSlot("");
        dragTargetDateRef.current = allDayDate;
        return;
      }
      if (!outsideTimeline) {
        // Continuous cross-day mode MUST derive the date from the Y band index
        // (continuousPointerTarget), not from currentDate/X column. The offset
        // is subtracted in absolute time so dragging across midnight keeps the
        // grabbed point under the cursor instead of snapping back to day 0.
        const pointerTarget = resolveDropTarget(moveEvent.clientX, moveEvent.clientY);
        if (pointerTarget) {
          const adjusted = subtractOffsetFromDateTime(pointerTarget.date, pointerTarget.startTime, offsetMinutes);
          dragTargetDateRef.current = adjusted.date;
          setHoverSlot(adjusted.startTime);
        }
      } else {
        setHoverSlot("");
        dragTargetDateRef.current = "";
      }
    };
    // Keep scrolling while the held pointer stays near an edge, even when
    // no new pointermove arrives. Recompute the preview against the moved grid.
    const scrollAtEdge = () => {
      if (autoScrollAtDragEdge(latestPointer.clientX, latestPointer.clientY, [timelineRef.current])) {
        move(latestPointer);
      }
      autoScrollFrame = window.requestAnimationFrame(scrollAtEdge);
    };
    const up = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      if (active) {
        preserveTimelineViewportOnNextDataChange();
        // Check if dropped on all-day bar first
        const alldayEl = document.querySelector<HTMLElement>(".df-timeline-allday, .df-timeline-3day-allday");
        if (alldayEl) {
          const alldayRect = alldayEl.getBoundingClientRect();
          const pad = 6;
          if (upEvent.clientX >= alldayRect.left - pad && upEvent.clientX <= alldayRect.right + pad && upEvent.clientY >= alldayRect.top - pad && upEvent.clientY <= alldayRect.bottom + pad) {
            let targetDate = alldayEl.dataset.allDayDate || timelineDate;
            if (timelineView === "3day" || timelineView === "weekly") {
              const threeDates = getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineDate);
              const datesEl = alldayEl.querySelector(".df-timeline-3day-dates");
              if (datesEl) {
                const datesRect = datesEl.getBoundingClientRect();
                const x = upEvent.clientX - datesRect.left;
                const colW = datesRect.width / threeDates.length;
                const di = Math.min(Math.max(Math.floor(x / colW), 0), threeDates.length - 1);
                targetDate = threeDates[di];
              }
            }
            const allDayCell = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest<HTMLElement>("[data-all-day-date]");
            targetDate = allDayCell?.dataset.allDayDate || targetDate;
            makeAllDay(task.id, targetDate);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", cancel);
            window.removeEventListener("keydown", keydown);
            window.removeEventListener("pointerdown", jumpDate);
            setDrag(null);
            setDragOverlay(null);
            setHoverSlot("");
            dragTargetDateRef.current = "";
            clearHold();
            target.classList.remove("is-dragging");
            target.classList.remove("is-dragging-source");
            document.body.classList.remove("df-timeline-pointer-drag");
            suppressClickAfterDrag();
            return;
          }
        }
        const dropElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const droppedOnCandidatePanel = Boolean(dropElement?.closest(".df-candidate-panel, .df-mobile-candidates-trigger"));
        const droppedOutsideTimeline = pointerOutsideTimeline(upEvent.clientX, upEvent.clientY);
        if (droppedOnCandidatePanel) {
          returnTimelineTaskToCandidates(task.id, today);
        } else if (droppedOutsideTimeline) {
          // Outside either drop target, retain the existing time block.
        } else {
          // Same continuous-aware resolution as the move handler: date comes
          // from Y band in cross-day mode, offset subtracted in absolute time.
          const pointerTarget = resolveDropTarget(upEvent.clientX, upEvent.clientY);
          if (pointerTarget) {
            const adjusted = subtractOffsetFromDateTime(pointerTarget.date, pointerTarget.startTime, offsetMinutes);
            dragTargetDateRef.current = adjusted.date;
            moveTimelineRecord(task.id, adjusted.startTime, adjusted.date);
          } else {
            const nextStart = slotFromPointer(upEvent.clientY, offsetMinutes, upEvent.clientX);
            moveTimelineRecord(task.id, nextStart);
          }
        }
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("pointerdown", jumpDate);
      setDrag(null);
      setDragOverlay(null);
      setDragOverlayTask(null);
      setHoverSlot("");
      dragTargetDateRef.current = "";
      clearHold();
      target.classList.remove("is-dragging");
      target.classList.remove("is-dragging-source");
      document.body.classList.remove("df-timeline-pointer-drag");
      if (active || (holdTimer !== undefined && holdReady && !holdCancelled)) suppressClickAfterDrag();
    };
    const cancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("pointerdown", jumpDate);
      target.classList.remove("is-dragging");
      target.classList.remove("is-dragging-source");
      document.body.classList.remove("df-timeline-pointer-drag");
      setDrag(null);
      setDragOverlay(null);
      setDragOverlayTask(null);
      setHoverSlot("");
      dragTargetDateRef.current = "";
      clearHold();
      suppressBlockClickRef.current = false;
    };
    const keydown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") cancel(new PointerEvent("pointercancel", { pointerId }));
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
    window.addEventListener("pointerdown", jumpDate);
  }

  function beginBlockResize(event: React.PointerEvent, task: Task, edge: "start" | "end") {
    if (isExternalCalendarDisplayTask(task)) {
      showToast(lang === "zh" ? "外部日历事项为只读" : "External calendar events are read-only");
      return;
    }
    if (isEventDisplayTask(task) || (resizeHintTaskId !== resolveTimelineRecordId(task.id) && hoveredBlock !== task.id)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const pointerId = event.pointerId;
    suppressBlockClickRef.current = true;
    setDragCreate(null);
    document.body.classList.add("df-resizing");
    const owningRecord = recordByIdMap.get(task.id);
    const taskAnchorDate = owningRecord?.scheduledDate || task.scheduledDate || timelineWindowAnchorDate;
    const origStart = owningRecord?.scheduledStart || task.scheduledStart || "09:00";
    const origDuration = owningRecord ? Math.max(timelineRecordDurationMinutes(owningRecord), SLOT_MINUTES) : taskDuration(task);
    const initialEnd = calculateTimelineRecordEnd(taskAnchorDate, origStart, origDuration);
    setResizePreview({
      taskId: task.id,
      start: origStart,
      end: initialEnd.scheduledEnd,
      startDate: taskAnchorDate,
    });

    // Resize works in continuous absolute minutes (relative to
    // `continuousTimelineStartDate`) so that dragging the bottom handle past
    // midnight yields a 60m duration instead of clamping to the end of day.
    // The same math also works in non-continuous mode because the absolute
    // coordinate reduces to within-day minutes when the anchor == visible date.
    const startAbs = dateTimeToContinuousAbs(taskAnchorDate, origStart);
    const endAbs = startAbs + origDuration;

    const computeResize = (clientX: number, clientY: number): { nextStart: string; nextEnd: string; nextDuration: number; nextStartDate: string } => {
      const pointerTarget = resolveDropTarget(clientX, clientY);
      const fallbackSlot = slotFromPointer(clientY, 0, clientX);
      const pointerAbs = pointerTarget
        ? dateTimeToContinuousAbs(pointerTarget.date, pointerTarget.startTime)
        : startAbs + timeToMinutes(fallbackSlot) - timeToMinutes(origStart);
      if (edge === "start") {
        const newStartAbs = Math.min(pointerAbs, endAbs - SLOT_MINUTES);
        const newDuration = Math.max(SLOT_MINUTES, endAbs - newStartAbs);
        // addMinutes wraps mod 24h; if start moved backwards across midnight,
        // roll the scheduled date back by the number of crossed days.
        const dayShift = Math.floor((timeToMinutes(origStart) + (newStartAbs - startAbs)) / (24 * 60));
        const nextStart = addMinutes(origStart, newStartAbs - startAbs);
        const nextEnd = addMinutes(nextStart, newDuration);
        return { nextStart, nextEnd, nextDuration: newDuration, nextStartDate: addDays(taskAnchorDate, dayShift) };
      }
      const newEndAbs = Math.max(pointerAbs, startAbs + SLOT_MINUTES);
      const newDuration = Math.max(SLOT_MINUTES, newEndAbs - startAbs);
      const nextEnd = addMinutes(origStart, newDuration);
      return { nextStart: origStart, nextEnd, nextDuration: newDuration, nextStartDate: taskAnchorDate };
    };

    const cleanup = () => {
      document.body.classList.remove("df-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.setTimeout(() => {
        suppressBlockClickRef.current = false;
      }, 0);
    };
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      const { nextStart, nextEnd, nextStartDate } = computeResize(moveEvent.clientX, moveEvent.clientY);
      setResizePreview({ taskId: task.id, start: nextStart, end: nextEnd, startDate: nextStartDate });
    };
    const up = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      if (!data) { cleanup(); return; }
      const { nextStart, nextEnd, nextDuration, nextStartDate } = computeResize(upEvent.clientX, upEvent.clientY);
      const durationHours = nextDuration / 60;
      const now = workspaceNow().toISOString();
      // Start-edge resize may shift the scheduled date when the new start
      // crosses midnight backwards; end-edge resize keeps the start (and
      // therefore the date) fixed.
      const moveStartDate = edge === "start";
      const sourceRecordId = resolveTimelineRecordId(task.id);
      const nextData = {
        ...data,
        tasks: data.tasks.map((t) => {
          const records = t.timelineRecords;
          if ((!records || records.length === 0) && t.id === task.id) {
            return {
              ...t,
              scheduledStart: nextStart,
              scheduledEnd: nextEnd,
              scheduledDate: moveStartDate ? nextStartDate : t.scheduledDate,
              estimatedHours: durationHours,
              updatedAt: now,
            };
          }
          if (!records) return t;
          const idx = records.findIndex((r) => r.id === sourceRecordId);
          if (idx === -1) return t;
          const updated = [...records];
          updated[idx] = rescheduleTimelineRecord(
            updated[idx],
            moveStartDate ? nextStartDate : updated[idx].scheduledDate,
            nextStart,
            nextDuration,
          );
          return { ...t, timelineRecords: updated, estimatedHours: durationHours, updatedAt: now };
        }),
      };
      showToast(t(lang, "toast.durationAdjusted"));
      void saveTaskOperation(nextData, "reschedule");
      setResizePreview(null);
      cleanup();
    };
    const cancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      setResizePreview(null);
      cleanup();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  function rememberLayerTrigger(key: string) {
    layerExitHandlesRef.current.get(key)?.cancel();
    layerExitHandlesRef.current.delete(key);
    const selectors = key === "drawer" ? ".df-drawer-backdrop, .df-drawer" : ".df-utility-backdrop, .df-utility-panel";
    document.querySelectorAll<HTMLElement>(selectors).forEach((element) => element.classList.remove("is-closing"));
    const active = document.activeElement;
    if (active instanceof HTMLElement) layerTriggerRef.current.set(key, active);
  }

  function requestLayerClose(key: string, selectors: string, commit: () => void) {
    if (layerExitHandlesRef.current.has(key)) return;
    document.querySelectorAll<HTMLElement>(selectors).forEach((element) => element.classList.add("is-closing"));
    layerExitHandlesRef.current.set(key, null);
    const handle = scheduleMotionCommit(() => {
      layerExitHandlesRef.current.delete(key);
      commit();
      const trigger = layerTriggerRef.current.get(key);
      layerTriggerRef.current.delete(key);
      window.requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      });
    }, MOTION.fade);
    if (layerExitHandlesRef.current.has(key)) layerExitHandlesRef.current.set(key, handle);
  }

  function openAdd(type: AddType = "task") {
    if (type === "habit" && !habitsEnabled) return;
    setMobileQuickAddDate(null);
    rememberLayerTrigger("drawer");
    setAddType(type);
    setEditingId("");
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setMobileTaskSummary(false);
    drawerInitialFormRef.current = defaultForm(type);
    setForm(drawerInitialFormRef.current);
    setDrawerOpen(true);
  }

  function openTaskEdit(task: Task) {
    setMobileQuickAddDate(null);
    if (isExternalCalendarDisplayTask(task)) {
      showToast(lang === "zh" ? "外部日历事项为只读；请在来源日历中修改" : "External calendar events are read-only; edit them in the source calendar");
      return;
    }
    if (suppressBlockClickRef.current || isEventDisplayTask(task)) return;
    rememberLayerTrigger("drawer");
    const realTask = resolveOwningTask(task) || task;
    const recordId = recordByIdMap.get(task.id)?.id;
    if (recordId) revealResizeHandles(resolveTimelineRecordId(task.id));
    const occurrence = parseRecurrenceOccurrenceId(task.id);
    setAddType("task");
    setEditingId(realTask.id);
    setEditingRecordId(recordId);
    setEditingOccurrence(occurrence ? {
      taskId: occurrence.taskId,
      scheduledDate: occurrence.scheduledDate,
      scheduledStart: occurrence.scheduledStart,
    } : null);
    setMobileTaskSummary(compactLayout);
    setForm({
      title: realTask.title,
      projectId: realTask.projectId || "",
      projectColor: DEFAULT_PROJECT_COLOR,
      dueDate: realTask.dueDate || "",
      dueTime: task.scheduledStart || "",
      endDate: task.scheduledDate || realTask.dueDate || today,
      endTime: task.scheduledEnd || "",
      category: realTask.category,
      priority: realTask.priority,
      importance: realTask.importance ?? null,
      urgency: realTask.urgency !== undefined ? realTask.urgency : null,
      estimatedHours: realTask.estimatedHours || 0.5,
      details: realTask.notes || ""
    });
    setDrawerOpen(true);
  }

  function clearTimelineSelection() {
    if (!resizeHintTaskId && !drawerOpen) return false;
    setResizeHintTaskId("");
    if (drawerOpen && mobileTaskSummary) closeTaskDrawer({ autoSave: true });
    return true;
  }

  function selectTimelineTask(task: Task, event: React.MouseEvent) {
    if (suppressBlockClickRef.current) return;
    const dockMouseClick = dockMouseLayout && (event.detail === 0 || ("pointerType" in event.nativeEvent && event.nativeEvent.pointerType === "mouse"));
    if (!compactLayout || dockMouseClick) {
      openTaskEdit(task);
      return;
    }
    const taskId = resolveTimelineRecordId(task.id);
    if (resizeHintTaskId === taskId) {
      openTaskEdit(task);
      return;
    }
    revealResizeHandles(taskId);
  }

  function openProjectEdit(project: Project) {
    rememberLayerTrigger("drawer");
    setAddType("project");
    setEditingId(project.id);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setMobileTaskSummary(false);
    setForm({ ...defaultForm("project"), title: project.title, dueDate: project.dueDate || "", category: project.category, projectColor: project.color || categories[project.category].color, details: project.notes, importance: project.importance !== undefined ? project.importance : null });
    setDrawerOpen(true);
  }

  function openHabitConvert(habit: Habit, targetType: "task" | "project") {
    habit = dataRef.current?.habits?.find((item) => item.id === habit.id) || habit;
    setNewHabitDraft(null);
    setHabitPanel(null);
    setEditingHabitId(null);
    rememberLayerTrigger("drawer");
    setAddType(targetType);
    setEditingId(habit.id);
    setEditingRecordId(undefined);
    setEditingOccurrence(null);
    setMobileTaskSummary(false);
    setForm({
      ...defaultForm(targetType),
      title: habit.title,
      category: "personal",
      projectId: habit.projectId || "",
      details: habit.notes || "",
      estimatedHours: Math.max((habit.defaultDurationMinutes || 30) / 60, 0.25),
    });
    setDrawerOpen(true);
  }

  function saveForm() {
    if (!data || !form.title.trim() || (addType === "habit" && !habitsEnabled)) return;
    const now = workspaceNow().toISOString();
    const buildUpdatedTask = (task: Task): Task => {
      const title = form.title.trim();
      const estimatedHours = Math.max(form.estimatedHours || 0.25, 0.25);
      const projectId = form.projectId || undefined;
      const titleChanged = title !== task.title;
      const durationChanged = estimatedHours !== task.estimatedHours;
      const projectChanged = projectId !== task.projectId;
      const durationInference = durationChanged
        ? { minutes: Math.round(estimatedHours * 60), confidence: 1, source: "user" as const, inferredAt: now, modelVersion: "user", userOverridden: true }
        : titleChanged && !task.aiInference?.duration?.userOverridden ? undefined : task.aiInference?.duration;
      const projectInference = projectChanged
        ? { projectId: projectId || "", confidence: 1, source: "user" as const, inferredAt: now, modelVersion: "user", userOverridden: true }
        : titleChanged && !task.aiInference?.project?.userOverridden ? undefined : task.aiInference?.project;
      return {
        ...task,
        title,
        dueDate: form.dueDate,
        dueDateSource: form.dueDate ? "manual" : undefined,
        category: form.category,
        priority: form.priority,
        projectId,
        estimatedHours,
        importance: form.importance,
        urgency: form.urgency,
        notes: form.details,
        aiInference: durationInference || projectInference
          ? { duration: durationInference, project: projectInference }
          : undefined,
        updatedAt: now,
      };
    };
    if (editingId) {
      const editingTask = data.tasks.find((task) => task.id === editingId);
      const editingProject = data.projects.find((project) => project.id === editingId);
      const editingHabit = (data.habits || []).find((habit) => habit.id === editingId);
      const buildHabit = (source: { title: string; createdAt: string; order?: number }): Habit => ({
        id: uid("habit"),
        title: form.title.trim(),
        projectId: form.projectId || undefined,
        notes: form.details,
        defaultDurationMinutes: Math.max(Math.round((form.estimatedHours || 0.5) * 60), SLOT_MINUTES),
        frequencyRule: "daily",
        activeWeekdays: [1, 2, 3, 4, 5],
        order: source.order ?? Date.now(),
        createdAt: source.createdAt,
        updatedAt: now,
      });
      if (editingProject && addType === "task") {
        const converted: Task = {
          id: uid("task"),
          title: form.title.trim(),
          dueDate: form.dueDate,
          category: form.category,
          priority: form.priority || "medium",
          notes: form.details,
          goalId: "",
          completed: editingProject.completed,
          projectId: form.projectId || undefined,
          estimatedHours: Math.max(form.estimatedHours || 0.25, 0.25),
          importance: form.importance,
          urgency: form.urgency,
          order: editingProject.order,
          subtasks: [],
          timelineRecords: [],
          createdAt: editingProject.createdAt,
          updatedAt: now,
        };
        void saveData({
          ...data,
          projects: data.projects.filter((project) => project.id !== editingProject.id),
          tasks: [...data.tasks, converted],
        });
      } else if (editingTask && addType === "project") {
        const converted: Project = {
          id: uid("project"),
          title: form.title.trim(),
          category: form.category,
          color: form.projectColor || categories[form.category].color,
          notes: form.details,
          completed: editingTask.completed,
          importance: form.importance,
          urgency: form.urgency,
          order: editingTask.order,
          createdAt: editingTask.createdAt,
          updatedAt: now,
        };
        void saveData({
          ...data,
          projects: [...data.projects, converted],
          tasks: data.tasks.filter((task) => task.id !== editingTask.id),
        });
      } else if (editingTask && addType === "habit") {
        void saveData({ ...data, habits: [...(data.habits || []), buildHabit(editingTask)], tasks: data.tasks.filter((task) => task.id !== editingTask.id) });
      } else if (editingProject && addType === "habit") {
        void saveData({ ...data, habits: [...(data.habits || []), buildHabit(editingProject)], projects: data.projects.filter((project) => project.id !== editingProject.id) });
      } else if (editingHabit && addType === "task") {
        const converted: Task = {
          id: uid("task"), title: form.title.trim(), dueDate: form.dueDate, category: form.category,
          priority: form.priority || "medium", notes: form.details, goalId: "", completed: false,
          projectId: form.projectId || undefined, estimatedHours: Math.max(form.estimatedHours || 0.25, 0.25),
          importance: form.importance, urgency: form.urgency, order: editingHabit.order, subtasks: [], timelineRecords: [],
          createdAt: editingHabit.createdAt, updatedAt: now,
        };
        void saveData({ ...data, tasks: [...data.tasks, converted], habits: (data.habits || []).filter((habit) => habit.id !== editingHabit.id) });
      } else if (editingHabit && addType === "project") {
        const converted: Project = {
          id: uid("project"), title: form.title.trim(), category: form.category, color: form.projectColor || categories[form.category].color,
          notes: form.details, completed: false, dueDate: form.dueDate || undefined, importance: form.importance, order: editingHabit.order,
          createdAt: editingHabit.createdAt, updatedAt: now,
        };
        void saveData({ ...data, projects: [...data.projects, converted], habits: (data.habits || []).filter((habit) => habit.id !== editingHabit.id) });
      } else if (addType === "task") {
        const updatedTask = data.tasks.find((task) => task.id === editingId);
        if (!updatedTask) return;
        const enrichedCandidate = buildUpdatedTask(updatedTask);
        void saveTaskOperation({
          ...data,
          tasks: data.tasks.map((task) => task.id === editingId ? enrichedCandidate : task)
        }, "edit");
        void enrichTaskInBackground(enrichedCandidate);
      } else if (addType === "project") {
        void saveData({ ...data, projects: data.projects.map((project) => project.id === editingId ? { ...project, title: form.title.trim(), dueDate: form.dueDate || undefined, category: form.category, color: form.projectColor || categories[form.category].color, notes: form.details, importance: form.importance, updatedAt: now } : project) });
      } else if (addType === "habit") {
        void saveData(updateHabit(data, editingId, { title: form.title.trim(), projectId: form.projectId || undefined, notes: form.details, defaultDurationMinutes: Math.max(Math.round((form.estimatedHours || 0.5) * 60), SLOT_MINUTES) }, now));
      }
    } else if (addType === "task") {
      const task = makeSmartTask(form);
      const durationMinutes = form.dueTime
        ? Math.max(
            form.endTime ? clockTimeSpanMinutes(form.dueTime, form.endTime) : Math.round((form.estimatedHours || 0.5) * 60),
            SLOT_MINUTES,
          )
        : 0;
      const createdTask = form.dueTime
          ? { ...task, plannedForDate: form.dueDate, executionLane: undefined, timelineRecords: [createScheduledRecord(task, form.dueDate || today, form.dueTime, durationMinutes)] }
          : mobileQuickAddDate
            ? { ...task, plannedForDate: form.dueDate || mobileQuickAddDate, scheduledDate: form.dueDate || mobileQuickAddDate, executionLane: undefined }
            : task;
      void saveTaskOperation({ ...data, tasks: [...data.tasks, createdTask] }, "create");
      void enrichTaskInBackground(createdTask);
    } else if (addType === "project") {
      void saveData({ ...data, projects: [...data.projects, makeProject(form)] });
    } else if (addType === "habit") {
      const now = workspaceNow().toISOString();
      const habit: Habit = {
        id: uid("habit"),
        title: form.title.trim(),
        projectId: form.projectId || undefined,
        notes: form.details,
        defaultDurationMinutes: Math.max(Math.round((form.estimatedHours || 0.5) * 60), SLOT_MINUTES),
        frequencyRule: "daily",
        activeWeekdays: [1, 2, 3, 4, 5],
        order: Date.now(),
        createdAt: now,
        updatedAt: now,
      };
      void saveData({ ...data, habits: [...(data.habits || []), habit] });
    }
    requestLayerClose("drawer", ".df-drawer-backdrop, .df-drawer", () => {
      setEditingId("");
      setEditingRecordId(undefined);
      setEditingOccurrence(null);
      setForm(defaultForm("task"));
      setAddType("task");
      setMobileTaskSummary(false);
      setDrawerOpen(false);
    });
  }

  function confirmNewItemSave(type: AddType) {
    const name = lang === "zh"
      ? { task: "任务", project: "项目", habit: "习惯" }[type]
      : { task: "task", project: "project", habit: "habit" }[type];
    return dialog.confirm(lang === "zh" ? `保存新建${name}？` : `Save this new ${name}?`, {
      message: lang === "zh" ? "保存后退出，或放弃本次新增。" : "Save and close, or discard this new item.",
      confirmLabel: lang === "zh" ? "保存" : "Save",
      cancelLabel: lang === "zh" ? "放弃" : "Discard",
    });
  }

  async function closeMobileQuickAdd() {
    if (drawerSaveConfirmRef.current) return;
    if (quickTitle.trim()) {
      drawerSaveConfirmRef.current = true;
      const save = await confirmNewItemSave(mobileQuickAddKind);
      drawerSaveConfirmRef.current = false;
      if (save === true) { finishMobileQuickAdd(); return; }
      if (save !== false) return;
    }
    setQuickAddOpen(false);
  }

  async function closeTaskDrawer(options?: { autoSave?: boolean }) {
    if (layerExitHandlesRef.current.has("drawer")) return;
    if (!editingId
      && (form.title.trim() || form.details.trim())
      && JSON.stringify(form) !== JSON.stringify(drawerInitialFormRef.current || defaultForm(addType))) {
      if (drawerSaveConfirmRef.current) return;
      drawerSaveConfirmRef.current = true;
      const save = await confirmNewItemSave(addType);
      drawerSaveConfirmRef.current = false;
      if (save === true) {
        if (!form.title.trim()) {
          showToast(lang === "zh" ? "请先填写名称" : "Enter a name first");
          return;
        }
        saveForm();
        return;
      }
      if (save !== false) return;
    }
    const autoSave = options?.autoSave ?? false;
    const current = dataRef.current;
    if (autoSave && current && editingId && addType === "task") {
      const now = workspaceNow().toISOString();
      const currentTask = current.tasks.find((task) => task.id === editingId);
      if (currentTask) {
        const safeTitle = form.title.trim() || currentTask.title;
        void saveData({
          ...current,
          tasks: current.tasks.map((task) => task.id === editingId ? {
            ...task,
            title: safeTitle,
            category: form.category,
            priority: form.priority,
            projectId: form.projectId || undefined,
            estimatedHours: Math.max(form.estimatedHours || 0.25, 0.25),
            importance: form.importance,
            urgency: form.urgency,
            notes: form.details,
            updatedAt: now,
          } : task),
        });
      }
    }
    dismissTaskDrawer();
  }

  function dismissTaskDrawer(afterClose?: () => void) {
    requestLayerClose("drawer", ".df-drawer-backdrop, .df-drawer", () => {
      setResizeHintTaskId("");
      setDrawerOpen(false);
      setEditingRecordId(undefined);
      setEditingOccurrence(null);
      setEditingId("");
      setForm(defaultForm("task"));
      setAddType("task");
      setMobileTaskSummary(false);
      afterClose?.();
    });
  }

  function openTimelineDay(date: string, dayTasks?: Task[]) {
    if (drawerOpen || drag || suppressBlockClickRef.current) return;
    const focus = dayTasks
      ? { startTime: dayTasks.find((task) => task.scheduledStart)?.scheduledStart || minutesToTime(dayStartHour * 60) }
      : currentTimelineViewportFocus();
    setMonthQuickAdd(null);
    setSelectedDate(date);
    setVisibleTimelineDate(date);
    setTimelineView("daily");
    setCompactExecuteView("schedule");
    requestTimelineFocus({ ...focus, date, source: "schedule" });
  }

  async function moveTaskToMonthDate(display: Task, date: string) {
    const { moveMonthTask } = await import("./utils/monthTasks");
    const current = dataRef.current;
    if (!current || isEventDisplayTask(display)) return;
    if (display.id.startsWith("habit:")) {
      scheduleHabitAt(display.id.slice("habit:".length), date, minutesToTime(dayStartHour * 60), false);
      return;
    }
    const ownerId = resolveOwningTask(display)?.id || display.id;
    const owner = current.tasks.find((task) => task.id === ownerId);
    if (!owner) return;
    const moved = moveMonthTask(owner, display, date, resolveTimelineRecordId(display.id), workspaceNow().toISOString());
    if (moved === owner) return;
    void saveData({ ...current, tasks: current.tasks.map((task) => task.id === ownerId ? moved : task) });
  }

  function monthDateAtPointer(pointer: { x: number; y: number }) {
    return document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>(".df-month-cell[data-date]")?.dataset.date || "";
  }

  function locateTaskOnTimeline(date: string, startTime: string, taskId: string) {
    setCompactExecuteView("schedule");
    if (timelineView === "month") setTimelineView("daily");
    setSelectedDate(date);
    setVisibleTimelineDate(date);
    if (drawerOpen) void closeTaskDrawer({ autoSave: true });
    requestTimelineFocus({ date, startTime, taskId, source: "schedule", behavior: "auto", highlight: true });
  }

  function locateTaskInTree(task: Task) {
    if (!treeView) return;
    void closeTaskDrawer({ autoSave: true });
    setPlanningFocusTaskId(task.id);
    openTreeView();
  }

  function deleteEditingItem() {
    if (!editingId) return;
    const workspaceKey = loadedWorkspaceKeyRef.current;
    dismissTaskDrawer(() => {
      const current = dataRef.current;
      if (!current || workspaceKey !== loadedWorkspaceKeyRef.current) return;
      if (addType === "task") deleteTaskById(editingId);
      if (addType === "project") void saveData({ ...current, projects: current.projects.filter((project) => project.id !== editingId) });
      if (addType === "habit") void saveData({ ...current, habits: (current.habits || []).filter((habit) => habit.id !== editingId) });
    });
  }

  function copyEditingTask() {
    if (!data || !editingId) return;
    const task = data.tasks.find((item) => item.id === editingId);
    if (!task) return;
    const now = workspaceNow().toISOString();
    const title = form.title.trim() || task.title;
    void saveData({
      ...data,
      tasks: [...data.tasks, {
        ...task,
        id: uid("task"),
        title,
        completed: false,
        recurrence: undefined,
        timelineRecords: [],
        executionStatus: undefined,
        plannedForDate: today,
        executionLane: "candidate",
        scheduledDate: undefined,
        scheduledStart: undefined,
        scheduledEnd: undefined,
        dueDate: "",
        projectId: form.projectId || undefined,
        category: form.category,
        priority: form.priority,
        importance: form.importance,
        urgency: form.urgency,
        estimatedHours: Math.max(form.estimatedHours || 0.25, 0.25),
        notes: form.details,
        createdAt: now,
        updatedAt: now
      }]
    });
    showToast(t(lang, "toast.taskDuplicated"));
  }

  function askAi(taskId: string) {
    if (!isAiActive()) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    setReferencedTaskId(task.id);
    setAiInput(`请帮我明确「${task.title}」的下一步行动。`);
    setAiOpen(true);
  }

  function applyAgentClientActions(agent?: AgentRunState) {
    if (!isAiActive()) return;
    for (const command of agent?.clientActions || []) {
      if (command.entity === "timer") {
        if (command.operation === "pause") handleWidgetAction({ type: "timerPause" });
        else if (command.operation === "start" && command.targetId && dataRef.current?.tasks.some((item) => item.id === command.targetId)) handleWidgetAction({ type: "timerStart", taskId: command.targetId });
        continue;
      }
      if (command.entity !== "app" || command.operation !== "navigate") continue;
      const values = command.values || {};
      if (values.mode === "planning") openTreeView();
      if (values.mode === "execute") showTimelineWorkspace();
      if (values.view === "daily" || values.view === "3day" || values.view === "weekly" || values.view === "month") setTimelineView(values.view);
      if (typeof values.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(values.date)) setSelectedDate(values.date);
      if (command.targetId && dataRef.current?.tasks.some((item) => item.id === command.targetId)) {
        const target = dataRef.current.tasks.find((item) => item.id === command.targetId)!;
        setSelectedDate(target.scheduledDate || target.dueDate || todayIso());

      }
    }
  }

  async function streamAiReply(messageId: string, reply: string) {
    const chunkSize = 12;
    for (let end = chunkSize; end < reply.length; end += chunkSize) {
      const visible = reply.slice(0, end);
      setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, streaming: true, content: visible } : message));
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    }
    setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, status: "done", streaming: false, content: reply, steps: message.steps?.map((step) => step.status === "running" ? { ...step, status: "done" as const } : step) } : message));
  }

  function explicitAgentDecision(message: string): "approve" | "reject" | null {
    const compact = message.trim().toLowerCase().replace(/[\s。.!！,，、]+$/g, "");
    if (!compact || compact.length > 24) return null;
    if (/^(确认|确定|批准|执行|继续|好|好的|可以|同意|确认执行|确认并执行|yes|y|approve|confirm|do it|go ahead)$/.test(compact)) return "approve";
    if (/^(取消|拒绝|否决|不要|别执行|停止|no|n|reject|cancel|stop)$/.test(compact)) return "reject";
    return null;
  }

  async function sendAi(messageOverride?: string, trigger: "manual" | "start_brief" | "end_review" = "manual") {
    if (productDemo) { if (dataRef.current) setAiMessages((items) => [...items, productDemo.suggest(dataRef.current!)]); return; }
    if (!isAiActive() || aiBusy) return false;
    if (!(messageOverride ?? aiInput).trim() && !aiAttachment) return false;
    if (!data) return false;
    if (!authStateRef.current?.user || authStateRef.current.mode !== "cloud") {
      showToast(lang === "zh" ? "全局 AI 需要先登录云端账号" : "Sign in to use the global AI agent");
      return false;
    }
    const submittedInput = messageOverride === undefined ? aiInput : null;
    const msg = (messageOverride ?? aiInput).trim() || "把附件中的安排整理成任务";
    const latestAssistantMessage = [...aiMessages].reverse().find((message) => message.role === "assistant");
    const pendingAgentMessage = latestAssistantMessage?.agent?.decisionState === "pending" && latestAssistantMessage.agent.pending.length > 0
      ? latestAssistantMessage
      : undefined;
    const requestedDecision = trigger === "manual" ? explicitAgentDecision(msg) : null;
    if (pendingAgentMessage && requestedDecision) {
      const handled = await handleAgentDecision(pendingAgentMessage.id, requestedDecision === "approve" ? "approve" : "reject");
      if (handled && submittedInput !== null) setAiInput((current) => current === submittedInput ? "" : current);
      return handled;
    }
    const attachmentSnapshot: AiAttachmentSnapshot | undefined = aiAttachment ? {
      name: aiAttachment.name,
      size: aiAttachment.size,
      pageCount: aiAttachment.pageCount,
      truncated: aiAttachment.truncated,
      status: "ready",
      statusText: aiAttachmentStatus,
      summary: aiAttachment.text.slice(0, 180).replace(/\s+/g, " ").trim(),
    } : undefined;
    const userMessage: AiSessionMessage = { id: uid("ai_user"), role: "user", content: msg, attachment: attachmentSnapshot, createdAt: workspaceNow().toISOString() };
    const assistantId = uid("ai_assistant");
    const assistantMessage: AiSessionMessage = {
      id: assistantId, role: "assistant", content: "", createdAt: workspaceNow().toISOString(), status: "thinking",
      steps: [{ label: aiAttachment ? (lang === "zh" ? "正在读取附件" : "Reading attachment") : (lang === "zh" ? "正在处理" : "Working"), status: "running" }],
    };
    setAiMessages((current) => [...current, userMessage, assistantMessage]);
    setAiInput("");
    setAiBusy(true);
    setAiMemoryNotice("");
    clearAiAttachment();

    const dataForHistory = dataRef.current || data;
    const conversationsBefore = dataForHistory.aiConversations || [];
    const conversationId = activeAiConversationId || dataForHistory.activeAiConversationId || conversationsBefore[0]?.id || uid("conversation");
    if (!activeAiConversationId) setActiveAiConversationId(conversationId);

    const requestController = new AbortController();
    const progressPhases = aiAttachment
      ? (lang === "zh" ? ["正在读取附件", "正在读取工作区", "正在分析请求", "正在准备执行", "正在整理答案"] : ["Reading attachment", "Reading workspace", "Analyzing request", "Preparing actions", "Organizing answer"])
      : (lang === "zh" ? ["正在连接 AI", "正在读取工作区", "正在分析请求", "正在准备执行", "正在整理答案"] : ["Connecting to AI", "Reading workspace", "Analyzing request", "Preparing actions", "Organizing answer"]);
    let progressIndex = 0;
    const progressTimer = window.setInterval(() => {
      progressIndex = (progressIndex + 1) % progressPhases.length;
      setAiMessages((current) => current.map((message) => message.id === assistantId && message.status === "thinking" && !message.streaming
        ? { ...message, steps: [{ label: progressPhases[progressIndex], status: "running" }] }
        : message));
    }, 1600);
    aiAbortRef.current?.abort();
    aiAbortRef.current = requestController;
    try {
      await flushPendingSave({ urgent: true });
      await flushPendingSettings({ urgent: true });
      if (trigger !== "manual") await refreshExternalCalendarLayer("force");
      const result = await callAiAssistant({
        mode: "agent",
        model: settings?.model,
        reasoningMode: settings?.reasoningMode || "instant",
        message: msg,
        attachmentText: aiAttachment?.text,
        attachmentName: aiAttachment?.name,
        context: {
          currentViewDate: selectedDate || today,
          page: shelfTreeOpen ? "planning" : "execute",
          language: settings?.language || lang,
          timerStatus: { taskId: timerTaskId || "", running: timerRunning, elapsedSeconds: timerElapsed },
        },
        conversationId,
        trigger,
        signal: requestController.signal,
      });
      if (!result.ok) {
        const failureMessage = result.error.requestId
          ? `${result.error.message}\n\n${lang === "zh" ? "请求编号" : "Request ID"}: ${result.error.requestId}`
          : result.error.message;
        setAiInput((current) => current || msg);
        setAiMessages((current) => current.map((message) => message.id === assistantId ? {
          ...message,
          status: "error",
          content: failureMessage,
          steps: [{ label: result.error.message, status: "error" }],
        } : message));
        return false;
      }
      const validActions = (result.actions || [])
        .map((action) => action.type === "import_schedule_item" ? { ...action, kind: "task" as const } : action)
        .filter(isValidAiAction);
      const agent = result.agent ? {
        ...result.agent,
        decisionState: result.agent.pending.length ? "pending" as const : result.agent.decisionState,
      } : undefined;
      if ((agent?.applied.length || 0) > 0) {
        queuedRemoteRefreshRef.current = true;
        await refreshQueuedRemote();
      }
      applyAgentClientActions(agent);
      const displayReply = normalizeAiReply(result.reply);
      setAiMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        status: "thinking",
        streaming: true,
        content: "",
        steps: [...(result.steps && result.steps.length > 0 ? result.steps : [{ label: lang === "zh" ? "已读取工作区" : "Workspace read", status: "done" as const }]), { label: lang === "zh" ? "正在生成答案" : "Generating answer", status: "running" as const }],
        actions: validActions,
        selectedActions: Object.fromEntries(validActions.map((_, index) => [index, true])),
        actionState: validActions.length ? "pending" : undefined,
        intent: result.intent,
        plan: result.plan,
        clarifications: result.clarifications,
        format: result.format || "markdown",
        agent,
      } : message));
      await streamAiReply(assistantId, displayReply);
      const currentData = dataRef.current;
      if (currentData) {
        const assistantChat = {
          id: assistantId,
          role: "assistant" as const,
          content: normalizeAiReply(result.reply),
          createdAt: workspaceNow().toISOString(),
          saved: true,
          status: "done" as const,
          steps: result.steps && result.steps.length > 0 ? result.steps : [{ label: lang === "zh" ? "安排已生成" : "Schedule prepared", status: "done" as const }],
          actions: validActions,
          selectedActions: Object.fromEntries(validActions.map((_, index) => [index, true])),
          actionState: validActions.length ? "pending" as const : undefined,
          intent: result.intent,
          plan: result.plan,
          clarifications: result.clarifications,
          format: result.format || "markdown" as const,
          agent,
        };
        const userChat = { id: userMessage.id, role: "user" as const, content: msg, createdAt: userMessage.createdAt, saved: true };
        const conversations = removeEmptyAiConversations(currentData.aiConversations || [], conversationId);
        let nextConversations = conversations;
        nextConversations = nextConversations.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          const nextMessages = [...(conversation.messages || []), userChat, assistantChat].slice(-80);
          return {
            ...conversation,
            title: conversation.messages.length === 0 || conversation.title === "新对话" ? aiConversationTitle(msg) : conversation.title,
            messages: nextMessages,
            updatedAt: assistantChat.createdAt,
          };
        });
        if (!nextConversations.some((conversation) => conversation.id === conversationId)) {
          nextConversations = [{ ...makeAiConversation(aiConversationTitle(msg)), id: conversationId, messages: [userChat, assistantChat], updatedAt: assistantChat.createdAt }, ...nextConversations];
        }
        const activeConversation = nextConversations.find((conversation) => conversation.id === conversationId);
        const nextChat = (activeConversation?.messages || []).slice(-40);
        const memoryPatches = [...extractLocalMemories(msg), ...(result.memories || [])];
        const nextMemories = settingsRef.current?.aiMemoryEnabled === false
          ? currentData.aiMemories || []
          : mergeAiMemories(currentData, memoryPatches, "auto");
        if (memoryPatches.length > 0 && settingsRef.current?.aiMemoryEnabled !== false) {
          const savedCount = Math.min(memoryPatches.length, 4);
          setAiMemoryNotice(lang === "zh" ? `已记住 ${savedCount} 条偏好` : `Saved ${savedCount} memory item${savedCount === 1 ? "" : "s"}`);
        }
        await saveData({ ...currentData, chat: nextChat, aiConversations: nextConversations, activeAiConversationId: conversationId, aiMemories: nextMemories });
        if (agent?.pending.length) showToast(lang === "zh" ? `有 ${agent.pending.length} 项操作等待确认` : `${agent.pending.length} action(s) need confirmation`);
        else if (agent?.applied.length) showToast(lang === "zh" ? `AI 已执行 ${agent.applied.length} 项操作，可随时从消息下方撤回` : `AI applied ${agent.applied.length} action(s); use the undo button below the message anytime`);
      }
      return true;
    } catch (error) {
      setAiInput((current) => current || msg);
      setAiMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        status: "error",
        content: error instanceof Error ? error.message : "网络异常，请稍后重试。",
        steps: [{ label: "请求失败", status: "error" }],
      } : message));
      return false;
    } finally {
      window.clearInterval(progressTimer);
      if (aiAbortRef.current === requestController) aiAbortRef.current = null;
      setAiBusy(false);
    }
  }

  useEffect(() => {
    const user = authState?.mode === "cloud" ? authState.user : null;
    if (!user) return;
    let active = true;
    let cleanup: () => void = () => undefined;
    void webNotificationOnboardingPromise.then(({ watchForNewUserNotification }) => {
      if (active) cleanup = watchForNewUserNotification(user);
    });
    return () => { active = false; cleanup(); };
  }, [authState?.mode, authState?.user?.id, authState?.user?.email]);

  useEffect(() => {
    if (!aiEnabled || authState?.mode !== "cloud" || !authState.user) {
      setProactiveNotifications([]);
      seenProactiveNotificationIdsRef.current.clear();
      return;
    }
    let active = true;
    const hydrateReview = async (notification: ProactiveNotification, autoOpen: boolean) => {
      const current = dataRef.current;
      if (!active || !isAiActive() || !current || notification.kind !== "daily_review") return;
      const shouldOpen = autoOpen && document.visibilityState !== "hidden" && !aiBusyRef.current && !aiInputRef.current.trim();
      const result = ensureDailyReviewConversation(current, notification, lang === "zh" ? "zh" : "en");
      if (result.added) {
        dataRef.current = result.data;
        if (shouldOpen) {
          setAiMessages(chatToSessionMessages(result.data.chat || []));
          setActiveAiConversationId(result.conversationId);
        }
        await saveData(result.data);
      }
      if (shouldOpen) {
        setAiOpen(true);
        await markProactiveNotificationRead(notification.id).catch(() => undefined);
        setProactiveNotifications((items) => items.filter((item) => item.id !== notification.id));
      }
    };
    const refresh = async () => {
      const [items, reviews] = await Promise.all([
        listProactiveNotifications().catch(() => [] as ProactiveNotification[]),
        listDailyReviewNotifications().catch(() => [] as ProactiveNotification[]),
      ]);
      if (!active || !isAiActive()) return;
      items.forEach((item) => seenProactiveNotificationIdsRef.current.add(item.id));
      setProactiveNotifications(items);
      for (const review of reviews) await hydrateReview(review, false);
    };
    const receive = (notification: ProactiveNotification) => {
      if (!active || !isAiActive() || seenProactiveNotificationIdsRef.current.has(notification.id)) return;
      seenProactiveNotificationIdsRef.current.add(notification.id);
      setProactiveNotifications((items) => [notification, ...items.filter((item) => item.id !== notification.id)].slice(0, 50));
      showToast(lang === "zh" ? `Navo AI：${notification.title}` : `Navo AI: ${notification.title}`);
      showProactiveSystemNotification(notification);
      if (notification.kind === "daily_review") void hydrateReview(notification, false);
      if (notification.kind === "unfinished_tasks" && !aiBusyRef.current && !aiInputRef.current.trim()) setUnfinishedNotification(notification);
    };
    void refresh();
    const unsubscribe = subscribeToProactiveNotifications(receive);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [authState?.mode, authState?.user?.id, lang, aiEnabled]);

  useEffect(() => {
    if (proactiveIntroShownRef.current || authState?.mode !== "cloud" || !authState.user || !settings || settings.proactiveAssistantIntroSeen) return;
    proactiveIntroShownRef.current = true;
    showToast(lang === "zh"
      ? "Navo AI 主动助理已开启：会安排普通任务、提示补记，并保留撤销和确认边界。"
      : "Navo AI Proactive Assistant is on: it can arrange ordinary tasks, prompt gap logging, and keeps undo and confirmation safeguards.");
    void saveSettings({ proactiveAssistantIntroSeen: true });
  }, [authState?.mode, authState?.user?.id, lang, settings?.proactiveAssistantIntroSeen]);

  function openDailyAiPrompt(kind: "start" | "review") {
    if (!isAiActive()) return;
    setAiInput(kind === "start"
      ? (lang === "zh" ? "请结合今日容量、截止日期和我的常用执行时段，给我一份简短的开工简报：三项重点、首个行动和一项风险。" : "Give me a short start-of-day brief using today's capacity, deadlines, and my preferred work hours: three priorities, the first action, and one risk.")
      : (lang === "zh" ? "请结合今天的计划、完成情况和计时记录做收工复盘：总结进展、识别偏差，并给出明天的一个调整建议。" : "Review my day using the plan, completions, and timer history: summarize progress, identify variance, and suggest one adjustment for tomorrow."));
    setAiOpen(true);
  }

  function selectDailyReviewConversation() {
    const current = dataRef.current || data;
    if (!current) return;
    const existing = (current.aiConversations || []).find((conversation) => conversation.id === DAILY_REVIEW_CONVERSATION_ID);
    if (existing) {
      setActiveAiConversationId(existing.id);
      setAiMessages(chatToSessionMessages(existing.messages || []));
      return;
    }
    const now = workspaceNow().toISOString();
    const conversation: AiConversation = { id: DAILY_REVIEW_CONVERSATION_ID, title: lang === "zh" ? "每日复盘" : "Daily review", messages: [], createdAt: now, updatedAt: now, pinned: true };
    const nextData = { ...current, aiConversations: [conversation, ...(current.aiConversations || [])], activeAiConversationId: conversation.id, chat: [] };
    dataRef.current = nextData;
    setActiveAiConversationId(conversation.id);
    setAiMessages([]);
    void saveData(nextData);
  }

  async function openDailyReviewNotification(notification?: ProactiveNotification) {
    if (notification?.kind === "daily_review") {
      const current = dataRef.current || data;
      if (!current) return;
      const result = ensureDailyReviewConversation(current, notification, lang === "zh" ? "zh" : "en");
      if (result.added) {
        dataRef.current = result.data;
        await saveData(result.data);
      }
      setActiveAiConversationId(result.conversationId);
      setAiMessages(chatToSessionMessages(result.data.aiConversations?.find((conversation) => conversation.id === result.conversationId)?.messages || []));
      await markProactiveNotificationRead(notification.id).catch(() => undefined);
      setProactiveNotifications((items) => items.filter((item) => item.id !== notification.id));
    } else {
      selectDailyReviewConversation();
    }
    setNotificationCenterOpen(false);
    setAiOpen(true);
  }

  function openUnfinishedAi(taskIds: string[]) {
    if (!isAiActive()) return;
    selectDailyReviewConversation();
    const current = dataRef.current || data;
    const titles = current ? taskIds.map((id) => current.tasks.find((task) => task.id === id)?.title).filter(Boolean) : [];
    setAiInput(lang === "zh"
      ? `请帮我安排以下未完成任务：${titles.join("、") || "今天的未完成任务"}。先给出明日候选时间和安排理由，涉及锁定日程或硬截止请先请求确认。`
      : `Please arrange these unfinished tasks: ${titles.join(", ") || "today's unfinished tasks"}. First propose candidate times for tomorrow and explain why; ask for confirmation before touching locked schedules or hard deadlines.`);
    setNotificationCenterOpen(false);
    setAiOpen(true);
  }

  function dismissProactiveNotification(notification: ProactiveNotification) {
    setProactiveNotifications((items) => items.filter((item) => item.id !== notification.id));
    void markProactiveNotificationRead(notification.id).catch(() => undefined);
  }

  function cancelAi() {
    aiAbortRef.current?.abort();
  }

  async function toggleAiAuditHistory() {
    if (aiAuditOpen) {
      setAiAuditOpen(false);
      return;
    }
    setAiConversationListOpen(false);
    setAiAuditOpen(true);
    setAiAuditLoading(true);
    setAiAuditError("");
    try {
      setAiAuditRuns(await listAgentAuditRuns());
    } catch (error) {
      setAiAuditError(error instanceof Error ? error.message : (lang === "zh" ? "暂时无法读取审计记录" : "Could not load audit history"));
    } finally {
      setAiAuditLoading(false);
    }
  }

  async function handleAiAttachment(file: File) {
    clearAiAttachment();
    const controller = new AbortController();
    attachmentParseRef.current = controller;
    setAiAttachmentStatus("正在本地解析文件...");
    try {
      const { parseAttachment } = await import("./fileParser");
      const parsed = await parseAttachment(file, controller.signal);
      if (attachmentParseRef.current !== controller || controller.signal.aborted) return;
      setAiAttachment(parsed);
      setAiAttachmentStatus(parsed.truncated ? "文本已提取，超过 60,000 字符的部分已截断" : "文本已提取，仅文本会发送给 AI");
    } catch (error) {
      if (attachmentParseRef.current === controller && !controller.signal.aborted) {
        setAiAttachmentStatus(error instanceof Error ? error.message : "文件解析失败");
      }
    } finally {
      if (attachmentParseRef.current === controller) attachmentParseRef.current = null;
    }
  }

  function clearAiAttachment() {
    attachmentParseRef.current?.abort();
    attachmentParseRef.current = null;
    setAiAttachment(null);
    setAiAttachmentStatus("");
  }

  async function startNewAiConversation() {
    const current = dataRef.current || data;
    if (!current) return;
    clearAiAttachment();
    const conversation = makeAiConversation();
    const nextConversations = [conversation, ...removeEmptyAiConversations(current.aiConversations || [])];
    setActiveAiConversationId(conversation.id);
    setAiMessages([]);
    setAiConversationListOpen(false);
    setAiMemoryNotice("");
    setAiActionPatches({});
    await saveData({ ...current, aiConversations: nextConversations, activeAiConversationId: conversation.id, chat: [] });
  }

  function selectAiConversation(conversationId: string) {
    const current = dataRef.current || data;
    if (!current) return;
    const conversation = (current.aiConversations || []).find((item) => item.id === conversationId);
    if (!conversation) return;
    clearAiAttachment();
    setActiveAiConversationId(conversation.id);
    setAiMessages(chatToSessionMessages(conversation.messages || []));
    setAiConversationListOpen(false);
    setAiMemoryNotice("");
    setAiActionPatches({});
    void saveData({ ...current, aiConversations: removeEmptyAiConversations(current.aiConversations || []), activeAiConversationId: conversation.id, chat: (conversation.messages || []).slice(-40) });
  }

  async function renameAiConversation(conversationId: string, title: string) {
    const current = dataRef.current || data;
    const nextTitle = title.trim();
    if (!current || !nextTitle) return;
    const conversations = current.aiConversations || [];
    if (!conversations.some((conversation) => conversation.id === conversationId)) return;
    await saveData({
      ...current,
      aiConversations: conversations.map((conversation) => conversation.id === conversationId
        ? { ...conversation, title: nextTitle }
        : conversation),
    });
  }

  async function toggleAiConversationPinned(conversationId: string) {
    const current = dataRef.current || data;
    if (!current) return;
    const conversations = current.aiConversations || [];
    if (!conversations.some((conversation) => conversation.id === conversationId)) return;
    await saveData({
      ...current,
      aiConversations: conversations.map((conversation) => conversation.id === conversationId
        ? { ...conversation, pinned: !conversation.pinned }
        : conversation),
    });
  }

  async function deleteAiConversation(conversationId: string) {
    const beforeConfirm = dataRef.current || data;
    const target = beforeConfirm?.aiConversations?.find((conversation) => conversation.id === conversationId);
    if (!beforeConfirm || !target) return;
    const confirmed = await dialog.confirm(lang === "zh"
      ? `删除“${target.title || "未命名对话"}”？此操作无法撤销。`
      : `Delete “${target.title || "Untitled"}”? This cannot be undone.`);
    if (!confirmed) return;

    const current = dataRef.current || beforeConfirm;
    const remaining = (current.aiConversations || []).filter((conversation) => conversation.id !== conversationId);
    const currentActiveId = activeAiConversationId || current.activeAiConversationId || "";
    const deletingActive = currentActiveId === conversationId;
    const nextActive = deletingActive
      ? sortAiConversations(remaining)[0]
      : remaining.find((conversation) => conversation.id === currentActiveId) || sortAiConversations(remaining)[0];
    const nextActiveId = nextActive?.id || "";
    const nextChat = (nextActive?.messages || []).slice(-40);

    if (deletingActive || !nextActiveId) {
      setActiveAiConversationId(nextActiveId);
      setAiMessages(chatToSessionMessages(nextChat));
      setAiMemoryNotice("");
      setAiActionPatches({});
    }
    await saveData({
      ...current,
      aiConversations: remaining,
      activeAiConversationId: nextActiveId || undefined,
      chat: nextChat,
    });
  }

  async function adoptSelectedAiActions(messageId: string, demoMessage?: AiSessionMessage) {
    if (!isAiActive()) return;
    const currentData = dataRef.current;
    if (!currentData) return;
    const message = demoMessage || aiMessages.find((item) => item.id === messageId);
    const patches = aiActionPatches[messageId] || {};
    const selected = (message?.actions || [])
      .map((action, index) => ({ ...action, ...(patches[index] || {}) } as AiAction))
      .filter((_, index) => message?.selectedActions?.[index] !== false);
    if (selected.length === 0) return;
    const now = workspaceNow().toISOString();
    const nextTasks = [...currentData.tasks];
    const addedTaskIds: string[] = [];
    const previousTasks: Task[] = [];
    let focus: TimelineFocusTarget | undefined;
    for (const action of selected) {
      if (action.type === "create_subtasks" && action.taskId && action.subtasks?.length) {
        const index = nextTasks.findIndex((task) => task.id === action.taskId);
        if (index !== -1) {
          if (!previousTasks.some((task) => task.id === nextTasks[index].id)) previousTasks.push(nextTasks[index]);
          nextTasks[index] = {
            ...nextTasks[index],
            subtasks: appendAiSubtasks(nextTasks[index].subtasks, action.subtasks, () => uid("subtask"), now),
            updatedAt: now,
          };
        }
        continue;
      }
      if (action.type === "import_schedule_item" && action.title && action.date) {
        const task = buildImportedTask(action, nextTasks);
        nextTasks.push(task);
        addedTaskIds.push(task.id);
        const startTime = action.startTime || task.recurrence?.startTime;
        if (startTime) focus ||= { date: action.date, startTime, taskId: task.id, source: "schedule" };
        continue;
      }
      if ((action.type === "create_scheduled_task" || action.type === "create_task") && action.title) {
        const a = action as Record<string, any>;
        const projectId = projects.some((project) => project.id === a.projectId) ? a.projectId : undefined;
        const duration = normalizeTaskDuration(Number(a.durationMinutes) || learnedTaskDurationMinutes(action.title, nextTasks, projectId));
        const startTime = normalizeTaskStartTime(a.start);
        const date = a.date || today;
        const task: Task = {
          ...makeSmartTask({ ...defaultForm("task"), title: action.title, projectId: projectId || "", dueDate: date, estimatedHours: duration / 60 }),
          importance: null, urgency: null, notes: a.reason || "", goalId: "",
          scheduledDate: date, scheduledStart: startTime,
          scheduledEnd: validTime(a.end) ? a.end : addMinutes(startTime, duration), subtasks: [], order: Date.now(),
          createdAt: now, updatedAt: now,
        };
        nextTasks.push(task);
        addedTaskIds.push(task.id);
        focus ||= { date, startTime, taskId: task.id, source: "schedule" };
        continue;
      }
      if (action.type === "schedule_task" && action.taskId && action.date) {
        const a = action as Record<string, any>;
        const index = nextTasks.findIndex((task) => task.id === action.taskId);
        if (index !== -1) {
          if (!previousTasks.some((task) => task.id === nextTasks[index].id)) previousTasks.push(nextTasks[index]);
          const startTime = normalizeTaskStartTime(a.start || nextTasks[index].scheduledStart);
          const endTime = validTime(a.end) ? a.end : addMinutes(startTime, normalizeTaskDuration(taskDuration(nextTasks[index])));
          const duration = normalizeTaskDuration(clockTimeSpanMinutes(startTime, endTime));
          const recordId = typeof a.recordId === "string" ? a.recordId : undefined;
          const record = findScheduledTimelineRecord(currentData.tasks[index]?.timelineRecords || [], recordId);
          if (scheduledTaskIntervalsOnDate(nextTasks, action.date, record?.id).some(interval => timeToMinutes(startTime) < interval.end && timeToMinutes(startTime) + duration > interval.start)) {
            showToast(lang === "zh" ? "这段时间已有安排，请调整时间" : "This time is already booked. Adjust the time.");
            return;
          }
          nextTasks[index] = { ...nextTasks[index], estimatedHours: duration / 60, projectId: typeof a.projectId === "string" ? a.projectId || undefined : nextTasks[index].projectId, plannedForDate: action.date, executionLane: undefined, scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, timelineRecords: applyScheduledTimelineRecord(nextTasks[index].timelineRecords || [], createScheduledRecord(nextTasks[index], action.date, startTime, duration), record?.id), updatedAt: now };
          focus ||= { date: action.date, startTime, taskId: action.taskId, source: "schedule" };
        }
      }
    }
    await saveData({ ...currentData, tasks: nextTasks },"ai");
    setAiMessages((current) => current.map((item) => item.id === messageId ? { ...item, actionState: "adopted", actions: [], importCommit: { focus, addedCount: selected.length, addedTaskIds, previousTasks } } : item));
    persistAiMessage(messageId, { actionState: "adopted", actions: [] });
    setAiActionPatches((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
  }

  function rejectSelectedAiActions(messageId: string) {
    setAiMessages((current) => current.map((item) => item.id === messageId ? { ...item, actionState: "rejected", actions: [] } : item));
    persistAiMessage(messageId, { actionState: "rejected", actions: [] });
  }

  function handleTimelinePanelWheel(event: React.WheelEvent<HTMLElement>) {
    if (productPresentation) return;
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,[contenteditable=true],.df-drawer,.df-utility-panel,.df-project-popover-portal,.df-mobile-date-picker")) return;
    const scrollElement = timelineView === "month" ? monthScrollRef.current : timelineRef.current;
    if (!scrollElement) return;
    const insideScroll = scrollElement.contains(target);

    if (insideScroll) return;

    const maxScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    if (maxScroll <= 0) return;
    scrollElement.scrollTop = Math.min(maxScroll, Math.max(0, scrollElement.scrollTop + event.deltaY));
  }

  function beginShelfDrag(event: React.PointerEvent, task: Task, source: "candidate" | "allDay", options: CandidateDragOptions = {}) {
    if (isExternalCalendarDisplayTask(task)) {
      showToast(lang === "zh" ? "外部日历事项为只读" : "External calendar events are read-only");
      return;
    }
    const target = event.target as HTMLElement;
    const interactiveTarget = target.closest("button,input,textarea,select,a");
    if (event.button !== 0 || (interactiveTarget && !target.closest(".icon-schedule"))) return;
    // Candidate ordering and scheduling are valid for unassigned and recurring
    // tasks as well. Their project/recurrence metadata stays attached to the
    // same task; dragging only changes its position or scheduled record.
    if (isEventDisplayTask(task)) return;
    const pointerId = event.pointerId;
    const dragElement = options.dragElement || event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const duration = taskDuration(task);
    let dragSourceRect: { width: number; height: number } | null = null;
    let dragSourceOffset: { x: number; y: number } | null = null;
    let active = false;
    let holdCancelled = false;
    // Candidate rows live inside a scroll container on every touch layout.
    // Require a hold before dragging so an ordinary vertical swipe remains a
    // native list scroll in both portrait and landscape orientations.
    let holdReady = !(source === "candidate" && event.pointerType === "touch");
    const holdTimer = holdReady ? undefined : window.setTimeout(() => {
      holdReady = true;
      dragElement.classList.add("is-drag-armed");
      window.navigator.vibrate?.(8);
    }, CANDIDATE_TOUCH_HOLD_MS);
    // Preserve native swipes until the hold is ready, then prevent the browser
    // from taking over scrolling and cancelling the scheduling pointer stream.
    const holdTouch = (touchEvent: TouchEvent) => {
      if (holdReady && !holdCancelled && touchEvent.touches.length === 1) touchEvent.preventDefault();
    };
    dragElement.addEventListener("touchmove", holdTouch, { passive: false });
    const clearHold = () => {
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      dragElement.classList.remove("is-drag-armed");
    };
    let dropTime = "";
    let candidateTarget: CandidateDropTarget = null;
    let projection: ReturnType<typeof createDragProjection> | undefined;
    const setCandidateReorderTarget = (nextTarget: CandidateDropTarget) => {
      const previousTarget = candidateTarget;
      const sameTaskTarget = previousTarget?.kind === "task" && nextTarget?.kind === "task"
        ? previousTarget.taskId === nextTarget.taskId
          && previousTarget.position === nextTarget.position
          && previousTarget.intent === nextTarget.intent
        : false;
      const sameProjectTarget = previousTarget?.kind === "project" && nextTarget?.kind === "project"
        ? previousTarget.projectId === nextTarget.projectId
        : false;
      const unchanged = (previousTarget === null && nextTarget === null) || sameTaskTarget || sameProjectTarget;
      candidateTarget = nextTarget;
      if (nextTarget?.kind !== "task") projection?.update();
      if (!unchanged) setCandidateDropTarget(nextTarget);
    };
    const jumpDate = (tap: PointerEvent) => {
      if (!active || tap.pointerId === pointerId) return;
      const control = document.elementFromPoint(tap.clientX, tap.clientY)?.closest<HTMLElement>("[data-date],.df-compact-date-picker-trigger");
      const date = control?.dataset.date;
      if (date) { setSelectedDate(date); dragTargetDateRef.current = date; window.navigator.vibrate?.(6); }
      else if (control?.classList.contains("df-compact-date-picker-trigger")) setMobileDatePickerOpen(true);
    };
    let mobileDropCommitted = false;
    const cleanup = () => {
      projection?.close();
      window.removeEventListener("blur", cleanup);
      if (active && mobileExecution && source === "candidate" && !mobileDropCommitted) setCandidateDrawerOpen(true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("pointerdown", jumpDate);
      dragElement.removeEventListener("touchmove", holdTouch);
      document.body.classList.remove("df-timeline-pointer-drag");
      dragElement.classList.remove("is-dragging-source");
      setDrag(null);
      setDragOverlay(null);
      setDragOverlayTask(null);
      setActiveDragItem(null);
      setHoverSlot("");
      setAllDayDragOver(false);
      setAllDayDragDate("");
      setCandidateDropActive(false);
      setCandidateDropTarget(null);
      dragTargetDateRef.current = "";
      setMonthDropDate("");
      clearHold();
      if (dragElement.hasPointerCapture(pointerId)) dragElement.releasePointerCapture(pointerId);
      if (active) suppressClickAfterDrag();
    };
    const readTarget = (pointerEvent: PointerEvent) => {
      const pointedElement = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
      const monthDate = monthDateAtPointer({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      setMonthDropDate(monthDate);
      const candidateRow = source === "candidate" && options.allowCandidateReorder !== false ? pointedElement?.closest<HTMLElement>("[data-candidate-task-id]") : null;
      if (candidateRow) {
        const targetTaskId = candidateRow.dataset.candidateTaskId || "";
        const targetTask = dataRef.current?.tasks.find((item) => item.id === targetTaskId);
        if (targetTask && targetTaskId !== task.id && targetTask.completed === task.completed
          && (!groupByProject || targetTask.projectId === task.projectId)) {
          // Stable logical rectangles determine the drop; visual copies make space.
          const rect = (candidateRow.querySelector<HTMLElement>(".df-task-card") || candidateRow).getBoundingClientRect();
          const position = (pointerEvent.clientY - rect.top) < rect.height / 2 ? "before" : "after";
          projection?.update(candidateRow, position);
          setCandidateReorderTarget({
            kind: "task",
            taskId: targetTaskId,
            position,
            intent: position === "before" ? "reorder-before" : "reorder-after",
          });
        } else if (targetTask && targetTaskId !== task.id && groupByProject && targetTask.projectId !== task.projectId) {
          setCandidateReorderTarget({ kind: "project", projectId: targetTask.projectId || null });
        } else {
          setCandidateReorderTarget(null);
        }
        setCandidateDropActive(false);
        setAllDayDragOver(false);
        setAllDayDragDate("");
        dropTime = "";
        setHoverSlot("");
        dragTargetDateRef.current = "";
        return;
      }
      const candidateProjectGroup = source === "candidate" && groupByProject
        ? pointedElement?.closest<HTMLElement>("[data-candidate-project-id]")
        : null;
      if (candidateProjectGroup) {
        const projectId = candidateProjectGroup.dataset.candidateProjectId || null;
        if (projectId === (task.projectId || null)) {
          setCandidateReorderTarget(null);
        } else {
          setCandidateReorderTarget({ kind: "project", projectId });
        }
        setCandidateDropActive(false);
        setAllDayDragOver(false);
        setAllDayDragDate("");
        dropTime = "";
        setHoverSlot("");
        dragTargetDateRef.current = "";
        return;
      }
      setCandidateReorderTarget(null);
      const candidatePanel = source === "allDay" ? pointedElement?.closest<HTMLElement>(".df-candidate-panel") : null;
      setCandidateDropActive(Boolean(candidatePanel));
      if (candidatePanel) {
        setAllDayDragOver(false);
        setAllDayDragDate("");
        dropTime = "";
        setHoverSlot("");
        dragTargetDateRef.current = "";
        return;
      }
      if (monthDate) {
        dropTime = "";
        setHoverSlot("");
        setAllDayDragOver(false);
        setAllDayDragDate("");
        dragTargetDateRef.current = monthDate;
        return;
      }
      const allDayCell = pointedElement?.closest<HTMLElement>("[data-all-day-date]");
      setAllDayDragOver(Boolean(allDayCell));
      if (allDayCell) {
        const targetDate = allDayCell.dataset.allDayDate || timelineDate;
        setAllDayDragDate(targetDate);
        dropTime = "";
        setHoverSlot("");
        dragTargetDateRef.current = targetDate;
        return;
      }
      setAllDayDragDate("");
      // Candidate -> timeline drag must NOT mutate timeline scroll position or
      // change the current date. The continuous cross-day canvas spans 7 days
      // of vertical space already; `resolveDropTarget` re-reads the grid rect
      // on every move so manual wheel-scroll during a drag still maps correctly.
      // Use the continuous-aware resolver (date-from-Y band) instead of the
      // single-day `getDropTargetFromPointer`, matching `beginBlockDrag`.
      const scrollEl = timelineRef.current;
      if (scrollEl) {
        const rect = scrollEl.getBoundingClientRect();
        const inside = pointerEvent.clientX >= rect.left && pointerEvent.clientX <= rect.right && pointerEvent.clientY >= rect.top && pointerEvent.clientY <= rect.bottom;
        if (!inside) { dropTime = ""; setHoverSlot(""); dragTargetDateRef.current = ""; return; }
      }
      const target = resolveDropTarget(pointerEvent.clientX, pointerEvent.clientY);
      if (!target) { dropTime = ""; setHoverSlot(""); dragTargetDateRef.current = ""; return; }
      dragTargetDateRef.current = target.date;
      dropTime = target.startTime;
      setHoverSlot(target.startTime);
    };
    const updateTarget = (pointerEvent: PointerEvent) => projection ? projection.logical(() => readTarget(pointerEvent)) : readTarget(pointerEvent);
    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      const distance = Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY);
      if (!holdReady) {
        if (distance >= TOUCH_SCROLL_CANCEL_DISTANCE_PX) {
          holdCancelled = true;
          clearHold();
        }
        return;
      }
      if (holdCancelled || (!active && distance < DRAG_START_THRESHOLD_PX)) return;
      if (!active) {
        active = true;
        clearHold();
        dragElement.setPointerCapture(pointerId);
        document.body.classList.add("df-timeline-pointer-drag");
        dragElement.classList.add("is-dragging-source");
        if (source === "candidate" && options.allowCandidateReorder !== false) projection = createDragProjection(dragElement);
        suppressBlockClickRef.current = true;
        setDragCreate(null);
        const rect = dragElement.getBoundingClientRect();
        const offX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        const offY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
        dragSourceRect = { width: rect.width, height: rect.height };
        dragSourceOffset = { x: offX, y: offY };
        setDragOverlay({ taskId: task.id, sourceElement: dragElement, sourceRect: rect, pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY }, offset: { x: offX, y: offY }, data: { kind: "candidate", source } });
        setDragOverlayTask({ task, variant: source === "candidate" ? "candidate" : "allDay" });
        setActiveDragItem({
          dragId: `${source}:${task.id}`,
          taskId: task.id,
          source: source === "candidate" ? "candidate" : "timeline",
          sourceContainerId: source,
          sourceIndex: visibleCandidates.findIndex((item) => item.id === task.id),
          sourceVariant: source === "candidate" ? "candidate" : "allDay",
          taskSnapshot: task,
        });
        if (compactLayout && source === "candidate") {
          if (mobileExecution) closeCandidateDrawer();
          setCompactExecuteView("schedule");
          window.requestAnimationFrame(() => updateTarget(pointerEvent));
        }
      }
      pointerEvent.preventDefault();
      setDragOverlayPointer({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      autoScrollAtDragEdge(pointerEvent.clientX, pointerEvent.clientY, [
        document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest<HTMLElement>(".df-candidate-list"),
        document.querySelector<HTMLElement>(".df-candidate-panel"),
        timelineRef.current,
        monthScrollRef.current,
      ]);
      const currentRect = dragElement.getBoundingClientRect();
      const sourceRect = dragSourceRect || { width: currentRect.width, height: currentRect.height };
      const sourceOffset = dragSourceOffset || {
        x: Math.min(Math.max(startX - currentRect.left, 0), currentRect.width),
        y: Math.min(Math.max(startY - currentRect.top, 0), currentRect.height),
      };
      setDrag({
        taskId: task.id,
        kind: "candidate",
        source,
        duration,
        pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY },
        sourceRect,
        offset: sourceOffset,
      });
      updateTarget(pointerEvent);
    };
    const up = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      if (active) {
        // Re-resolve at release so a stale hover cannot reorder after the
        // pointer has left the candidate list or moved onto the timeline.
        updateTarget(pointerEvent);
        const pointedElement = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
        if (candidateTarget?.kind === "task") {
          rememberDragLanding(task.id, "candidate");
          reorderTodayCandidate(task.id, candidateTarget.taskId, candidateTarget.position);
          cleanup();
          return;
        }
        if (candidateTarget?.kind === "project") {
          rememberDragLanding(task.id, "candidate");
          moveTodayCandidateToProjectGroup(task.id, candidateTarget.projectId || undefined);
          cleanup();
          return;
        }
        const candidatePanel = source === "allDay" ? pointedElement?.closest<HTMLElement>(".df-candidate-panel") : null;
        const allDayCell = pointedElement?.closest<HTMLElement>("[data-all-day-date]");
        const monthDate = monthDateAtPointer({ x: pointerEvent.clientX, y: pointerEvent.clientY });
        if (monthDate || allDayCell) {
          const date = monthDate || allDayCell?.dataset.allDayDate || timelineDate;
          if (source === "allDay") {
            if (monthDate) void moveTaskToMonthDate(task, date);
            else makeAllDay(task.id, date);
          } else if (task.id.startsWith("habit:")) {
            scheduleHabitAt(task.id.slice("habit:".length), date, minutesToTime(dayStartHour * 60), false);
          } else if (options.onSchedule) options.onSchedule(date, "");
          else commitShelfSchedule(task.id, date, "");
        } else if (candidatePanel) {
          returnTimelineTaskToCandidates(task.id, today);
        } else if (dropTime && dragTargetDateRef.current) {
          rememberDragLanding(task.id, "schedule");
          mobileDropCommitted = true;
          if (options.onSchedule) options.onSchedule(dragTargetDateRef.current, dropTime);
          else scheduleTask(task.id, dropTime, source === "allDay");
        }
      }
      cleanup();
    };
    const cancel = (pointerEvent: PointerEvent) => { if (pointerEvent.pointerId === pointerId) cleanup(); };
    const keydown = (keyboardEvent: KeyboardEvent) => { if (keyboardEvent.key === "Escape") cleanup(); };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
    window.addEventListener("pointerdown", jumpDate);
    window.addEventListener("blur", cleanup);
  }

  async function refreshQueuedRemote() {
    if (!queuedRemoteRefreshRef.current
      || pendingDataSaveRef.current
      || pendingSettingsSaveRef.current
      || dataSaveInFlightRef.current
      || settingsSaveInFlightRef.current) return;
    queuedRemoteRefreshRef.current = false;
    const workspaceKey = loadedWorkspaceKeyRef.current;
    const bootstrap = await window.plannerApi.getBootstrap?.({ force: true });
    if (!bootstrap?.data || !bootstrap.settings) return;
    const incomingRevision = Number(bootstrap.revision || 0);
    const cached = readBootstrapCache(authStateRef.current?.user?.id);
    const hasDirtyLocal = Boolean(cached?.dataDirty || cached?.settingsDirty);
    if (workspaceKey !== loadedWorkspaceKeyRef.current) return;
    if (cloudBaselineReadyRef.current && !hasDirtyLocal && !shouldApplyWorkspaceRevision(workspaceKey, loadedWorkspaceKeyRef.current, remoteRevisionRef.current, incomingRevision)) return;
    // Edits made while the network request was in flight must remain dirty.
    const latestCache = readBootstrapCache(authStateRef.current?.user?.id) || cached;
    const resolved = resolveBootstrap(latestCache, bootstrap.data, bootstrap.settings);
    if (!resolved.data || !resolved.settings) return;
    remoteRevisionRef.current = Math.max(remoteRevisionRef.current, incomingRevision);
    if (cloudBaselineReadyRef.current && !hasDirtyLocal && !resolved.replayData && dataRef.current && !productDemo && metricsPluginActive(extensionService.getSnapshot())) recordLocalAnalyticsChange(authStateRef.current?.user?.id || "preview",dataRef.current,resolved.data,workspaceNow().toISOString(),"remote-observed",incomingRevision>0?`remote:${incomingRevision}`:undefined);
    cloudBaselineReadyRef.current = true;
    dataRef.current = resolved.data;
    settingsRef.current = resolved.settings;
    setData(resolved.data);
    setSettings(resolved.settings);
    if (resolved.settings.language) setLang(resolved.settings.language);
    writeBootstrapCache(resolved.data, resolved.settings, authStateRef.current?.user?.id, {
      dataDirty: resolved.replayData,
      settingsDirty: resolved.replaySettings,
      remoteRevision: bootstrap.revision,
    });
    if (resolved.replayData) {
      await saveData(resolved.data);
      await flushPendingSave({ urgent: true });
    }
    if (resolved.replaySettings) {
      await saveSettings(resolved.settings);
      await flushPendingSettings({ urgent: true });
    }
  }

  function viewAiImport(messageId: string) {
    const commit = aiMessages.find((message) => message.id === messageId)?.importCommit;
    if (!commit?.focus) return;

    setTimelineView("daily");
    requestTimelineFocus(commit.focus);
    if (!productAiPresentation) setAiOpen(false);
  }

  async function runProductDemoPreset(request?: "undo" | { taskId: string; days: 1 | 2 }) {
    if (!productDemo || !dataRef.current || demoPresetBusyRef.current) return;
    demoPresetBusyRef.current = true;
    setDemoGuideDismissed(true);
    setDemoPresetBusy(true);
    try {
      if (request === "undo") {
        const latest = [...aiMessages].reverse().find(message => message.actionState === "adopted");
        if (!latest) return;
        const previous = latest.importCommit?.previousTasks?.[0];
        await undoAiImport(latest.id);
        if (aiMessages.filter(message => message.actionState === "adopted").length === 1) setAiMessages([]);
        const date = previous?.timelineRecords?.find(record => record.executionStatus === "scheduled")?.scheduledDate || productDemo.date;
        setSelectedDate(date);
        setVisibleTimelineDate(date);
      } else {
        const message = productDemo.suggest(dataRef.current, request);
        if (!message.actions?.length) {
          setAiMessages(items => [...items, { ...message, content: lang === "zh" ? "当天没有足够的空闲时段。" : "There is not enough free time on that day." }]);
          return;
        }
        const task = request && dataRef.current.tasks.find(item => item.id === request.taskId);
        const prompt = request ? (lang === "zh" ? `把「${task?.title}」改到${request.days === 1 ? "明天" : "后天"}` : `Move ${task?.title} to ${request.days === 1 ? "tomorrow" : "the day after tomorrow"}`) : (lang === "zh" ? "帮我安排今天" : "Plan my day");
        setAiMessages(items => [...items, { id: `request-${message.id}`, role: "user", content: prompt, createdAt: workspaceNow().toISOString() }, { ...message, status: "thinking", actions: undefined, actionState: undefined, content: lang === "zh" ? (request ? "正在寻找合适的新时段…" : "正在为工作、学习和运动留出时间…") : (request ? "Finding a new time…" : "Making room for work, learning and exercise…") }]);
        await new Promise(resolve => window.setTimeout(resolve, request ? 650 : 3000));
        setAiMessages(items => items.map(item => item.id === message.id ? message : item));
        if (productAiPresentation && !request) setDemoRevealing(true);
        await adoptSelectedAiActions(message.id, message);
        const date = message.actions[0].type === "schedule_task" ? message.actions[0].date || productDemo.date : productDemo.date;
        setSelectedDate(date);
        setVisibleTimelineDate(date);
        if (productAiPresentation && !request) await productDemo.revealSchedule?.();
      }
      setDemoReschedulesOpen(false);
    } finally {
      setDemoRevealing(false);
      demoPresetBusyRef.current = false;
      setDemoPresetBusy(false);
    }
  }

  async function undoAiImport(messageId: string) {
    const commit = aiMessages.find((message) => message.id === messageId)?.importCommit;
    if (!commit || !dataRef.current) return;
    const workspaceKey=loadedWorkspaceKeyRef.current;
    const {undoAiImportData}=await import("./utils/aiImportUndo");
    const currentData=dataRef.current;
    if(!currentData||workspaceKey!==loadedWorkspaceKeyRef.current)return;
    await saveData(undoAiImportData(currentData, commit),"undo");
    setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, actionState: "undone", importCommit: undefined } : message));
    persistAiMessage(messageId, { actionState: "undone" });
  }

  function persistAiMessage(messageId: string, patch: Partial<AiSessionMessage>) {
    const current = dataRef.current;
    if (!current) return;
    const update = (message: PlannerData["chat"][number]) => message.id === messageId ? { ...message, ...patch } : message;
    void saveData({
      ...current,
      chat: (current.chat || []).map(update),
      aiConversations: (current.aiConversations || []).map((conversation) => ({ ...conversation, messages: (conversation.messages || []).map(update), updatedAt: workspaceNow().toISOString() })),
    });
  }

  async function handleAgentDecision(messageId: string, decision: "approve" | "reject" | "undo"): Promise<boolean> {
    const existing = aiMessages.find((message) => message.id === messageId)?.agent;
    if ((!isAiActive() && decision === "approve") || !existing?.runId || aiBusy) return false;
    setAiBusy(true);
    try {
      const mode = decision === "approve" ? "agent_confirm" : decision === "reject" ? "agent_reject" : "agent_undo";
      const result = await decideAgentRun(mode, existing.runId);
      if (!result.ok) {
        showToast(result.error.message);
        return false;
      }
      if (decision !== "reject") {
        queuedRemoteRefreshRef.current = true;
        await refreshQueuedRemote();
      }
      if (result.agent?.applied.some((action) => action.entity === "integration")) await refreshExternalCalendarLayer("none");
      applyAgentClientActions(result.agent);
      const nextAgent: AgentRunState = {
        ...(result.agent || existing),
        trace: existing.trace,
        applied: decision === "undo" ? [] : [...existing.applied, ...(result.agent?.applied || [])],
        pending: [],
        forbidden: existing.forbidden,
        decisionState: decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "undone",
      };
      setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, agent: nextAgent } : message));
      persistAiMessage(messageId, { agent: nextAgent });
      if (aiAuditOpen) void listAgentAuditRuns().then(setAiAuditRuns).catch(() => undefined);
      showToast(result.reply);
      return true;
    } finally {
      setAiBusy(false);
    }
  }

  function buildImportedTask(action: Extract<AiAction, { type: "import_schedule_item" }>, existingTasks: Task[]): Task {
    const { title = "", date = today, startTime, endTime, endDate } = action;
    const projectId = projects.find((project) => project.id === action.projectId)?.id;
    const recurrence = normalizeAiRecurrence(action.recurrence, date, startTime, action.durationMinutes);
    const span = startTime && endTime
      ? endDate && validIsoDate(endDate) && endDate > date
        ? calendarDateTimeSpanMinutes(date, startTime, endDate, endTime)
        : clockTimeSpanMinutes(startTime, endTime)
      : undefined;
    const duration = normalizeTaskDuration(action.durationMinutes || span || learnedTaskDurationMinutes(title, existingTasks, projectId));
    const task: Task = {
      ...makeSmartTask({ ...defaultForm("task"), title, projectId: projectId || "", dueDate: date, estimatedHours: duration / 60 }),
      category: validCategory(action.category),
      priority: validPriority(action.priority),
      notes: action.notes || "",
      recurrence,
    };
    if (!recurrence && startTime) task.timelineRecords = [createScheduledRecord(task, date, startTime, duration)];
    return task;
  }

  async function confirmAiAction(action: AiAction, messageId?: string, actionIndex?: number) {
    if (!isAiActive()) return;
    const currentData = dataRef.current;
    if (!currentData) return;
    if (action.type === "create_subtasks" && action.taskId && action.subtasks?.length) {
      const target = currentData.tasks.find((task) => task.id === action.taskId);
      if (!target) {
        showToast(lang === "zh" ? "未找到要拆解的任务" : "The task to break down was not found");
        return;
      }
      const now = workspaceNow().toISOString();
      const subtasks = appendAiSubtasks(target.subtasks, action.subtasks, () => uid("subtask"), now);
      await saveData({
        ...currentData,
        tasks: currentData.tasks.map((task) => task.id === target.id ? { ...task, subtasks, updatedAt: now } : task),
      },"ai");
      if (messageId) removeAiMessageAction(messageId, action, actionIndex);
      showToast(lang === "zh" ? `已添加 ${subtasks.length - (target.subtasks || []).length} 个子任务` : `Added ${subtasks.length - (target.subtasks || []).length} subtasks`);
      return;
    }
    if (action.type === "import_schedule_item" && action.title && action.date) {
      const task = buildImportedTask(action, currentData.tasks);
      await saveData({ ...currentData, tasks: [...currentData.tasks, task] },"ai");
      if (messageId) removeAiMessageAction(messageId, action, actionIndex);
      return;
    }
    // Handle create_scheduled_task (TrevorAI-style) and create_task as the same flow
    if ((action.type === "create_scheduled_task" || action.type === "create_task") && action.title) {
      const a = action as Record<string, unknown>;
      const projectId = projects.some((project) => project.id === a.projectId) ? a.projectId as string : undefined;
      const dur = normalizeTaskDuration((a.durationMinutes as number) || learnedTaskDurationMinutes(action.title, currentData.tasks, projectId));
      const startTime = normalizeTaskStartTime(a.start);
      const endTime = validTime(a.end) ? a.end as string : addMinutes(startTime, dur);
      const newTask: Task = {
        id: `ai_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
        title: action.title,
        category: "personal",
        priority: "medium",
        importance: null,
        urgency: null,
        notes: (a.reason as string) || "",
        goalId: "",
        completed: false,
        projectId,
        dueDate: (a.date as string) || today,
        estimatedHours: dur / 60,
        scheduledDate: (a.date as string) || today,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        subtasks: [],
        order: Date.now(),
        createdAt: workspaceNow().toISOString(),
        updatedAt: workspaceNow().toISOString(),
      } as Task;
      const updatedTasks = [...currentData.tasks, newTask];
      await saveTaskOperation({ ...currentData, version: currentData.version || 1, tasks: updatedTasks }, "create", {
        source:"ai", toast: t(lang, "toast.created").replace("%TITLE%", action.title),
      });
      // Mark action as accepted
      if (messageId) removeAiMessageAction(messageId, action, actionIndex);
      return;
    }
    if (action.type === "schedule_task" && action.taskId && action.date) {
      const a = action as Record<string, unknown>;
      const target = currentData.tasks.find(task => task.id === action.taskId);
      if (!target) return;
      const start = normalizeTaskStartTime(a.start || target.scheduledStart);
      const duration = validTime(a.end) ? normalizeTaskDuration(clockTimeSpanMinutes(start, a.end as string)) : normalizeTaskDuration(taskDuration(target));
      const recordId = typeof a.recordId === "string" ? a.recordId : undefined;
      const record = findScheduledTimelineRecord(target.timelineRecords || [], recordId);
      if (scheduledTaskIntervalsOnDate(currentData.tasks, action.date, record?.id).some(interval => timeToMinutes(start) < interval.end && timeToMinutes(start) + duration > interval.start)) {
        showToast(lang === "zh" ? "这段时间已有安排，请调整时间" : "This time is already booked. Adjust the time.");
        return;
      }
      const updatedTasks = currentData.tasks.map((t) =>
        t.id === action.taskId
          ? { ...t, estimatedHours: duration / 60, projectId: typeof a.projectId === "string" ? a.projectId || undefined : t.projectId, plannedForDate: action.date, executionLane: undefined, scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, timelineRecords: applyScheduledTimelineRecord(t.timelineRecords || [], createScheduledRecord(t, action.date!, start, duration), record?.id), updatedAt: workspaceNow().toISOString() }
          : t
      );
      await saveTaskOperation({ ...currentData, version: currentData.version || 1, tasks: updatedTasks }, "schedule", {
        source:"ai", toast: t(lang, "toast.scheduledToDate").replace("%DATE%", action.date),
      });
    }
    // Dismiss the action card
    if (messageId) removeAiMessageAction(messageId, action, actionIndex);
  }

  function removeAiMessageAction(messageId: string, action: AiAction, actionIndex?: number) {
    setAiMessages((current) => current.map((message) => message.id === messageId
      ? { ...message, actions: (message.actions || []).filter((item, index) => actionIndex === undefined ? item !== action : index !== actionIndex) }
      : message));
    if (actionIndex !== undefined) {
      setAiActionPatches((current) => {
        const messagePatches = { ...(current[messageId] || {}) };
        delete messagePatches[actionIndex];
        return { ...current, [messageId]: messagePatches };
      });
    }
    const current = aiMessages.find((message) => message.id === messageId);
    if (current) persistAiMessage(messageId, { actions: (current.actions || []).filter((item, index) => actionIndex === undefined ? item !== action : index !== actionIndex) });
  }

  function dismissAiAction(action: AiAction, messageId: string, actionIndex?: number) {
    removeAiMessageAction(messageId, action, actionIndex);
  }

  async function generateNextAction() {
    if (productDemo || !isAiActive()) return;
    const task = editingId ? tasks.find((item) => item.id === editingId) : null;
    setClarifyLoading(true);
    try {
      const result = await callAiAssistant({
        mode: "parse_task",
        model: settings?.model,
        message: t(lang, "toast.clarifyPrompt"),
        context: { title: form.title, project: projects.find((project) => project.id === form.projectId)?.title, date: form.dueDate, estimatedHours: form.estimatedHours, notes: form.details, subtasks: task?.subtasks || [] },
      });
      if (!isAiActive()) return;
      if (!result.ok) throw new Error(result.error.message);
      const nextAction = result.reply || t(lang, "toast.clarifyHintGeneric");
      setForm((current) => ({ ...current, details: replaceNextAction(current.details, nextAction) }));
      showToast(lang === "zh" ? "已生成下一步建议" : "Next action generated");
    } catch {
      setForm((current) => ({ ...current, details: replaceNextAction(current.details, `${t(lang, "toast.clarifyHint").replace("%TITLE%", current.title)}`) }));
      showToast(lang === "zh" ? "生成失败，已使用默认提示" : "Generation failed, using default hint");
    } finally {
      setClarifyLoading(false);
    }
  }

  async function planMyDay(overrides?: Partial<AiPlanPrefs>, sourceTasksOverride?: Task[]) {
    if (productDemo) { if (dataRef.current) { setAiMessages((items) => [...items, productDemo.suggest(dataRef.current!, undefined, sourceTasksOverride?.map(task => task.id))]); setAiOpen(true); } return; }
    if (autoScheduleState === "generating" || autoScheduleState === "committing") return;

    const planPrefs = { ...aiPlanPrefs, ...overrides };
    if (overrides) setAiPlanPrefs(planPrefs);
    const sourceIds = sourceTasksOverride && new Set(sourceTasksOverride.map((task) => task.id));
    const sourceTasks = sourceIds ? unscheduledShelfTasks.filter((task) => sourceIds.has(task.id)) : unscheduledShelfTasks;
    if (sourceTasks.length === 0) {
      void dialog.alert(t(lang, "toast.noTaskToSchedule"));
      return;
    }
    setSchedulePreviews([]);
    setAutoScheduleState("generating");
    setSelectedDate(today);

    const dateRange = planPrefs.scope === "week"
      ? Array.from({ length: 7 }, (_, index) => addDays(today, index))
      : planPrefs.scope === "3day"
        ? [today, addDays(today, 1), addDays(today, 2)]
        : [today];

    const existingEvents = getScheduledEventsForRange(dateRange);

    const tasksForSchedule = sourceTasks.map((t) => ({
      id: t.id, title: t.title,
      priority: (t.priority || "medium") as "high" | "medium" | "low",
      estimatedMinutes: t.estimatedHours ? Math.round(t.estimatedHours * 60) : undefined,
      dueDate: t.dueDate, projectId: t.projectId, completed: t.completed,
      scheduledDate: t.scheduledDate, scheduledStart: t.scheduledStart, scheduledEnd: t.scheduledEnd,
    }));

    const result = autoScheduleTasks({
      tasks: tasksForSchedule,
      scheduledEvents: existingEvents,
      dateRange,
      settings: {
        dayStart: settings?.scheduleDayStartTime || "08:00",
        dayEnd: settings?.dayEndTime || "22:00",
        bufferMinutes: settings?.scheduleBufferMinutes ?? 5,
        strategy: planPrefs.strategy,
        preferredStartHourByProject: data?.aiProfile?.preferredStartHourByProject || {},
        allowTaskSplitting: true,
      },
    });

    // Each proposed block remains a reviewable preview; split segments retain
    // their shared source id and segment metadata until the user adopts them.
    const previews: SchedulePreview[] = result.proposedEvents.map((ev) => {
      const source = tasks.find((t) => t.id === ev.taskId);
      return {
        id: ev.id,
        sourceTaskId: ev.taskId,
        clonedTaskId: ev.clonedTaskId,
        title: source?.title || ev.title,
        projectId: ev.projectId,
        scheduledDate: ev.scheduledDate,
        scheduledStart: ev.scheduledStart,
        scheduledEnd: ev.scheduledEnd,
        durationMinutes: ev.durationMinutes,
        priority: ev.priority,
        reason: ev.reason,
        segmentIndex: ev.segmentIndex,
        segmentCount: ev.segmentCount,
      };
    });

    setSchedulePreviews(previews);
    setScheduleUnscheduled(result.unscheduledTasks);
    setAutoScheduleState(previews.length > 0 ? "preview" : "idle");
    if (previews.length === 0 && result.unscheduledTasks.length > 0) {
      showToast(`${t(lang, "toast.noContinuousSlot").replace("%COUNT%", String(result.unscheduledTasks.length))}`);
    }
  }

  async function generateTaskSubtasks(taskId: string) {
    if (productDemo || !isAiActive()) return;
    const snapshot = dataRef.current;
    const task = snapshot?.tasks.find((item) => item.id === taskId);
    if (!snapshot || !task || subtaskAiBusyId) return;
    setSubtaskAiBusyId(taskId);
    try {
      const result = await callAiAssistant({
        mode: "suggest_subtasks",
        model: settings?.model,
        reasoningMode: settings?.reasoningMode || "instant",
        message: lang === "zh" ? "请将当前任务拆解为 3–8 个可执行子任务，只返回子任务拆解结果。" : "Break down the focused task into 3–8 actionable subtasks and return only the breakdown.",
        context: {
          language: lang,
          focusTask: {
            id: task.id,
            title: task.title,
            notes: task.notes,
            subtasks: (task.subtasks || []).map((subtask) => subtask.title),
          },
        },
      });
      if (!isAiActive()) return;
      if (!result.ok) throw new Error(result.error.message);
      const suggestions = getAiSubtaskSuggestions(result.actions, taskId);
      if (!suggestions.length) throw new Error(lang === "zh" ? "AI 没有返回当前任务的有效子任务，请重试" : "AI returned no valid subtasks for this task. Please try again.");
      const latestData = dataRef.current;
      const latestTask = latestData?.tasks.find((item) => item.id === taskId);
      if (!latestData || !latestTask) throw new Error(lang === "zh" ? "任务已不存在，未添加子任务" : "This task no longer exists; no subtasks were added.");
      const now = workspaceNow().toISOString();
      const subtasks = appendAiSubtasks(latestTask.subtasks, suggestions, () => uid("subtask"), now);
      const addedCount = subtasks.length - (latestTask.subtasks || []).length;
      if (!addedCount) {
        showToast(lang === "zh" ? "没有新的子任务可添加" : "No new subtasks to add");
        return;
      }
      const existingIds = new Set((latestTask.subtasks || []).map((subtask) => subtask.id));
      const addedIds = subtasks.filter((subtask) => !existingIds.has(subtask.id)).map((subtask) => subtask.id);
      setSubtaskAiRevealIds(addedIds);
      if (subtaskAiRevealTimeoutRef.current !== null) window.clearTimeout(subtaskAiRevealTimeoutRef.current);
      subtaskAiRevealTimeoutRef.current = window.setTimeout(() => {
        setSubtaskAiRevealIds([]);
        subtaskAiRevealTimeoutRef.current = null;
      }, 1500);
      updateTask(taskId, { subtasks });
      showToast(lang === "zh" ? `AI 已添加 ${addedCount} 个子任务` : `AI added ${addedCount} subtasks`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : (lang === "zh" ? "AI 拆解失败，请重试" : "AI breakdown failed. Please retry."));
    } finally {
      setSubtaskAiBusyId("");
    }
  }

  function handleUnscheduledAction(item: UnscheduledTask, action: NonNullable<UnscheduledTask["actions"]>[number]) {
    if (action === "shorten") {
      const task = tasks.find((candidate) => candidate.id === item.taskId);
      if (task) openTaskEdit(task);
      return;
    }
    setAiPlanMenuOpen(false);
    void planMyDay({ scope: action === "split" ? "week" : "3day" });
  }

  /**
   * Cancel all auto-schedule previews. Does NOT touch real data.
   */
  function cancelAutoSchedule() {
    const current = dataRef.current;
    if (current && schedulePreviews.length > 0) void saveData({ ...current, aiProfile: profileWithFeedback(current, "scheduleRejects", schedulePreviews.length) });
    setSchedulePreviews([]);
    setScheduleUnscheduled([]);
    setAutoScheduleState("idle");
    dismissToast();
  }

  /**
   * Cancel a single preview by id. Does NOT touch real data.
   * If the cancelled preview is the last one, return to idle.
   */
  function cancelOnePreview(previewId: string) {
    const currentData = dataRef.current;
    if (currentData) void saveData({ ...currentData, aiProfile: profileWithFeedback(currentData, "scheduleRejects") });
    setSchedulePreviews((current) => {
      const next = current.filter((p) => p.id !== previewId);
      if (next.length === 0) setAutoScheduleState("idle");
      return next;
    });
  }

  /**
   * Pure helper used by both per-preview accept and accept-all. Builds a
   * fully-formed real Task instance — the SAME shape that manual drag-to-timeline
   * produces (it is a NEW task with the source as parentTaskId, NOT a mutation
   * of the source task).
   *
   * Returns: the new task, ready to be appended to data.tasks.
   */
  function buildCommittedTask(p: SchedulePreview, source: Task | undefined, nowIso: string): Task {
    return {
      id: p.clonedTaskId,
      title: source?.title || p.title,
      dueDate: source?.dueDate || p.scheduledDate,
      category: source?.category || "personal",
      priority: p.priority,
      importance: p.priority,
      urgency: p.priority,
      notes: source?.notes || "",
      goalId: source?.goalId || "",
      completed: false,
      projectId: source?.projectId || p.projectId,
      parentTaskId: p.sourceTaskId,
      estimatedHours: p.durationMinutes / 60,
      scheduledDate: p.scheduledDate,
      scheduledStart: p.scheduledStart,
      scheduledEnd: p.scheduledEnd,
      plannedForDate: p.scheduledDate,
      executionLane: undefined,
      order: Date.now(),
      subtasks: source?.subtasks || [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  /**
   * Accept a single preview. Identical to manual-drag behavior:
   * 1. Build a real Task instance (clone of source) with same id as preview
   *    `clonedTaskId`.
   * 2. Append to `tasks`.
   * 3. Remove the source task from 任务 (clear plannedForDate).
   * 4. Remove this preview from previews.
   * 5. Show 5-second undo toast.
   */
  function acceptOnePreview(previewId: string) {
    if (!data) return;
    const preview = schedulePreviews.find((p) => p.id === previewId);
    if (!preview) return;
    const source = data.tasks.find((t) => t.id === preview.sourceTaskId);
    const now = workspaceNow().toISOString();

    // If the clonedTaskId already exists (very rare), don't duplicate
    if (data.tasks.some((t) => t.id === preview.clonedTaskId)) {
      setSchedulePreviews((current) => current.filter((p) => p.id !== previewId));
      showToast(t(lang, "toast.adoptedOne"));
      return;
    }

    const newTask = buildCommittedTask(preview, source, now);
    const tasksAfter = data.tasks.map((t) => {
      if (t.id === preview.sourceTaskId && t.plannedForDate) {
        return { ...t, plannedForDate: undefined, executionLane: undefined, updatedAt: now };
      }
      return t;
    });
    tasksAfter.push(newTask);

    void saveTaskOperation({ ...data, tasks: tasksAfter, aiProfile: profileWithFeedback(data, "scheduleAccepts") }, "schedule", {source:"ai",
      title: newTask.title,
      toast: t(lang, "toast.adoptedOne"),
    });
    setSchedulePreviews((current) => {
      const next = current.filter((p) => p.id !== previewId);
      if (next.length === 0) setAutoScheduleState("idle");
      return next;
    });
    requestTimelineFocus({
      date: preview.scheduledDate,
      startTime: preview.scheduledStart,
      taskId: preview.clonedTaskId,
      source: "autoschedule",
    });
  }

  /**
   * Accept ALL previews. Same per-preview logic but batched:
   * 1. Build all N real task instances in one pass.
   * 2. Append to `tasks` atomically.
   * 3. Remove all source tasks from 任务.
   * 4. Clear all previews.
   * 5. Show 5-second undo toast.
   */
  function acceptAllPreviews() {
    if (!data || autoScheduleState === "committing") return;
    const active = schedulePreviews;
    if (active.length === 0) return;
    setAutoScheduleState("committing");

    const now = workspaceNow().toISOString();
    const existingIds = new Set(data.tasks.map((t) => t.id));
    const toAdd: Task[] = [];
    const sourceIdsToClear: string[] = [];
    for (const p of active) {
      if (existingIds.has(p.clonedTaskId)) continue;
      const source = data.tasks.find((t) => t.id === p.sourceTaskId);
      toAdd.push(buildCommittedTask(p, source, now));
      sourceIdsToClear.push(p.sourceTaskId);
    }

    const tasksAfter = data.tasks.map((t) => {
      if (sourceIdsToClear.includes(t.id) && t.plannedForDate) {
        return { ...t, plannedForDate: undefined, executionLane: undefined, updatedAt: now };
      }
      return t;
    });
    tasksAfter.push(...toAdd);

    // DEV invariant check
    if (import.meta.env.DEV) {
      const expectedAdd = toAdd.length;
      const actualAdd = tasksAfter.length - data.tasks.length;
      // eslint-disable-next-line no-console
      console.assert(expectedAdd === actualAdd, `[autoSchedule] commit invariant violated: expected +${expectedAdd}, got +${actualAdd}`);
      // eslint-disable-next-line no-console
      console.log("[autoSchedule] commit-all", {
        committedCount: toAdd.length,
        tasksBefore: data.tasks.length,
        tasksAfter: tasksAfter.length,
        committedIds: toAdd.map((t) => t.id),
        clearedSourceTaskIds: sourceIdsToClear,
      });
    }

    void saveTaskOperation({ ...data, tasks: tasksAfter, aiProfile: profileWithFeedback(data, "scheduleAccepts", toAdd.length) }, "schedule", {source:"ai",
      titles: toAdd.map(({ title }) => title),
      toast: t(lang, "toast.adoptedMany").replace("%COUNT%", String(toAdd.length)),
    });
    setSchedulePreviews([]);
    setAutoScheduleState("idle");
    if (toAdd[0]?.scheduledDate) {
      requestTimelineFocus({
        date: toAdd[0].scheduledDate,
        startTime: toAdd[0].scheduledStart,
        taskId: toAdd[0].id,
        source: "autoschedule",
      });
    }
  }

  function previewConflict(preview: SchedulePreview) {
    const start = timeToMinutes(preview.scheduledStart);
    const end = timeToMinutes(preview.scheduledEnd);
    return scheduledTasks.some((task) => {
      if (task.fixedCourse) return false;
      const a = timeToMinutes(task.scheduledStart);
      const b = timeToMinutes(task.scheduledEnd);
      return start < b && end > a;
    });
  }

  function shiftTimeline(direction: -1 | 1) {
    void runMotionTransition(() => {
      flushSync(() => setSelectedDate((date) => {
        if (timelineView === "3day") return addDays(date, direction * 3);
        if (timelineView === "weekly") return addDays(date, direction * 7);
        if (timelineView === "month") return addMonths(date, direction);
        return addDays(date, direction);
      }));
    }, { direction: direction < 0 ? "backward" : "forward", scope: "timeline", updates: "all" });
  }

  function selectShelfView(id: string) {
    setShelfViewId(id);
    setShelfMenuOpen(false);
    if (shelfMenuOpen && onboardingStage(settingsRef.current) === "views") {
      void saveSettings({ workspaceGuideStep: "plugins" });
    }
    shelfTitleRef.current?.focus({ preventScroll: true });
  }

  function openTreeView() {
    if (!treeView) return;
    preloadPlanningView();
    selectShelfView(treeView.id);
    setCandidatePanelCollapsed(false);
    setFullscreen(false);
    if (mobileExecution) setCandidateDrawerOpen(true);
    else setCompactExecuteView("tasks");
  }

  function showTimelineWorkspace() {
    setCompactExecuteView("schedule");
    if (mobileExecution && candidateDrawerOpen) closeCandidateDrawer();
  }

  function openMetrics() {
    rememberLayerTrigger("utility");
    showWorkspacePanel({ kind: "metrics", owner: extensionSnapshot.views.find((view) => view.nativeMode === "metrics")?.owner }, true);
  }

  function currentTimelineViewportFocus() {
    const scrollElement = timelineRef.current;
    if (!scrollElement || timelineView === "month") return { date: timelineWindowAnchorDate, startTime: "09:00" };
    const dayHeight = (24 * 60 / SLOT_MINUTES) * timelineSlotHeight;
    const centerY = scrollElement.scrollTop + scrollElement.clientHeight / 2;
    const minutesIntoBand = ((centerY % dayHeight) + dayHeight) % dayHeight / timelineSlotHeight * SLOT_MINUTES;
    const exactMinutes = dayStartHour * 60 + minutesIntoBand;
    const minutes = Math.floor(exactMinutes);
    const viewportY = scrollElement.getBoundingClientRect().top + scrollElement.clientHeight / 2
      - (exactMinutes - minutes) / SLOT_MINUTES * timelineSlotHeight;
    let date = continuousTimelineEnabled
      ? getContinuousTimelineDateForOffset(continuousTimelineStartDate, Math.floor(centerY / dayHeight), timelineColumnCount)
      : timelineWindowAnchorDate;
    if (continuousTimelineEnabled && timelineColumnCount === 1 && exactMinutes >= 24 * 60) date = addDays(date, 1);
    return { date, startTime: minutesToTime(minutes), viewportY };
  }

  function goToNow() {
    const now = workspaceNow();
    const nowDate = todayIso();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    nowReturnOriginRef.current = timelineView === "month" ? null : currentTimelineViewportFocus();
    nowReturnNavigationRef.current = true;
    continuousPrependLockRef.current = false;
    continuousScrollRestoreRef.current = null;
    if (nowReturnSettleTimerRef.current !== null) window.clearTimeout(nowReturnSettleTimerRef.current);
    nowReturnScrollEndCleanupRef.current?.();
    nowReturnScrollEndCleanupRef.current = null;
    setSelectedDate(nowDate);
    setVisibleTimelineDate(nowDate);
    setCompactExecuteView("schedule");
    setMobileDatePickerOpen(false);
    setTimelineView("daily");
    setPendingTimelineFocus({ date: nowDate, startTime: nowTime, source: "now", behavior: "smooth" });
    if (nowLineReturnPulseTimerRef.current !== null) window.clearTimeout(nowLineReturnPulseTimerRef.current);
    setNowLineReturnPulse(true);
    nowLineReturnPulseTimerRef.current = window.setTimeout(() => {
      setNowLineReturnPulse(false);
      nowLineReturnPulseTimerRef.current = null;
    }, 1400);
  }

  function openSettingsHome(toggle = false) {
    rememberLayerTrigger("utility");
    setSettingsSectionTarget(undefined);
    showWorkspacePanel({ kind: "settings" }, toggle);
  }

  function openSettingsSection(section: SettingsTargetInput, toggle = false) {
    if (productDemo) return;
    rememberLayerTrigger("utility");
    const target = normalizeSettingsTarget(section);
    setSettingsSectionTarget(target);
    const owner = extensionSnapshot.settingsPages.find((page) => page.id === target.pluginPage)?.owner;
    showWorkspacePanel({ kind: "settings", owner }, toggle);
  }

  function closeUtilityPanel(afterClose?: () => void) {
    const closingPanel = workspacePanel;
    requestLayerClose("utility", ".df-utility-backdrop, .df-utility-panel", () => {
      setWorkspacePanel((current) => current === closingPanel ? null : current);
      if (onboardingSettings) {
        setOnboardingSettings(undefined);
        void saveSettings({ workspaceGuideStep: onboardingSettings === "plugins" ? "integrations" : "start" });
      }
      afterClose?.();
    });
  }

  function toggleTimerShortcut() {
    if (widgetTimerRuntime.mode === "pomodoro") {
      handleWidgetAction({ type: "toggleWidgetTimer" });
      return;
    }
    if (timerTaskId) {
      if (timerRunning) pauseTimer();
      else resumeTimer();
      return;
    }
    if (headerTask) {
      startTimer(headerTask.id);
      return;
    }
    showToast(lang === "zh" ? "没有可计时的任务" : "No task is ready to track");
  }

  function chooseCommand(result: CommandSearchResult) {
    setCommandOpen(false);
    setCommandQuery("");
    if (result.focusTarget) {
      showTimelineWorkspace();
      setSelectedDate(result.focusTarget.date);
      setTimelineView("daily");
      requestTimelineFocus({
        date: result.focusTarget.date,
        startTime: result.focusTarget.time,
        taskId: result.focusTarget.recordId || result.focusTarget.taskId,
        source: "schedule",
      });
      return;
    }
    if (result.kind === "setting") {
      openSettingsSection(result.settingsTarget || "general");
      return;
    }
    if (result.kind === "task") {
      const taskId = result.id.replace("task:", "");
      const task = tasks.find((item) => item.id === taskId);
      if (task) openTaskEdit(task);
      return;
    }
    if (result.kind === "project") {
      const projectId = result.id.replace("project:", "");
      const project = projects.find((item) => item.id === projectId);
      if (project) openProjectEdit(project);
      return;
    }
    if (result.kind === "habit") {
      const habitId = result.id.replace("habit:", "");
      const scheduled = (dataRef.current?.habitDailyStates || []).find((item) => item.habitId === habitId && item.date === today && item.timelineRecordId);
      if (scheduled?.timelineRecordId) {
        focusHabitSchedule(scheduled.timelineRecordId);
        return;
      }
      const now = workspaceNow();
      const rounded = Math.floor((now.getHours() * 60 + now.getMinutes()) / SLOT_MINUTES) * SLOT_MINUTES;
      scheduleHabitAt(habitId, today, minutesToTime(rounded));
    }
  }

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const shortcut = matchShortcut(event);
      if (!shortcut) return;
      if ((drawerOpen || aiOpen || utilityPanel || habitPanel) && shortcut.id !== "command-search" && shortcut.id !== "help") return;
      event.preventDefault();
      switch (shortcut.id) {
        case "command-search":
          setCommandOpen(true);
          setCommandQuery("");
          break;
        case "help":
          openSettingsSection("shortcuts");
          break;
        case "new-task":
          openAdd("task");
          break;
        case "today":
          goToNow();
          break;
        case "previous-date":
          shiftTimeline(-1);
          break;
        case "next-date":
          shiftTimeline(1);
          break;
        case "execute":
          showTimelineWorkspace();
          break;
        case "day-view":
          changeTimelineView("daily");
          break;
        case "three-day-view":
          changeTimelineView("3day");
          break;
        case "week-view":
          changeTimelineView("weekly");
          break;
        case "month-view":
          changeTimelineView("month");
          break;
        case "timer-toggle":
          toggleTimerShortcut();
          break;
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [drawerOpen, aiOpen, utilityPanel, habitPanel, timelineView, timerTaskId, timerRunning, headerTask, lang, today]);

  const hasOpenEditor = Boolean(drawerOpen || quickAddOpen || allDayQuickAdd || monthQuickAdd || aiOpen || workspacePanel
    || habitPanel || dialog.host || drag || dragCreate || dragOverlay || mobilePlacement || scheduleTemplateOpen);
  const parkedScrollRef = useRef<{ month?: { date: string; top: number }; shelf?: number } | null>(null);
  useLayoutEffect(() => {
    const saved = parkedScrollRef.current;
    if (!saved || workspaceSuspended) return;
    parkedScrollRef.current = null;
    if (saved.month?.date === selectedDate && monthScrollRef.current) monthScrollRef.current.scrollTop = saved.month.top;
    const shelf = candidatePanelRef.current?.querySelector<HTMLElement>(".df-candidate-list");
    if (saved.shelf !== undefined && shelf) shelf.scrollTop = saved.shelf;
  }, [selectedDate, workspaceSuspended]);
  useEffect(() => {
    if (!trayIdle || !workspaceLoaded || hasOpenEditor) {
      setWorkspaceParked(false);
      return;
    }
    let retry: number | undefined;
    const park = () => {
      if (pendingDataSaveRef.current || pendingSettingsSaveRef.current || dataSaveInFlightRef.current
        || settingsSaveInFlightRef.current || document.querySelector('[aria-modal="true"]')) {
        retry = window.setTimeout(park, 5_000);
        return;
      }
      parkedScrollRef.current = {
        month: monthScrollRef.current ? { date: selectedDate, top: monthScrollRef.current.scrollTop } : undefined,
        shelf: candidatePanelRef.current?.querySelector<HTMLElement>(".df-candidate-list")?.scrollTop,
      };
      setWorkspaceParked(true);
    };
    park();
    return () => { if (retry !== undefined) window.clearTimeout(retry); };
  }, [trayIdle, workspaceLoaded, hasOpenEditor, selectedDate]);

  if (workspaceSuspended) return null;

  function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  if (isOAuthConsentRoute && authState?.mode === "cloud" && authState.user) {
    return <Suspense fallback={<ExecuteSkeleton />}><OAuthConsentPageLazy /></Suspense>;
  }
  if (isOAuthConsentRoute && !new URLSearchParams(window.location.search).get("authorization_id")) {
    return <Suspense fallback={<ExecuteSkeleton />}><OAuthConsentPageLazy /></Suspense>;
  }

  if (!isWorkspaceRoute || (authState?.mode === "cloud" && !authState.user)) {
    if (isWorkspaceRoute && window.desktopApi) {
      return <Suspense fallback={<ExecuteSkeleton />}><AuthGate
        lang={lang}
        busy={authBusy}
        error={authError}
        notice={authNotice}
        onSubmit={(email, password, displayName, intent, privacyAccepted) => (
          handleAuthSubmit(email, password, displayName, intent, "dark", privacyAccepted)
        )}
        onResend={resendConfirmation}
        onContinueAfterConfirm={continueAfterConfirm}
        onForgotPassword={sendPasswordResetEmail}
      /></Suspense>;
    }
    return <Suspense fallback={<ExecuteSkeleton />}>
      <LandingPageLazy initialShowAuth={isWorkspaceRoute} signedIn={Boolean(authState?.user)} busy={authBusy} error={authError} notice={authNotice} onLogin={handleAuthSubmit} onResend={resendConfirmation} onContinueAfterConfirm={continueAfterConfirm} onForgotPassword={sendPasswordResetEmail} />
    </Suspense>;
  }

  const unusableCloudCache = !data || !settings
    || onboardingStage(settings) !== "done";
  if (authState?.mode === "cloud" && authState.user && authError && unusableCloudCache) {
    return <CloudWorkspaceError
      lang={lang}
      message={authError}
      busy={authBusy}
      onRetry={() => {
        setAuthBusy(true);
        setAuthError("");
        void loadInitial().finally(() => setAuthBusy(false));
      }}
      onSignOut={() => void handleSignOut()}
    />;
  }

  if (!data || !settings) return <ExecuteSkeleton />;

  const localAiConfig = productDemo ? { provider: "deepseek" as const, model: settings.model, apiKey: "", baseUrl: "" } : readLocalAiProviderConfig();
  const aiPanelModels = Array.from(new Set([
    localAiConfig.model,
    ...AI_PROVIDER_MODELS[localAiConfig.provider].map((option) => option.id),
  ].filter(Boolean)));
  const onboardingStep = !productDemo && cloudBaselineReadyRef.current ? onboardingStage(settings) : "done";
  if (onboardingStep === "setup") {
    return <Suspense fallback={<ExecuteSkeleton />}><WorkspaceSetup key={loadedWorkspaceKeyRef.current} settings={settings} lang={lang} onContinue={(preferences) => {
      if (onboardingStage(settingsRef.current) !== "setup") return;
      if (preferences?.defaultTimelineView) setTimelineView(preferences.defaultTimelineView);
      void saveSettings({ ...preferences, ...ONBOARDING_ADD });
      if (compactLayout) openQuickTaskAdd();
    }} /></Suspense>;
  }
  const habits = data.habits || [];
  const habitDailyStates = data.habitDailyStates || [];
  const hasActiveHabits = habitsEnabled && habits.some((habit) => !habit.archived);
  const draggedTask = drag
    ? drag.shelfTask || tasks.find((task) => task.id === drag.taskId)
      || explicitVisibleTimeline.tasks.find((task) => task.id === drag.taskId)
      || recordToTaskMap.get(drag.taskId)
      || eventVisibleTimeline.tasks.find((task) => task.id === drag.taskId)
      || (drag.taskId.startsWith("habit:")
        ? (() => {
            const habit = habits.find((item) => habitDragTaskId(item.id) === drag.taskId);
            return habit ? habitDragTask(habit, timelineDate) : undefined;
          })()
        : undefined)
    : undefined;
  const timelineSnapActive = Boolean(draggedTask && (allDayDragDate || (hoverSlot && !drag?.outsideTimeline)));
  const showNotificationBadge = settings?.showInAppNotificationBadge !== false;
  const focusProvider = focusOverlayMode ? getTimerMode(focusOverlayMode) : undefined;
  const focusIsPomodoro = focusOverlayMode === "pomodoro" && Boolean(focusProvider);
  const focusNow = Date.now();
  const focusSessionStarted = focusIsPomodoro && focusSessionTaskId !== undefined;
  const pomodoroTarget = focusIsPomodoro && !focusSessionStarted ? resolvePomodoroTask(tasks, focusNow, pomodoroTaskChoice) : undefined;
  const focusSelection = focusProvider && !focusIsPomodoro ? resolveWidgetTimelineSelection(tasks, focusNow) : undefined;
  const focusTask = focusIsPomodoro
    ? focusSessionStarted ? tasks.find(task => task.id === focusSessionTaskId) : pomodoroTarget?.task
    : focusProvider ? widgetTimerRuntime.unlinked ? null : timerTask || (focusSelection?.state === "active" ? focusSelection.task : null) : timerTask || headerTask;
  const focusProject = focusTask?.projectId ? projects.find(project => project.id === focusTask.projectId) : undefined;
  const focusElapsed = timerTask ? timerElapsed : 0;
  const focusRuntime = focusIsPomodoro && !focusSessionStarted
    ? preparePomodoroRuntime(focusNow, widgetTimerPreferences, pomodoroTarget?.scheduleEndAt)
    : widgetTimerRuntime;
  const focusTick = focusProvider ? advanceWidgetTimer(focusRuntime, widgetTimerPreferences, focusNow) : null;
  const focusClockDisplay = formatTimerDisplay(focusTick ? focusTick.displaySeconds : focusElapsed).padStart(5, "0");
  const flowBreakMinutes = Math.max(5, Math.round(Math.max(focusElapsed / 60, 25) / 5));
  const focusModeNote = focusOverlayMode === "flowtime"
    ? (lang === "zh" ? `已专注 ${Math.floor(focusElapsed / 60)} 分钟，建议休息 ${flowBreakMinutes} 分钟` : `Focused ${Math.floor(focusElapsed / 60)}m, suggested break ${flowBreakMinutes}m`)
    : focusProvider?.label[lang];
  const chooseFocusMode = (mode: string) => {
    const chosen = (mode === "flowtime" && flowtimeEnabled) || mode === "stopwatch" || getTimerMode(mode) ? mode : "stopwatch";
    setFocusOverlayMode(chosen);
    const timerMode = chosen === "flowtime" ? "stopwatch" : chosen;
    if (widgetTimerRuntimeRef.current.mode !== timerMode) {
      const wasRunning = timerRunning || widgetTimerRuntimeRef.current.running;
      handleWidgetAction({ type: "setTimerMode", mode: timerMode });
      if (wasRunning) handleWidgetAction({ type: "toggleWidgetTimer" });
    }
  };
  const startCandidatePanelResize = (event: React.PointerEvent<HTMLElement>) => {
    if (productAiPresentation || compactLayout || candidatePanelCollapsed || event.button) return;
    event.preventDefault();
    event.stopPropagation();
    const panel = event.currentTarget.closest<HTMLElement>(".df-candidate-panel");
    const shell = document.querySelector<HTMLElement>(".df-execute:not(.df-template-shell)");
    if (!panel || !shell) return;
    const startX = event.clientX;
    const startWidth = panel.getBoundingClientRect().width;
    const maxWidth = Math.max(360, Math.min(560, shell.getBoundingClientRect().width - 390));
    const move = (pointerEvent: PointerEvent) => setCandidatePanelWidth(Math.round(Math.min(maxWidth, Math.max(360, startWidth + pointerEvent.clientX - startX))));
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
  };

  const demoHasSchedule = Boolean(productDemo) && tasks.some(task => task.timelineRecords?.some(record => record.executionStatus === "scheduled"));
  const demoCanUndo = aiMessages.some(message => message.actionState === "adopted");
  const demoTodayTasks = productDemo ? tasks.filter(task => task.plannedForDate === productDemo.date && !task.completed) : [];
  const demoPlanButton = productDemo && <Button variant="ghost" disabled={demoPresetBusy || !demoTodayTasks.some(task => !task.scheduledStart && !task.timelineRecords?.some(record => record.executionStatus === "scheduled"))} onClick={() => void runProductDemoPreset()}>{demoPresetBusy ? (lang === "zh" ? "正在安排…" : "Arranging…") : (lang === "zh" ? "帮我安排今天" : "Plan my day")}</Button>;
  const demoAiControls = productDemo ? <div className="df-product-ai-presets">
    {!productAiPresentation && demoPlanButton}
    {!productAiPresentation && !demoHasSchedule && !demoPresetBusy && <div className="df-product-ai-candidates">{demoTodayTasks.map(task => <TaskBlock key={task.id} variant="candidate" projectColor={projects.find(project => project.id === task.projectId)?.color}><TaskBlockRow><TaskBlockContent title={task.title} /><TaskBlockDuration>{formatMinutes(Math.round((task.estimatedHours || .5) * 60))}</TaskBlockDuration></TaskBlockRow></TaskBlock>)}</div>}
    {demoCanUndo && <div className="df-product-ai-requests">
      <Button variant="ghost" disabled={demoPresetBusy} aria-expanded={demoReschedulesOpen} aria-controls="product-ai-reschedules" onClick={() => setDemoReschedulesOpen(open => !open)}>{lang === "zh" ? "帮我改期" : "Reschedule a task"}</Button>
      <UndoButton disabled={demoPresetBusy} onClick={() => void runProductDemoPreset("undo")}>{t(lang, "toast.undo")}</UndoButton>
    </div>}
    {demoReschedulesOpen && <div id="product-ai-reschedules" className="df-product-ai-reschedules" role="group" aria-label={lang === "zh" ? "选择改期" : "Choose a reschedule"}>
      {([{ taskId: "content", days: 1 }, { taskId: "layout", days: 2 }, { taskId: "walk", days: 1 }] as const).map(choice => <Button key={choice.taskId} variant="ghost" disabled={demoPresetBusy || tasks.find(task => task.id === choice.taskId)?.completed} onClick={() => void runProductDemoPreset(choice)}>{tasks.find(task => task.id === choice.taskId)?.title}<span>{lang === "zh" ? (choice.days === 1 ? "明天" : "后天") : (choice.days === 1 ? "Tomorrow" : "In two days")}</span></Button>)}
    </div>}
  </div> : undefined;
  const workspaceChatPanel = !productPresentation;
  const closeWorkspaceChat = () => { cancelAi(); setAiOpen(false); clearAiAttachment(); };
  const aiPanel = aiEnabled && aiPresence.present && (aiOpen || !workspacePanel) && <AiPanel workspace={workspaceChatPanel} closing={aiPresence.closing} demoControls={demoAiControls} docked={aiDocked} onDock={setAiDocked} model={settings.model} models={aiPanelModels} onModelChange={(model) => void saveSettings({ model, reasoningMode: "instant" })} safetyLevel={settings.aiSafetyLevel || "approve"} onSafetyLevelChange={(aiSafetyLevel) => void saveSettings({ aiSafetyLevel })} input={aiInput} setInput={setAiInput} busy={aiBusy || demoPresetBusy} onSend={(message?: string) => sendAi(message)} onCancel={cancelAi} onClose={closeWorkspaceChat} messages={aiMessages} conversations={data.aiConversations || []} activeConversationId={activeAiConversationId || data.activeAiConversationId || ""} conversationListOpen={aiConversationListOpen} onToggleConversationList={() => { setAiAuditOpen(false); setAiConversationListOpen((open) => !open); }} auditOpen={aiAuditOpen} auditRuns={aiAuditRuns} auditLoading={aiAuditLoading} auditError={aiAuditError} onToggleAudit={() => void toggleAiAuditHistory()} onNewConversation={() => void startNewAiConversation()} onSelectConversation={selectAiConversation} onRenameConversation={(conversationId, title) => void renameAiConversation(conversationId, title)} onToggleConversationPinned={(conversationId) => void toggleAiConversationPinned(conversationId)} onDeleteConversation={(conversationId) => void deleteAiConversation(conversationId)} memoryNotice={aiMemoryNotice} onOpenMemorySettings={() => openSettingsSection({ category: "advanced", detail: "ai", anchor: "ai-memory" })} actionPatches={aiActionPatches} onPatchAction={(messageId, index, patch) => setAiActionPatches((current) => ({ ...current, [messageId]: { ...(current[messageId] || {}), [index]: { ...(current[messageId]?.[index] || {}), ...patch } } }))} onConfirmAction={(messageId, action, index) => void confirmAiAction(action, messageId, index)} onDismissAction={(messageId, action, index) => dismissAiAction(action, messageId, index)} onToggleAction={(messageId, index) => setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, selectedActions: { ...message.selectedActions, [index]: message.selectedActions?.[index] === false } } : message))} onSetAllActions={(messageId, checked) => setAiMessages((current) => current.map((message) => message.id === messageId ? { ...message, selectedActions: Object.fromEntries((message.actions || []).map((_, index) => [index, checked])) } : message))} onAdoptSelected={(messageId) => void adoptSelectedAiActions(messageId)} onRejectSelected={rejectSelectedAiActions} onViewImport={viewAiImport} onUndoImport={(messageId) => void undoAiImport(messageId)} onApproveAgent={(messageId) => void handleAgentDecision(messageId, "approve")} onRejectAgent={(messageId) => void handleAgentDecision(messageId, "reject")} onUndoAgent={(messageId) => void handleAgentDecision(messageId, "undo")} globalAgentAvailable={authState?.mode === "cloud" && Boolean(authState.user)} projectList={projects.map((p) => ({ id: p.id, title: p.title, color: p.color }))} taskList={tasks.map((task) => ({ id: task.id, title: task.title }))} lang={lang} attachment={aiAttachment} attachmentStatus={aiAttachmentStatus} onAttachment={(file) => void handleAiAttachment(file)} onClearAttachment={clearAiAttachment} />;

  const planningViewProps = {
    lang, data, projects, compact: compactLayout, collapsed: collapsedBranches, setCollapsed: setCollapsedBranches,
    onProjectEdit: openProjectEdit, onProjectComplete: completeProject, onTaskEdit: openTaskEdit,
    onProjectCreate: () => openAdd("project"), onOpenTimeline: () => closeUtilityPanel(showTimelineWorkspace),
    onTaskUpdate: updateTask, onTaskCreate: createTaskInProject, onTaskDelete: deleteTaskById, onDeleteSubtask: deleteSubtaskById,
    onDataChange: (next: PlannerData) => void saveData(next),
    onTreeMove: movePlanningTreeNode,
    engagementEnabled: engagementEnabled,
  };
  const scheduleViewProps = {
    onScheduleTask: openShelfTaskPlacement,
    onScheduleSubtask: openShelfSubtaskPlacement,
    onTouchScheduleDrag: mobileExecution ? beginViewTouchScheduleDrag : undefined,
    onTimelineDrag: previewShelfTimelineDrop,
    onTimelineDrop: commitShelfTimelineDrop,
  };
  const renderCandidateTask = (task: Task) => { return <div key={task.id}
                  className={`df-candidate-task-row${completingTaskIds.has(task.id) ? " is-completing" : ""}`}
                  ref={onboardingTask?.id === task.id ? onboardingTaskRowRef : undefined}
                  data-candidate-task-id={isEventDisplayTask(task) ? undefined : task.id}
                  onClickCapture={(event) => {
                    if (!(event.target as HTMLElement).closest(".df-candidate-row .df-block-check")) return;
                    event.stopPropagation();
                    toggleCandidateTaskDone(task);
                  }}
                >
                  {<TaskCard demo={Boolean(productDemo)} task={task} scheduleButtonRef={guidePlanButtonVisible && onboardingTask?.id === task.id ? onboardingPlanButtonRef : undefined} onGuidedSchedule={onboardingTask?.id === task.id ? scheduleGuidedTask : undefined} onFocusSchedule={focusCandidateSchedule} projects={projects} focusDate={today} placementPreview={placementPreview} placementChoices={placementChoices.filter((choice) => choice.taskId === task.id)} isPlacementLocated={locatedPlacementTaskId === task.id} onLocatePlacement={(schedule) => locateCandidatePlacement(task.id, schedule)} onReturnFromPlacementLocation={() => returnFromCandidatePlacement(task.id)} onQuickDuration={(minutes) => updateTask(task.id, { estimatedHours: minutes / 60 })} onProjectChange={(projectId) => updateTask(task.id, { projectId: projectId || undefined })} onDelete={() => deleteTaskById(task.id)} onMobileSchedule={mobileExecution ? () => startMobilePlacement(task.id) : undefined} onStartPlacementPreview={() => { if (!mobileExecution) startPlacementPreview(task.id); }} onCancelPlacementPreview={() => { if (!mobilePlacementRef.current) cancelPlacementPreview(); }} onConfirmPlacementPreview={() => confirmPlacementPreview(task.id)} onConfirmPlacementChoice={confirmPlacementChoice} onScheduleDate={(date) => scheduleCandidateOnDate(task.id, date)} onSaveDueDate={(date) => updateTask(task.id, { dueDate: date, dueDateSource: date ? "manual" : undefined })} onSaveRecurrence={(recurrence) => saveTaskRecurrence(task.id, recurrence)} onClick={() => openTaskEdit(task)} onPointerDragStart={(event) => beginShelfDrag(event, task, "candidate")} onToggleDone={() => toggleTaskDone(task.id)} onToggleSubtask={(subtaskId) => updateTask(task.id, { subtasks: toggleSubtaskInTree(task.subtasks || [], subtaskId) })} onSubtaskDragStart={(event, subtaskId) => beginCandidateSubtaskDrag(event, task, subtaskId)} onMarkUnfinished={() => markCandidateUnfinished(task.id)} onUnschedule={() => unscheduleTask(task.id)} onMetaUpdate={(patch) => updateTask(task.id, patch)} dragState={drag?.source === "candidate" && drag.taskId === task.id ? "source-placeholder" : undefined} lang={lang} />}
                </div>; };
  const shelfTitle = term(lang, "todayCandidates");
  const readingTaskIds = new Set(reading.library?.taskLinks.map(link => link.taskId) ?? []);
  const readingCandidates = readingEnabled ? visibleCandidates.filter(task => readingTaskIds.has(task.id)) : [];
  const ordinaryCandidates = readingEnabled ? visibleCandidates.filter(task => !readingTaskIds.has(task.id)) : visibleCandidates;
  const readingView = shelfViews.find(view => view.owner === "official:reading");
  const openReading = () => { if (readingView) selectShelfView(readingView.id); };
  async function createReadingTask(bookId: string) {
    const scope = loadedWorkspaceKeyRef.current;
    const current = dataRef.current;
    if (!current || !readingEnabled) throw new Error("Reading unavailable");
    const { prepareReadingTask } = await import("./reading/model");
    const task = await prepareReadingTask(reading.mutate, bookId, uid("task"), today, workspaceNow().toISOString(), lang);
    const latest = dataRef.current;
    if (!latest || scope !== loadedWorkspaceKeyRef.current || !nativeFeatureActive(extensionService.getSnapshot(), "reading")) throw new Error("Workspace changed");
    await saveTaskOperation({ ...latest, tasks: [...latest.tasks, task] }, "create", {
      title: task.title, toast: lang === "zh" ? "已添加阅读任务" : "Reading task added",
    });
  }
  const candidatesEmpty = ordinaryCandidates.length === 0 && !hasActiveHabits && !readingEnabled;
  const renderOrdinaryCandidates = (candidates: readonly Task[]) => (candidates.length === 0 && candidatesEmpty ? (
                productDemo ? (
                  <div className="df-empty"><div className="blob-accent" /><strong>{productAiPresentation && demoHasSchedule ? (lang === "zh" ? "今天，已经安排好了。" : "Your day is arranged.") : t(lang, "candidate.demoEmptyTitle")}</strong></div>
                ) : (
                  <EmptyState announce title={todayHasBlocks ? (lang === "zh" ? "待安排的任务已清空" : "You’re caught up on scheduling") : t(lang, "candidate.emptyTitle")}>
                    <Button variant="primary" onClick={todayHasBlocks ? () => { setSelectedDate(today); showTimelineWorkspace(); } : openTaskDraft}>
                      {todayHasBlocks ? (lang === "zh" ? "查看时间轴" : "View timeline") : t(lang, "planning.addTask")}
                    </Button>
                  </EmptyState>
                )
              ) : groupByProject ? (
                (() => {
                  const candidatesByProject = new Map<string, Task[]>();
                  projects.forEach((project) => candidatesByProject.set(String(project.id), []));
                  candidatesByProject.set("__unassigned__", []);
                  candidates.forEach((task) => {
                    const gid = task.projectId || "__unassigned__";
                    if (!candidatesByProject.has(gid)) candidatesByProject.set(gid, []);
                    candidatesByProject.get(gid)!.push(task);
                  });
                  const groups = [...candidatesByProject].filter(([, tasks]) => tasks.length > 0);
                  return groups.map(([gid, tasks]) => {
                    const project = gid === "__unassigned__" ? null : projects.find(p => String(p.id) === String(gid));
                    const projectColor = project?.color || "var(--accent-active)";
                    const projectTitle = project?.title || t(lang, "candidate.unassigned");
                    return (
                      <div
                        key={gid}
                        className="df-project-group"
                        data-candidate-project-id={gid === "__unassigned__" ? "" : gid}
                      >
                        <div className="df-project-group-header">
                          <span className="df-project-group-dot" style={{ background: projectColorInk(projectColor) }} />
                          <span className="df-project-group-name">{projectTitle}</span>
                          {!productAiPresentation && <span className="df-project-group-actions">
                            <IconButton
                              className="df-project-group-action"
                              icon={<UiCalendarCheckIcon size={16} />}
                              label={lang === "zh" ? `智能安排「${projectTitle}」的全部任务` : `Schedule all tasks in “${projectTitle}”`}
                              disabled={autoScheduleState === "generating" || autoScheduleState === "committing"}
                              onClick={() => void planMyDay(undefined, tasks)}
                            />
                            <IconButton
                              className="df-project-group-action"
                              icon={<UiPlusIcon size={17} />}
                              label={lang === "zh" ? `为「${projectTitle}」快速添加任务` : `Quick add a task to “${projectTitle}”`}
                              onClick={() => focusQuickAddForProject(gid)}
                            />
                          </span>}
                        </div>
                        {tasks.map(renderCandidateTask)}
                      </div>
                    );
                  });
                })()
              ) : candidates.map(renderCandidateTask));
  const teachingSchedule = onboardingStep === "schedule" || onboardingStep === "plan";
  const trackedTask = teachingSchedule || onboardingStep === "return" ? onboardingTarget(settings, tasks) : undefined;
  const onboardingTask = trackedTask && isOnboardingTask(trackedTask) ? trackedTask : undefined;
  const savedGuideBlock = onboardingStep === "plan" ? onboardingBlock(onboardingTask, false) : undefined;
  const shelfPaneVisible = !fullscreen
    && (mobileExecution ? candidateDrawerOpen : !candidatePanelCollapsed && (!compactLayout || narrowSplitLayout || compactExecuteView === "tasks"));
  const taskPaneVisible = shelfPaneVisible && !shelfView;
  const canCollapseCandidatePanel = !compactLayout && !mobileExecution;
  const guideRowVisible = taskPaneVisible && Boolean(onboardingTask && visibleCandidates.some((task) => task.id === onboardingTask.id));
  const tasksGuideAnchor = mobileExecution && !candidateDrawerOpen ? candidateTriggerRef
    : candidatePanelCollapsed ? candidateExpandRef : shelfPaneVisible ? shelfTitleRef : undefined;
  const returnGuideRecord = onboardingStep === "return" ? onboardingBlock(onboardingTask, false) : undefined;
  const returningGuideBlock = Boolean(returnGuideRecord && drag?.kind === "block" && returnGuideRecord.id === resolveTimelineRecordId(drag.taskId));
  const returnToTasksButton = mobileExecution && !candidateDrawerOpen;
  const returnDropAnchor = returnToTasksButton ? candidateTriggerRef : candidatePanelRef;
  const returnGuideAnchorFor = (task: Task) => returnGuideRecord && task.scheduledDate === returnGuideRecord.scheduledDate
    && resolveTimelineRecordId(task.id) === returnGuideRecord.id ? onboardingReturnBlockRef : undefined;
  const guideSlot = onboardingStep === "schedule" && drag?.source === "candidate" && drag.taskId === onboardingTask?.id
    ? onboardingDropSlot(drag.duration) : undefined;
  const guideSlotHint = guideSlot && <div className="df-onboarding-drop-slot" style={guideSlot.style} aria-hidden="true">
    <span>{lang === "zh" ? "放在这里" : "Drop here"} · {guideSlot.start}–{guideSlot.end}</span>
  </div>;
  const showGuide = !productDemo && !workspacePanel && !drawerOpen && !quickAddPresence.present
    && !commandOpen && !aiOpen && !notificationCenterOpen && !shelfMenuOpen && !mobileDatePickerOpen
    && !dialog.host && !drag && !dragCreate && !mobilePlacement;
  const tourStep = onboardingStep !== "add" && onboardingStep !== "schedule" && onboardingStep !== "done" ? onboardingStep : undefined;
  const tourWaitingForTasks = tourStep === "plan" ? !taskPaneVisible
    : (tourStep === "views" || tourStep === "plugins") && !shelfPaneVisible;
  const guidePlanButtonVisible = tourStep === "plan" && guideRowVisible;
  const tourAnchor = tourStep === "return" ? onboardingReturnBlockRef
    : guidePlanButtonVisible ? onboardingPlanButtonRef
    : tourStep === "integrations" || tourStep === "start" ? undefined : tasksGuideAnchor;

  function onboardingDropSlot(duration: number) {
    if (timelineView === "month") return;
    const { gridEl, scrollEl, visDays } = getDropGridAndDays();
    if (!gridEl || !scrollEl) return;
    const grid = gridEl.getBoundingClientRect();
    const viewport = scrollEl.getBoundingClientRect();
    if (!grid.width || !viewport.height) return;
    const target = hoverSlot && dragTargetDateRef.current
      ? { startTime: hoverSlot, date: dragTargetDateRef.current }
      : resolveDropTarget(grid.left + grid.width / 2, viewport.top + viewport.height * 0.43);
    if (!target) return;
    const columns = timelineView === "daily" ? 1 : timelineColumnCount;
    const offset = continuousTimelineEnabled ? continuousDateOffset(target.date) : visDays.indexOf(target.date);
    if (offset < 0) return;
    const column = offset % columns;
    const width = grid.width / columns;
    const top = continuousTimelineEnabled ? continuousTimedTop(target.date, target.startTime)
      : timeBlockTop(target.startTime, dayStartHour, timelineHourHeight);
    return {
      start: target.startTime,
      end: addMinutes(target.startTime, duration),
      style: { left: column * width + 4, width: Math.max(0, width - 8), top, height: Math.max(20, duration / SLOT_MINUTES * timelineSlotHeight) },
    };
  }

  function scheduleGuidedTask() {
    if (!onboardingTask) return;
    if (!savedGuideBlock && hasActiveTaskSchedule(onboardingTask)) {
      const date = onboardingTask.timelineRecords?.find((record) => record.executionStatus === "scheduled")?.scheduledDate
        || onboardingTask.scheduledDate || today;
      setSelectedDate(date);
      setVisibleTimelineDate(date);
      setTimelineView("daily");
      showTimelineWorkspace();
      return;
    }
    void startMobilePlacement(onboardingTask.id, undefined, true, savedGuideBlock?.id);
  }

  function advanceOnboardingTour(step: OnboardingTourStep) {
    if (tourWaitingForTasks) { revealTasks(); return; }
    switch (step) {
      case "return":
        revealTasks();
        void saveSettings({ workspaceGuideStep: "plan" });
        break;
      case "plan":
        void saveSettings({ workspaceGuideStep: "views" });
        break;
      case "views":
        setShelfMenuOpen(true);
        break;
      case "plugins":
        showTimelineWorkspace();
        void saveSettings({ workspaceGuideStep: "integrations" });
        break;
      case "integrations":
        void saveSettings({ workspaceGuideStep: "start" });
        break;
      case "start":
        showTimelineWorkspace();
        void saveSettings(ONBOARDING_DONE);
        break;
    }
  }

  function openOnboardingSettings(topic: OnboardingSettingsTopic) {
    setOnboardingSettings(topic);
    showTimelineWorkspace();
    openSettingsSection(topic === "ai" ? { category: "ai", anchor: "ai-provider" }
      : topic === "mcp" ? { category: "integrations", anchor: "mcp" }
      : { category: "plugins" });
  }

  function revealTasks() {
    setShelfViewId("");
    setFullscreen(false);
    setCandidatePanelCollapsed(false);
    if (mobileExecution) setCandidateDrawerOpen(true);
    else setCompactExecuteView("tasks");
  }
  function openTaskDraft() {
    if (compactLayout) return openQuickTaskAdd();
    revealTasks();
    window.requestAnimationFrame(() => quickCandidateInputRef.current?.focus());
  }
  const displayedBlocks = [...expandedVisibleTimelineTasks, ...allDayTimelineTasks, ...eventVisibleTimeline.tasks,
    ...(timelineView === "month" ? [] : tasks.filter(isAllDayTask))];
  const todayHasBlocks = displayedBlocks.some((task) => task.scheduledDate === today);
  const timelineRange = getTimelineRangeFor(timelineView, timelineWindowAnchorDate);
  const timelineEmpty = !productDemo && !mobilePlacement && ![...displayedBlocks, ...previewTasks].some((task) => {
    const date = task.scheduledDate || "";
    return timelineView === "month" ? date.startsWith(timelineWindowAnchorDate.slice(0, 7)) : timelineRange.includes(date);
  });
  const switchViewsLabel = lang === "zh" ? "切换左浮栏视图" : "Switch task views";
  const metricsLabel = lang === "zh" ? "指标" : "Metrics";
  const compactOverlayOpen = Boolean(quickAddOpen || candidateDrawerOpen || drawerOpen || mobilePlacement);
  const compactToolbarBlocked = compactOverlayOpen || Boolean(workspacePanel);
  const compactFloatingActionsHidden = compactToolbarBlocked || mobileDatePickerOpen || Boolean(dragCreate?.committed);
  const brandControl = window.desktopApi?.dockWindow
    ? <Suspense fallback={<button className="df-brand-ai-button" type="button" disabled aria-label="NavoPath"><ProductIcon compact /></button>}>
      <DesktopDockControls
        lang={lang}
        side={desktopDockSide}
        trigger={<ProductIcon compact />}
        onSideChange={(side) => { setDesktopDockSide(side); setHoveredBlock(""); setFullscreen(false); }}
        onError={showToast}
      />
    </Suspense>
    : <button className="df-brand-ai-button" type="button" onClick={() => { if (compactLayout && aiEnabled) setAiOpen(true); }} aria-label={compactLayout ? (lang === "zh" ? "打开 Navo AI" : "Open Navo AI") : "NavoPath"} disabled={!compactLayout || !aiEnabled}>
      <ProductIcon compact />
    </button>;
  function toggleTimelineDatePicker() {
    setMobileDatePickerMonth(timelineWindowAnchorDate.slice(0, 7));
    setMobileDatePickerOpen((open) => !open);
  }
  const timelineDatePicker = !productPresentation && (
    <DateQuickPicker
      open={mobileDatePickerOpen && (!compactLayout || !compactToolbarBlocked)}
      month={mobileDatePickerMonth}
      selectedDate={timelineWindowAnchorDate}
      today={today}
      weekStartsOn={settings.weekStartsOn}
      lang={lang}
      onMonthChange={setMobileDatePickerMonth}
      onSelect={(date) => {
        changeTimelineDate(date);
        setMobileDatePickerOpen(false);
      }}
    />
  );
  const compactChat = !productPresentation && aiEnabled && <IconButton className="df-mobile-dock-action df-mobile-ai" label={t(lang, "fab.askNavo")} icon={<UiChatIcon />} aria-pressed={aiOpen} onClick={() => aiOpen ? closeWorkspaceChat() : setAiOpen(true)} />;
  return (
    <div className={`df-app${productDemo ? " product-demo-workspace" : ""} mode-execute theme-${settings.theme} type-${settings.typographyStyle || "editorial"}${fullscreen ? " is-timeline-fullscreen" : ""}${drag ? " is-dragging" : ""}${settings.taskBlockFill ? " task-block-fill" : ""}${aiOpen || utilityPanel ? " is-mobile-sheet-open" : ""}${utilityPanel === "settings" ? " is-settings-open" : ""}${aiOpen && aiDocked && !workspaceChatPanel ? " is-ai-docked" : ""}${desktopDockSide ? " is-desktop-docked" : ""}${quickAddOpen ? " is-compact-quick-add-open" : ""}`} data-workspace-layout={workspaceLayout} data-inline-timeline-draft={inlineTimelineDraft ? "true" : undefined} data-guide-return-drag={returningGuideBlock || undefined} data-phone-execution={mobileExecution ? "true" : undefined} data-mobile-placing={mobilePlacement ? "true" : undefined} data-product-feature={productAiPresentation ? "ai" : undefined} data-product-revealing={productAiPresentation && demoRevealing ? "true" : undefined} data-timeline-view={timelineView} data-task-block-fill={settings.taskBlockFill ? "true" : undefined} style={{ ...themeVars(settings, "execute"), "--timeline-slot-height": `${timelineSlotHeight}px`, "--timeline-hour-height": `${timelineHourHeight}px` } as CSSProperties}>
      {readingEnabled && <Suspense fallback={null}><ReadingRuntimeLazy key={readingAccount} account={readingAccount} onChange={setReadingSnapshot} /></Suspense>}
      {productAiPresentation && !demoGuideDismissed && !demoHasSchedule && !demoPresetBusy && <span className="df-product-click-guide" aria-hidden="true"><span className="df-product-click-guide-motion"><UiCursorIcon className="df-product-click-guide-cursor" size={32} /><UiPointingHandIcon className="df-product-click-guide-hand" size={32} /></span></span>}
      {(!compactLayout || productDemo) && <header className="df-header">
        {productDemo?.navigation?.(<ProductIcon compact />) ?? <div className="df-header-inner">
          <div className="df-brand">
            {brandControl}
            {!productDemo && <Suspense fallback={null}><ExtensionHeader lang={lang} activeOwner={workspacePanel?.owner} historyActive={activeExtensionPanelId === coreHistoryView.id} onHistory={openTaskHistory} onOpenPage={openExtensionPage} /></Suspense>}
          </div>
          {!productDemo && <div className="df-header-right">
          <span className="df-workspace-save-feedback" role="status" aria-live="polite" data-save-phase={savePhase}>
            {isManualSyncing ? t(lang, "sync.syncing") : saveFeedbackLabel(savePhase, lang, authState?.mode === "cloud")}
          </span>
          <button
            className="df-user-avatar"
            type="button"
            onClick={() => { setWorkspacePanelOpen("search", (open) => !open); setCommandQuery(""); }}
            aria-label={lang === "zh" ? "搜索" : "Search"}
          >
            <UiSearchIcon size={20} />
          </button>
          {authState?.mode === "cloud" && <button
            className={`df-user-avatar df-proactive-notification-button${showNotificationBadge && proactiveNotifications.length ? " has-unread" : ""}`}
            type="button"
            onClick={() => setWorkspacePanelOpen("notifications", (open) => !open)}
            aria-label={lang === "zh" ? `主动助理提醒${proactiveNotifications.length ? `，${proactiveNotifications.length} 条未读` : ""}` : `Proactive assistant messages${proactiveNotifications.length ? `, ${proactiveNotifications.length} unread` : ""}`}
            title={lang === "zh" ? "主动助理提醒" : "Proactive assistant messages"}
          >
            <UiBellIcon size={20} />
            <NotificationBadge count={proactiveNotifications.length} enabled={showNotificationBadge} />
          </button>}
          <button className="df-user-avatar" onClick={() => openSettingsHome(true)} aria-label={t(lang, "header.settings")}>
            <UiSettingsIcon size={20} />
          </button>
        </div>}
        </div>}
      </header>}
      <div className="df-header-fade" />
      {compactLayout && quickAddPresence.present && <div className={`df-drawer-backdrop${quickAddPresence.closing ? " is-closing" : ""}`} onMouseDown={() => void closeMobileQuickAdd()} />}
      {compactLayout && quickAddPresence.present && (
        <Suspense fallback={null}><MobileQuickAddSheet
          closing={quickAddPresence.closing}
          lang={lang}
          showTaskExample={onboardingStep === "add"}
          kind={mobileQuickAddKind}
          kinds={!habitsEnabled ? ["task", "project"] : ["task", "project", "habit"]}
          title={quickTitle}
          projects={projects}
          projectId={quickProjectId}
          projectColor={quickProjectColor}
          habitMinutes={mobileQuickHabitMinutes}
          onTitleChange={setQuickTitle}
          onKindChange={(kind) => { setMobileQuickAddKind(kind); setQuickProjectOpen(false); }}
          onProjectChange={setQuickProjectId}
          onProjectColorChange={setQuickProjectColor}
          onHabitMinutesChange={setMobileQuickHabitMinutes}
          onClose={() => void closeMobileQuickAdd()}
          onMore={() => finishMobileQuickAdd(true)}
          onSubmit={(sample) => finishMobileQuickAdd(false, sample)}
        /></Suspense>
      )}
      <div id="df-portal-target" />
      {showGuide && onboardingStep === "add" && <OnboardingCue key="add" anchor={taskPaneVisible ? quickComposerRef : quickAddButtonRef}
        lang={lang} onClose={() => void saveSettings(ONBOARDING_DONE)}>
        {taskPaneVisible ? (lang === "zh" ? "输入第一条任务并添加" : "Type your first task and add it")
          : (lang === "zh" ? "添加第一条任务" : "Add your first task")}
      </OnboardingCue>}
      {showGuide && onboardingStep === "schedule" && onboardingTask && (guideRowVisible || !taskPaneVisible) && <OnboardingCue key={onboardingTask.id}
        anchor={guideRowVisible ? onboardingTaskRowRef : tasksGuideAnchor}
        followRow={guideRowVisible} lang={lang} onClose={() => void saveSettings(ONBOARDING_DONE)}>
        {guideRowVisible ? (lang === "zh"
          ? (mobileExecution ? "长按任务块并移动到时间轴" : "按住任务块并移动到时间轴")
          : (mobileExecution ? "Press and hold the task block, then move it onto the timeline" : "Hold the task block and move it onto the timeline"))
          : <Button variant="text" className="df-workspace-guide-action" onClick={revealTasks}>{lang === "zh" ? "打开任务列表" : "Open Tasks"}</Button>}
      </OnboardingCue>}
      {returningGuideBlock && <OnboardingCue anchor={returnDropAnchor} lang={lang}>
        {returnToTasksButton
          ? (lang === "zh" ? "放到任务按钮上，取消安排" : "Drop on the Tasks button to unschedule")
          : (lang === "zh" ? "放回任务列表，取消安排" : "Drop in Tasks to unschedule")}
      </OnboardingCue>}
      {showGuide && tourStep && <OnboardingTour key={tourStep} step={tourStep} anchor={tourAnchor} waitingForTasks={tourWaitingForTasks}
        phone={mobileExecution} lang={lang} onClose={() => void saveSettings(ONBOARDING_DONE)}
        onNext={() => advanceOnboardingTour(tourStep)} onSettings={openOnboardingSettings} />}
      {dialog.host}
      {!productDemo && (notificationCenterOpen || !workspacePanel) && <Suspense fallback={null}><ProactiveNotificationCenter
        data={data}
        lang={lang}
        notifications={proactiveNotifications}
        open={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        onDismiss={dismissProactiveNotification}
        onOpenReview={(notification) => void openDailyReviewNotification(notification)}
        onOpenUnfinished={(notification) => { setNotificationCenterOpen(false); setUnfinishedNotification(notification); }}
        onSaveData={(next) => void saveData(next)}
      /></Suspense>}
      {unfinishedNotification && <Suspense fallback={null}><UnfinishedTasksDialog
        notification={unfinishedNotification}
        data={data}
        lang={lang}
        onClose={() => setUnfinishedNotification(null)}
        onSaveData={(next) => void saveData(next)}
        onOpenAi={openUnfinishedAi}
        onDismiss={dismissProactiveNotification}
      /></Suspense>}

        <ExecutionSplitLayout className={`${narrowSplitLayout ? "shelf-timeline-split " : ""}${candidatePanelCollapsed ? "candidate-collapsed" : ""}${fullscreen ? " fullscreen" : ""}${simpleView ? " simple-view" : ""}`} style={candidatePanelCollapsed || candidatePanelWidth ? { "--df-candidate-width": candidatePanelCollapsed ? "44px" : `${candidatePanelWidth}px` } as CSSProperties : undefined}>
          {!productAiPresentation && <div className="df-compact-execute-controls">
            {portraitLayout && !productPresentation && <div className="df-compact-brand">{brandControl}</div>}
            {compactLayout && !productDemo && <span className="df-workspace-save-feedback df-compact-save-feedback" role="status" data-save-phase={savePhase}>{isManualSyncing ? t(lang, "sync.syncing") : saveFeedbackLabel(savePhase, lang, authState?.mode === "cloud")}</span>}
            {!mobileExecution && !narrowSplitLayout && <nav className="df-compact-execute-tabs" inert={compactLayout && compactToolbarBlocked} aria-label={lang === "zh" ? "执行视图" : "Execute view"}>
              <button
                className={`active ${compactExecuteView === "schedule" ? "schedule-state" : "tasks-state"}`}
                aria-label={compactExecuteView === "tasks" ? (lang === "zh" ? "日程" : "Schedule") : (lang === "zh" ? "任务" : "Tasks")}
                aria-pressed={compactExecuteView === "schedule"}
                onClick={() => setCompactExecuteView((view) => view === "tasks" ? "schedule" : "tasks")}
              >
                <span className="df-compact-mode-label tasks-label" aria-hidden="true">{lang === "zh" ? "任务" : "Tasks"}</span>
                <span className="df-compact-mode-label schedule-label" aria-hidden="true">{lang === "zh" ? "日程" : "Schedule"}</span>
                <span className="df-compact-mode-logo" aria-hidden="true"><ProductIcon compact /></span>
              </button>
            </nav>}
            {(() => {
                const date = new Date(`${timelineWindowAnchorDate}T00:00:00`);
                const dateContents = timelineView === "month" ? (
                  <strong>{date.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "short" })}</strong>
                ) : (
                  <><strong>{date.getDate()}</strong><span>{weekdayName(lang, date.getDay()).replace(/^周/, "")}</span></>
                );
                if (productPresentation || compactTasksActive) {
                  return <div className="df-compact-date-display is-readonly" inert={compactLayout && compactToolbarBlocked} aria-label={lang === "zh" ? "当前日期" : "Current date"}>{dateContents}</div>;
                }
                return <button
                  type="button"
                  className="df-compact-date-display df-compact-date-picker-trigger"
                  inert={compactLayout && compactToolbarBlocked}
                  aria-expanded={mobileDatePickerOpen}
                  aria-label={lang === "zh" ? "打开日期快选" : "Open quick date picker"}
                  onClick={toggleTimelineDatePicker}
                >
                {dateContents}
                <UiChevronDownIcon className={`df-date-title-chevron${mobileDatePickerOpen ? " open" : ""}`} size={14} />
              </button>;
              })()}
            {compactExecuteView === "schedule" && !productPresentation && (
              <>
              <nav className="df-compact-calendar-tabs" inert={compactLayout && compactToolbarBlocked} aria-label={t(lang, "timeline.switchView")}>
                <button className="df-compact-date-arrow" aria-label={t(lang, "timeline.prevSegment")} onClick={() => shiftTimeline(-1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m9.5 3-5 5 5 5" /></svg></button>
                <button className="df-compact-date-arrow" aria-label={t(lang, "timeline.nextSegment")} onClick={() => shiftTimeline(1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6.5 3 5 5-5 5" /></svg></button>
                <label className="active df-compact-view-trigger df-ios-native-select">
                  <span>{viewLabel(lang, timelineView)}</span>
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
                  <select
                    aria-label={t(lang, "timeline.switchView")}
                    value={timelineView}
                    onChange={(event) => changeTimelineView(event.target.value as TimelineView)}
                  >
                    {(["daily", "3day", "weekly", "month"] as TimelineView[]).map((view) => (
                      <option key={view} value={view}>{viewLabel(lang, view)}</option>
                    ))}
                  </select>
                </label>
              </nav>
              </>
            )}
          </div>}
          {compactLayout && compactExecuteView === "schedule" && timelineDatePicker}
          {mobileExecution && <div className={`df-mobile-candidate-backdrop${candidateDrawerOpen ? " is-open" : ""}`} aria-hidden="true" />}
          <CandidatePanelShell
            panelRef={candidatePanelRef}
            role={mobileExecution && candidateDrawerOpen ? "dialog" : undefined}
            ariaLabel={mobileExecution ? (lang === "zh" ? "待安排任务" : "Tasks to schedule") : undefined}
            className={`${mobileExecution ? `is-mobile-candidates ${candidateDrawerOpen ? "compact-active" : "compact-inactive"}${candidateDrawerExpanded ? " is-expanded" : ""}` : productAiPresentation || narrowSplitLayout || compactExecuteView === "tasks" ? "compact-active" : "compact-inactive"}${!mobileExecution && candidatePanelCollapsed ? " collapsed" : ""}${!mobileExecution && fullscreen ? " hidden" : ""}${candidateDropActive ? " drop-active" : ""}`}
            style={!mobileExecution && candidatePanelCollapsed ? { position: "relative", zIndex: 2, pointerEvents: "auto" } : undefined}
            ariaHidden={mobileExecution ? !candidateDrawerOpen : !productAiPresentation && !narrowSplitLayout && compactLayout && compactExecuteView !== "tasks"}
            inert={mobileExecution && !candidateDrawerOpen}
            onPointerDown={(event) => {
              if (compactLayout || candidatePanelCollapsed || event.button) return;
              const panel = event.currentTarget;
              if (panel.getBoundingClientRect().right - event.clientX > 18) return;
              startCandidatePanelResize(event);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
            event.preventDefault();
            const taskId = drag?.taskId || event.dataTransfer.getData("taskId");
            if (taskId && !isEventDisplayTask(taskId)) returnTimelineTaskToCandidates(taskId, today);
          }}>
            {!mobileExecution && candidatePanelCollapsed ? (
              <div className="df-candidate-collapsed-strip">
                <button ref={candidateExpandRef} className="df-candidate-expand-btn" title={t(lang, "candidate.expand")} aria-label={t(lang, "candidate.expand")} onClick={() => {
                  setCandidatePanelCollapsed(false);
                }}>&#9654;</button>
                <span className="df-candidate-collapsed-label">{term(lang, "todayCandidates")}</span>
                {timelineView !== "daily" && <div className="df-candidate-collapsed-actions">
                  <button className={`df-candidate-strip-btn${fullscreen ? " active" : ""}`} title={t(lang, "candidate.fullscreen")} aria-label={t(lang, "candidate.fullscreen")} onClick={() => setFullscreen((value) => !value)}>⛶</button>
                </div>}
              </div>
            ) : (
              <>
            <CandidatePanelHeader
              {...candidateHeaderGesture}
              title={
                <button ref={shelfTitleRef} type="button" className="df-shelf-title-button" aria-label={switchViewsLabel} aria-expanded={shelfMenuOpen} onClick={() => setShelfMenuOpen((open) => !open)}>
                  <span>{shelfView ? candidateViewName(shelfView, lang) : shelfTitle}</span><UiChevronDownIcon size={15} />
                </button>
              }
              actions={<>
                {shelfTreeOpen ? <>
                  <span ref={setProjectFilterAnchor} className="df-project-filter-anchor" />
                  {!productDemo && <IconButton icon={<UiPlusIcon size={17} />} label={lang === "zh" ? "新建项目" : "New project"} onClick={() => openAdd("project")} />}
                </> : <>
                {!shelfView && <IconButton className={`df-icon-action df-candidate-header-icon${groupByProject ? " active" : ""}`} icon={<UiFolderInputIcon size={17} />} label={lang === "zh" ? "按项目分类" : "Group by project"} aria-pressed={groupByProject} onClick={() => setGroupByProject((value) => !value)} />}
                <IconButton className={`df-icon-action df-candidate-header-icon${showCompletedCandidates ? " active" : ""}`} icon={<UiListChecksIcon size={17} />} label={t(lang, "candidate.showCompleted")} aria-pressed={showCompletedCandidates} onClick={() => setShowCompletedCandidates((value) => !value)} />
                {aiEnabled && (
                  <span className="df-ai-plan-title-tools">
                    <IconButton
                      className={`df-ai-plan-title-icon${productAiPresentation && !demoHasSchedule && !demoPresetBusy ? " needs-demo-plan" : ""} ${autoScheduleState === "generating" || autoScheduleState === "committing" || (productAiPresentation && demoPresetBusy) ? "thinking" : ""}`}
                      icon={<UiSparklesIcon />}
                      label={t(lang, "timeline.aiPlanToday")}
                      aria-describedby={productAiPresentation && !demoHasSchedule && !demoPresetBusy ? "product-ai-start-guide" : undefined}
                      disabled={autoScheduleState === "generating" || autoScheduleState === "committing" || drawerOpen || (productAiPresentation && (demoPresetBusy || !demoTodayTasks.some(task => !task.scheduledStart && !task.timelineRecords?.some(record => record.executionStatus === "scheduled"))))}
                      onClick={() => { setAiPlanMenuOpen(false); if (productAiPresentation) void runProductDemoPreset(); else void planMyDay(); }}
                    />
                    {schedulePreviews.length > 0 && autoScheduleState === "preview" && <>
                      <IconButton className="df-icon-action df-ai-plan-confirm ui-icon-button--borderless" icon={<UiCheckIcon />} label={t(lang, "timeline.adoptAll")} onClick={acceptAllPreviews} />
            <CloseButton className="df-ai-plan-cancel" onClick={() => cancelAutoSchedule()} label={t(lang, "timeline.cancelPreview")} />
                    </>}
                    {aiPlanMenuOpen && <span className="df-ai-plan-menu df-ai-plan-menu-visible open" onClick={(event) => event.stopPropagation()}>
                      <CloseButton label={t(lang, "form.close")} onClick={() => setAiPlanMenuOpen(false)} />
                      <span className={`df-ai-capacity-risk ${dailyCapacityRisk.level}`}>
                        <strong>{lang === "zh" ? "今日容量" : "Today's capacity"}</strong>
                        <small>{lang === "zh" ? `待安排 ${formatMinutes(dailyCapacityRisk.demandMinutes)} / 可用 ${formatMinutes(dailyCapacityRisk.availableMinutes)}` : `${formatMinutes(dailyCapacityRisk.demandMinutes)} to place / ${formatMinutes(dailyCapacityRisk.availableMinutes)} free`}</small>
                      </span>
                      <label>{t(lang, "timeline.scope")}<select value={aiPlanPrefs.scope} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, scope: event.target.value as AiPlanPrefs["scope"] }))}><option value="day">{viewLabel(lang, "daily")}</option><option value="3day">{viewLabel(lang, "3day")}</option><option value="week">{lang === "zh" ? "本周" : "This week"}</option></select></label>
                      <label>{t(lang, "timeline.strategy")}<select value={aiPlanPrefs.strategy} onChange={(event) => setAiPlanPrefs((current) => ({ ...current, strategy: event.target.value as AiPlanPrefs["strategy"] }))}><option value="alternativeProject">{t(lang, "timeline.alternateByProject")}</option><option value="byProject">{t(lang, "timeline.scheduleByProject")}</option><option value="longShort">{t(lang, "timeline.alternateLongShort")}</option><option value="random">{t(lang, "timeline.random")}</option></select></label>
                      <span className="df-ai-daily-tools"><button type="button" onClick={() => { setAiPlanMenuOpen(false); openDailyAiPrompt("start"); }}>{lang === "zh" ? "开工简报" : "Start brief"}</button><button type="button" onClick={() => { setAiPlanMenuOpen(false); openDailyAiPrompt("review"); }}>{lang === "zh" ? "收工复盘" : "Day review"}</button></span>
                    </span>}
                  </span>
                )}
                {(!productDemo || canCollapseCandidatePanel) && <ActionDisclosure label={lang === "zh" ? "更多候选操作" : "More task options"}>
                  {!productDemo && <Button variant="ghost" aria-pressed={showScheduledCandidates} onClick={() => setShowScheduledCandidates((show) => !show)}>
                    {lang === "zh" ? "显示已安排" : "Show scheduled"}
                  </Button>}
                  {canCollapseCandidatePanel && <Button variant="ghost" onClick={() => { setCandidatePanelCollapsed(true); setFullscreen(false); }}>{t(lang, "candidate.collapse")}</Button>}
                </ActionDisclosure>}
                </>}
                {mobileExecution && <CloseButton className="df-mobile-candidate-close" label={lang === "zh" ? "关闭候选任务" : "Close candidates"} onClick={closeCandidateDrawer} />}
              </>
            }
            />
            <AnchoredNarrowMenu open={shelfMenuOpen} anchorRef={shelfTitleRef} placement="below" focusOnOpen label={switchViewsLabel} onClose={() => setShelfMenuOpen(false)} className="df-shelf-view-menu" intentPreload={planningViewPromise ? undefined : preloadPlanningView}>
              {tourStep === "views" && <p className="df-shelf-view-guide" role="status">{lang === "zh" ? "选一个视图试试看。" : "Pick a view to try."}</p>}
              <Button variant="ghost" aria-pressed={!shelfView} onClick={() => selectShelfView("")}><UiListChecksIcon size={16} />{shelfTitle}</Button>
              {shelfViews.map((view) => <Button key={view.id} variant="ghost" aria-pressed={shelfViewId === view.id}
                data-intent-preload={view.nativeMode ? "" : undefined} onPointerEnter={view.nativeMode ? preloadPlanningView : undefined} onFocus={view.nativeMode ? preloadPlanningView : undefined}
                onClick={() => selectShelfView(view.id)}><CandidateViewIcon view={view} />{candidateViewName(view, lang)}</Button>)}
            </AnchoredNarrowMenu>
            {candidateDropActive && (
              <div className="df-candidate-return-hint" role="status">
                {lang === "zh" ? "松手后移回任务" : "Release to return to Tasks"}
              </div>
            )}
            {(schedulePreviews.length > 0 || scheduleUnscheduled.length > 0) && (
              <div className="df-ai-plan-feedback" role="status">
                {schedulePreviews.length > 0 && <><span className="df-ai-plan-summary">{t(lang, "timeline.previewPlan").replace("X", String(schedulePreviews.length))}</span>{compactLayout && <div className="df-ai-plan-mobile-preview">{schedulePreviews.slice(0, 4).map((preview) => <button key={preview.id} type="button" onClick={() => { setCompactExecuteView("schedule"); setPendingTimelineFocus({ date: preview.scheduledDate, startTime: preview.scheduledStart, source: "autoschedule" }); }}><strong>{preview.title}</strong><small>{preview.scheduledDate} · {preview.scheduledStart}–{preview.scheduledEnd}</small></button>)}</div>}</>}
                {scheduleUnscheduled.length > 0 && <details className="df-ai-plan-unscheduled">
                  <summary>{lang === "zh" ? `${scheduleUnscheduled.length} 项暂未安排` : `${scheduleUnscheduled.length} not scheduled`}</summary>
                  {scheduleUnscheduled.map((item) => <div key={item.taskId} className="df-ai-plan-unscheduled-item">
                    <span><strong>{item.title}</strong><small>{item.reason}</small></span>
                    <span className="df-ai-plan-unscheduled-actions">{(item.actions || []).map((action) => <button key={action} type="button" onClick={() => handleUnscheduledAction(item, action)}>{action === "shorten" ? (lang === "zh" ? "缩短" : "Shorten") : action === "split" ? (lang === "zh" ? "拆分" : "Split") : (lang === "zh" ? "移至下一天" : "Next day")}</button>)}</span>
                  </div>)}
                </details>}
              </div>
            )}
            <Activity mode={shelfView ? "hidden" : "visible"}>
            <div className="df-candidate-list" data-shelf-scroll="candidates" inert={productAiPresentation && demoPresetBusy ? true : undefined}>
              {extensionSnapshot.taskGroups?.length && !productDemo ? <Suspense fallback={renderOrdinaryCandidates(ordinaryCandidates)}><PluginTaskGroupsLazy groups={extensionSnapshot.taskGroups} candidates={ordinaryCandidates} revision={tasks} lang={lang} renderOrdinary={renderOrdinaryCandidates} renderTask={renderCandidateTask} /></Suspense> : renderOrdinaryCandidates(ordinaryCandidates)}
              {readingEnabled && (
                <Suspense fallback={null}><ReadingTaskGroupLazy library={reading.library} busy={reading.busy} error={reading.error} lang={lang} count={readingCandidates.length} onOpenLibrary={readingView ? openReading : undefined} onCreateTask={createReadingTask}>
                  {readingCandidates.map(renderCandidateTask)}
                </ReadingTaskGroupLazy></Suspense>
              )}
              {habitsEnabled && shouldShowHabitCandidates({ ...settings, featureHabitsEnabled: true }) && (
                <HabitCandidateCard
                  habits={habits}
                  projects={projects}
                  habitDailyStates={habitDailyStates}
                  today={today}
                  lang={lang}
                  onToggle={toggleHabitDaily}
                  onPointerDragStart={beginHabitDrag}
                  onFocusScheduled={focusHabitSchedule}
                  onEditHabit={openHabitDetail}
                  onOpenOverview={openHabitOverview}
                  isClickSuppressed={() => suppressBlockClickRef.current}
                  draggedHabitId={drag?.source === "candidate" ? drag.taskId : null}
                />
              )}
              {productDemo && !productDemo.story && !productAiPresentation && <aside className="df-product-notes"><p>{lang === "zh" ? "从任务中挑选，再放进时间轴。" : "Pick a candidate and give it time on the timeline."}</p><p>{lang === "zh" ? "一天有变化，安排也可以调整。" : "Adjust the plan as your day changes."}</p></aside>}
            </div>
            {productAiPresentation ? demoAiControls : <form ref={quickComposerRef} className="df-quick-add" onSubmit={(event) => {
              event.preventDefault();
              quickAddTask();
            }}>
              <input ref={quickExampleRef} aria-label={lang === "zh" ? "任务名称" : "Task name"} value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder={t(lang, "candidate.addPlaceholder")} />
              <QuickProjectPicker
                projects={projects}
                value={quickProjectId}
                open={quickProjectOpen}
                newTitle={quickProjectTitle}
                newColor={quickProjectColor}
                onOpenChange={setQuickProjectOpen}
                onChange={setQuickProjectId}
                onTitleChange={setQuickProjectTitle}
                onColorChange={setQuickProjectColor}
                onProjectColorChange={(projectId, color) => updateProject(projectId, { color })}
                onCreate={createQuickProject}
                lang={lang}
              />
              <button className="df-quick-add-submit" type="submit" aria-label={t(lang, "candidate.add")} disabled={!quickTitle.trim() && onboardingStep !== "add"}>
                {t(lang, "candidate.add")}
              </button>
            </form>}
            </Activity>
            {shelfView && !shelfTreeOpen && (
              <div className="df-shelf-scroll" data-shelf-scroll="views">
                <Suspense fallback={<div className="df-shelf-loading" role="status">{(lang === "zh" ? "正在打开…" : "Opening…")}</div>}>
                  {shelfView.owner === "official:reading" && readingEnabled
                      ? <ReadingShelfLazy library={reading.library} busy={reading.busy} error={reading.error} lang={lang} onCreateTask={createReadingTask} mutate={reading.mutate} tasks={tasks} entries={data.timeEntries || []} engagementEnabled={engagementEnabled} onSaved={(before, after) => showUndoToast(lang === "zh" ? "已保存书籍" : "Book saved", t(lang, "toast.undo"), () => {
                        void import("./reading/model").then(({ undoReadingBookChange }) => reading.mutate(library => undoReadingBookChange(library, before, after)))
                          .then(() => showToast(t(lang, "toast.undone"))).catch(() => showToast(lang === "zh" ? "书籍已发生变化，无法安全撤销。" : "The book changed and cannot be safely undone."));
                      })} />
                      : shelfView.nativeMode && shelfView.nativeMode !== "activity-history"
                      ? <PlanningViewLazy {...planningViewProps} {...scheduleViewProps} viewMode={shelfView.nativeMode} tasks={visibleCandidates} showCompleted={showCompletedCandidates} />
                      : <ExtensionMount contribution={shelfView} lang={lang} />}
                </Suspense>
              </div>
            )}
            {shelfTreeOpen && (
              <div className="df-shelf-scroll" data-shelf-scroll="projects">
                <Suspense fallback={<div className="df-shelf-loading" role="status">{(lang === "zh" ? "正在打开…" : "Opening…")}</div>}>
                  <PlanningViewLazy {...planningViewProps} {...scheduleViewProps} viewMode="tree" tasks={tasks}
                    session={planningSessionRef} filterAnchor={projectFilterAnchor} focusTaskId={planningFocusTaskId}
                    onFocusHandled={() => setPlanningFocusTaskId(null)} demo={Boolean(productDemo)}
                    referenceDate={productDemo?.date} presentationNote={productDemo?.story} />
                </Suspense>
              </div>
            )}
            {!productAiPresentation && <span className="df-candidate-resize-zone" aria-hidden="true" onPointerDown={startCandidatePanelResize} />}
              </>
            )}
          </CandidatePanelShell>
          {productAiPresentation ? <ProductStorySlot feature="ai"><div className="df-product-ai-intro" role="status" aria-live="polite" aria-atomic="true">
            <h1>{demoRevealing ? (lang === "zh" ? "一步一步，\n各就各位。" : "Step by step.\nInto place.") : demoPresetBusy ? (lang === "zh" ? "正在为今天\n留出时间。" : "Making room\nfor your day.") : demoHasSchedule ? (lang === "zh" ? "一天有了\n自己的节奏。" : "A day with\nroom to breathe.") : (lang === "zh" ? "点一下，\n安排一整天。" : "Try one click.\nPlan your day.")}</h1>
            <p id="product-ai-start-guide">{demoRevealing ? (lang === "zh" ? "从上午到傍晚，每项任务都有自己的位置。" : "From morning to evening, each task finds its time.") : demoPresetBusy ? (lang === "zh" ? "让任务、休息和生活，都有自己的时间。" : "Make room for tasks, breaks and everyday life.") : demoHasSchedule ? (lang === "zh" ? "午餐与休息也在计划里。你还可以调整任务，或试试改期与撤回。" : "Lunch and breaks belong here, too. Adjust a task, reschedule it, or undo.") : <>{lang === "zh" ? "点击左侧「任务」右上角的 " : "Click the pulsing "}<UiSparklesIcon /><strong>{lang === "zh" ? "AI 安排按钮" : "AI scheduling icon"}</strong>{lang === "zh" ? "，体验一次示例安排。" : " at the top right of Tasks to try the example."}</>}</p>
            {demoPresetBusy && !demoRevealing && !demoHasSchedule && <div className="df-product-ai-arranging-notes"><p>{lang === "zh" ? "按任务估时留出完整时段，减少来回切换。" : "Give each task enough time, with fewer switches."}</p><p>{lang === "zh" ? "午餐与休息也排进去，计划才跟得上生活。" : "Lunch and breaks belong in the plan, too."}</p><p>{lang === "zh" ? "安排好后，仍可调整时间、改期或撤回。" : "Then adjust the time, move a task, or undo."}</p></div>}
          </div></ProductStorySlot> : productDemo?.story}
          <section
            onPointerDownCapture={(event) => {
              mobileTapRef.current = { x: event.clientX, y: event.clientY, moved: false };
              if (mobileExecution && candidateDrawerOpen) event.stopPropagation();
            }}
            onPointerMoveCapture={(event) => {
              if (Math.hypot(event.clientX - mobileTapRef.current.x, event.clientY - mobileTapRef.current.y) > 8) mobileTapRef.current.moved = true;
            }}
            onMouseDownCapture={(event) => { if (mobileExecution && candidateDrawerOpen) event.stopPropagation(); }}
            onClickCapture={(event) => {
              if (!mobileExecution || !candidateDrawerOpen) return;
              event.preventDefault();
              event.stopPropagation();
              if (!mobileTapRef.current.moved) closeCandidateDrawer();
            }}
            className={`df-timeline-panel${compactTimelineActive ? " compact-active" : " compact-inactive"}`}
            aria-hidden={compactLayout && !compactTimelineActive}
            id="df-execute-timeline"
            data-candidates-open={mobileExecution && candidateDrawerOpen || undefined}
            data-cross-day-scroll={settings.continuousCrossDayScroll !== false ? "true" : "false"}
            onWheelCapture={handleTimelinePanelWheel}
          >

            <div className="df-timeline-body">
              {!productPresentation && !compactLayout && <>
                <button className="df-date-arrow left" aria-label={t(lang, "timeline.prevSegment")} onClick={() => shiftTimeline(-1)}>‹</button>
                <button className="df-date-arrow right" aria-label={t(lang, "timeline.nextSegment")} onClick={() => shiftTimeline(1)}>›</button>
              </>}
              <div className="df-timeline-content">
                {timelineEmpty && !drag && !dragCreate && <p className="df-timeline-empty-note">
                  {timelineView !== "daily" ? (lang === "zh" ? "这段时间还没有任务" : "No tasks in this period")
                    : timelineWindowAnchorDate === today ? (lang === "zh" ? "今天还没有任务" : "No tasks today")
                    : (lang === "zh" ? "这一天还没有任务" : "No tasks on this day")}
                </p>}
                {fullscreen && (
                  <button
                    className="df-exit-fullscreen-btn"
                    type="button"
                    aria-label={lang === "zh" ? "退出全屏" : "Exit Fullscreen"}
                    title={lang === "zh" ? "退出全屏" : "Exit Fullscreen"}
                    onClick={() => setFullscreen(false)}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />
                    </svg>
                  </button>
                )}
                {(timelineView === "3day" || timelineView === "weekly") ? (() => {
                  const threeDates = getVisibleDays(timelineView === "weekly" ? "weekly" : "3day", timelineWindowAnchorDate);
                  const weekdayShort = lang === "zh" ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  const canvasHeight = continuousTimelineEnabled ? dailyTimelineCanvasHeight : ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) * timelineSlotHeight;
                  const slotCount = continuousTimelineEnabled ? dailyTimelineSlotCount : ((TIMELINE_END - TIMELINE_START) * 60 / SLOT_MINUTES) + 1;
                  const multiDayScheduledTasks = scheduledTasks;
                  return (
                    <div className={`df-timeline-3day ${timelineView === "weekly" ? "df-week-view" : ""}`} style={{ "--df-day-columns": String(threeDates.length) } as CSSProperties}>
                      <div className="df-timeline-3day-top">
                        <div className="df-timeline-3day-ruler-spacer" />
                        <div className="df-timeline-3day-dates">
                          {threeDates.map((colDate) => {
                            const isToday = colDate === today;
                            const dateObj = new Date(`${colDate}T00:00:00`);
                            return (
                              <button type="button" key={colDate} data-date={colDate} className={`df-timeline-3day-date${isToday ? " today" : ""}`}
                                aria-current={isToday ? "date" : undefined}
                                aria-label={dateObj.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "full" })}
                                onClick={() => openTimelineDay(colDate)}>
                                <span className="df-timeline-3day-date-num">{dateObj.getDate()}</span>
                                <span className="df-timeline-3day-date-sep"></span>
                                <span className="df-timeline-3day-date-wd">{weekdayShort[dateObj.getDay()]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="df-timeline-3day-allday"
                        onDragEnter={(e) => { e.preventDefault(); setAllDayDragOver(true); }}
                        onDragOver={(e) => { e.preventDefault(); if (!allDayDragOver) setAllDayDragOver(true); }}
                        onDragLeave={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                            setAllDayDragOver(false);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setAllDayDragOver(false);
                          setAllDayDragDate("");
                          const taskId = e.dataTransfer.getData("taskId") || drag?.taskId;
                          if (taskId) {
                            // Determine which column by x coordinate
                            const rect = e.currentTarget.getBoundingClientRect();
                            const datesEl = e.currentTarget.querySelector(".df-timeline-3day-dates");
                            if (datesEl) {
                              const datesRect = datesEl.getBoundingClientRect();
                              const x = e.clientX - datesRect.left;
                              const colW = datesRect.width / threeDates.length;
                              const di = Math.min(Math.max(Math.floor(x / colW), 0), threeDates.length - 1);
                              makeAllDay(taskId, threeDates[di]);
                            } else {
                              makeAllDay(taskId, threeDates[0]);
                            }
                          }
                        }}
                      >
                        <div className="df-timeline-3day-ruler-spacer">
                          <span className="df-timeline-3day-allday-label">{t(lang, "timeline.allDay")}</span>
                        </div>
                        <div className="df-timeline-3day-dates">
                          {threeDates.map((colDate, ci) => {
                            const adTasks = [
                              ...tasks.filter((task) => isAllDayTask(task) && task.scheduledDate === colDate),
                              ...allDayTimelineTasks.filter((task) => task.scheduledDate === colDate),
                              ...eventVisibleTimeline.tasks.filter((task) => !task.scheduledStart && task.scheduledDate === colDate),
                            ];
                            return (
                              <div key={colDate} className="df-timeline-3day-allday-cell" data-date={colDate} data-all-day-date={colDate}
                                onClick={(event) => {
                                  if (drawerOpen || drag || resizePreview || autoScheduleState === "generating") return;
                                  if ((event.target as HTMLElement).closest("button,.df-all-day-block,.df-all-day-quick")) return;
                                  const cellRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                                  const parentGrid = (event.currentTarget as HTMLElement).closest(".df-timeline-3day-dates");
                                  const colGrid = parentGrid ? parentGrid.getBoundingClientRect() : cellRect;
                                  const colCount = threeDates.length;
                                  const colW = colGrid.width / colCount;
                                  const gutter = 6;
                                  const popL = colGrid.left + ci * colW + gutter;
                                  setAllDayQuickAdd({ date: colDate, left: popL, top: cellRect.top + 4, width: colW - gutter * 2, dayIndex: ci });
                                }}
                              >
                                {allDayQuickAdd && !drag && allDayQuickAdd.date === colDate && (
                                  <AllDayQuickAddPopover add={allDayQuickAdd} projects={projects} onSave={(title, projectId) => createAllDayTask(title, colDate, projectId)} onCancel={() => setAllDayQuickAdd(null)} />
                                )}
                                {allDayDragDate === colDate && drag && draggedTask && <AllDayDropPreview task={draggedTask} projects={projects} lang={lang} />}
                                {adTasks.map((task) => (
                                  <AllDayBlock resolvedUnfinished={isResolvedUnfinished(task)} engagementEnabled={engagementEnabled} key={task.id} task={task} dragging={drag?.source === "allDay" && drag.taskId === task.id} projectName={projectName(task)} projects={projects} onEdit={() => { if (!suppressBlockClickRef.current) openTaskEdit(task); }} onToggleDone={() => toggleTaskDone(task.id)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onPointerDragStart={(event) => beginShelfDrag(event, task, "allDay")} lang={lang} />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="df-timeline-3day-scroll" ref={attachTimelineScroll}>
                        <div className="df-timeline-3day-grid">
                          <div className="df-timeline-3day-ruler">
                            <div className="df-timeline-canvas" style={{ height: `${canvasHeight}px`, width: "52px", margin: 0, borderLeft: "none", background: "transparent" }}>
                              {timelineHourSlots(slotCount, dayStartHour).map(({ index, minutes }) => {
                                const isMajor = minutes % (6 * 60) === 0;
                                return (
                                  <div className={`df-slot-ruler hour ${isMajor ? "major" : ""}`} style={{ top: `${index * timelineSlotHeight}px` }} key={index}>
                                    <span className="df-timeline-ruler-label"><b>{hourLabel(minutes)}</b></span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="df-timeline-3day-cols" ref={colsContainerRef}
                            onDragOver={(event) => {
                              event.preventDefault();
                              const gridEl = colsContainerRef.current;
                              const scrollEl = timelineRef.current;
                              if (gridEl && scrollEl) {
                                const target = continuousTimelineEnabled ? continuousPointerTarget(event.clientX, event.clientY, gridEl) : getDropTargetFromPointer({
                                  clientX: event.clientX, clientY: event.clientY,
                                  gridElement: gridEl,
                                  scrollElement: scrollEl,
                                  visibleDays: threeDates,
                                  startHour: dayStartHour,
                                  hourHeight: timelineHourHeight,
                                  debugLabel: `drag-${timelineView}`,
                                });
                                dragTargetDateRef.current = target.date;
                                setHoverSlot(target.startTime);
                              }
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                              if (taskId) {
                                const gridEl = colsContainerRef.current;
                                const scrollEl = timelineRef.current;
                                if (gridEl && scrollEl) {
                                  const target = continuousTimelineEnabled ? continuousPointerTarget(event.clientX, event.clientY, gridEl) : getDropTargetFromPointer({
                                    clientX: event.clientX, clientY: event.clientY,
                                    gridElement: gridEl,
                                    scrollElement: scrollEl,
                                    visibleDays: threeDates,
                                    startHour: dayStartHour,
                                    hourHeight: timelineHourHeight,
                                  });
                                  dragTargetDateRef.current = target.date;
                                  preserveTimelineViewportOnNextDataChange();
                                  if (drag?.kind === "block" && recordByIdMap.has(taskId)) {
                                    moveTimelineRecord(taskId, target.startTime, target.date);
                                    showToast(t(lang, "timeline.timeAdjusted"));
                                  } else {
                                    const sourceTask = tasks.find((item) => item.id === taskId);
                                    applyCandidateTimeSettings(taskId, {
                                      date: target.date,
                                      startTime: target.startTime,
                                      durationMinutes: drag?.duration || (sourceTask ? taskDuration(sourceTask) : 60),
                                      allDay: false,
                                    }, { focusTimeline: false });
                                  }
                                  setHoverSlot("");
                                  setDrag(null);
                                }
                              }
                            }}
                            onDragLeave={() => { setHoverSlot(""); dragTargetDateRef.current = ""; }}
                          >
                            {/* Single time-grid: coordinate origin for ALL day columns */}
                            <div className="df-time-grid" ref={timeGridRef} style={{ position: "relative", height: `${canvasHeight}px`, width: "100%" }}
                              onMouseDown={(event) => {
                                if (mobilePlacementRef.current || drag || resizePreview || autoScheduleState === "generating") return;
                                if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule,.df-all-day-block,.df-month-task")) return;
                                if ((event.target as HTMLElement).closest(".drag-create-preview,.drag-create-quick-add")) return;
                                const gridEl = timeGridRef.current;
                                const scrollEl = timelineRef.current;
                                if (!gridEl || !scrollEl) return;
                                const startTarget = continuousTimelineEnabled ? continuousPointerTarget(event.clientX, event.clientY, gridEl) : pointerToDateTime({
                                  clientX: event.clientX, clientY: event.clientY,
                                  gridElement: gridEl, scrollElement: scrollEl,
                                  visibleDays: threeDates,
                                  startHour: dayStartHour,
                                  hourHeight: timelineHourHeight,
                                });
                                const startMinutes = startTarget.minutes;
                                const startDayIndex = startTarget.dayIndex;
                                let hasMoved = false;
                                const moveHandler = (moveEvent: MouseEvent) => {
                                  if (Math.abs(moveEvent.clientY - event.clientY) < 6) return;
                                  hasMoved = true;
                                  const currentTarget = continuousTimelineEnabled ? continuousPointerTarget(moveEvent.clientX, moveEvent.clientY, gridEl) : pointerToDateTime({
                                    clientX: moveEvent.clientX, clientY: moveEvent.clientY,
                                    gridElement: gridEl, scrollElement: scrollEl,
                                    visibleDays: threeDates,
                                    hourHeight: timelineHourHeight,
                                  });
                                  if (currentTarget.date !== startTarget.date) return;
                                  let s = startMinutes, e = currentTarget.minutes;
                                  if (s > e) { const t = s; s = e; e = t; }
                                  s = Math.max(s, TIMELINE_START * 60);
                                  e = Math.min(e, TIMELINE_END * 60 - SLOT_MINUTES);
                                  if (e - s < SLOT_MINUTES * 2) e = s + SLOT_MINUTES * 2;
                                  const gridRect = gridEl.getBoundingClientRect();
                                  const cw = gridRect.width / threeDates.length;
                                  const gut = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
                                  const startPx = continuousTimelineEnabled ? continuousTimedTop(startTarget.date, minutesToTime(s)) : ((s - TIMELINE_START * 60) / SLOT_MINUTES) * timelineSlotHeight;
                                  const endPx = startPx + ((e - s) / SLOT_MINUTES) * timelineSlotHeight;
                                  setDragCreate({
                                    date: startTarget.date, dayIndex: startDayIndex,
                                    startMinutes: s, endMinutes: e,
                                    top: startPx, height: endPx - startPx,
                                    left: startDayIndex * cw + gut, width: cw - gut * 2,
                                    committed: false,
                                  });
                                };
                                const keyHandler = (keyEvent: KeyboardEvent) => {
                                  if (keyEvent.key === "Escape") {
                                    window.removeEventListener("mousemove", moveHandler);
                                    window.removeEventListener("mouseup", upHandler);
                                    window.removeEventListener("keydown", keyHandler);
                                    setDragCreate(null);
                                  }
                                };
                                const upHandler = () => {
                                  window.removeEventListener("mousemove", moveHandler);
                                  window.removeEventListener("mouseup", upHandler);
                                  window.removeEventListener("keydown", keyHandler);
                                  if (hasMoved) {
                                    dragCreateSuppressClickRef.current = true;
                                    setDragCreate((prev) => prev ? { ...prev, committed: true } : prev);
                                  }
                                };
                                window.addEventListener("mousemove", moveHandler);
                                window.addEventListener("mouseup", upHandler);
                                window.addEventListener("keydown", keyHandler);
                              }}
                              onClick={(event) => {
                                if (dragCreateSuppressClickRef.current) { dragCreateSuppressClickRef.current = false; return; }
                                if (mobilePlacementRef.current || drag || resizePreview || autoScheduleState === "generating") return;
                                if (suppressBlockClickRef.current) return;
                                if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule,.df-all-day-block,.df-month-task")) return;
                                if (clearTimelineSelection()) return;
                                const gridEl = timeGridRef.current;
                                const scrollEl = timelineRef.current;
                                if (!gridEl || !scrollEl) return;
                                const target = continuousTimelineEnabled ? continuousPointerTarget(event.clientX, event.clientY, gridEl) : pointerToDateTime({
                                  clientX: event.clientX,
                                  clientY: event.clientY,
                                  gridElement: gridEl,
                                  scrollElement: scrollEl,
                                  visibleDays: threeDates,
                                  startHour: dayStartHour,
                                  hourHeight: timelineHourHeight,
                                });
                                const startMinutes = timeToMinutes(target.startTime);
                                const endMinutes = Math.min(startMinutes + 30, TIMELINE_END * 60);
                                const gridRect = gridEl.getBoundingClientRect();
                                const columnWidth = gridRect.width / threeDates.length;
                                const gutter = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
                                const top = continuousTimelineEnabled
                                  ? continuousTimedTop(target.date, target.startTime)
                                  : ((startMinutes - TIMELINE_START * 60) / SLOT_MINUTES) * timelineSlotHeight;
                                setDragCreate({
                                  date: target.date,
                                  dayIndex: target.dayIndex,
                                  startMinutes,
                                  endMinutes,
                                  top,
                                  height: ((endMinutes - startMinutes) / SLOT_MINUTES) * timelineSlotHeight,
                                  left: target.dayIndex * columnWidth + gutter,
                                  width: columnWidth - gutter * 2,
                                  committed: true,
                                });
                              }}
                            >
                              {/* Layer 1: Shared hour lines across all columns */}
                              <div className="df-hour-lines-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
                                {timelineHourSlots(slotCount, dayStartHour).map(({ index, minutes }) => {
                                  const isMajor = minutes % (6 * 60) === 0;
                                  return <div className={`df-slot hour ${isMajor ? "major" : ""}`} style={{ top: `${index * timelineSlotHeight}px` }} key={index} />;
                                })}
                              </div>
                              {/* Layer 2: Day column backgrounds and separators */}
                              <div className="df-day-columns-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
                                {threeDates.map((colDate, ci) => {
                                  const colPct = 100 / threeDates.length;
                                  return (
                                    <div key={colDate} className={`df-day-col-bg${colDate === today ? " is-today" : ""}${allDayQuickAdd?.date === colDate ? " is-quick-add-target" : ""}`}
                                      style={{
                                        position: "absolute",
                                        left: `${ci * colPct}%`,
                                        width: `${colPct}%`,
                                        top: 0, bottom: 0,
                                        borderRight: ci < threeDates.length - 1 ? "1px solid rgba(148,163,184,.08)" : "none",
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              {continuousTimelineEnabled && <TimelineDayBoundaries anchorDate={continuousTimelineStartDate} bandCount={continuousTimelineBandCount} columnCount={timelineColumnCount} dayStartHour={dayStartHour} slotHeight={timelineSlotHeight} lang={lang} />}
                              {/* Layer 3: Event blocks — absolutely positioned on the time-grid */}
                              <div className="df-event-blocks-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}>
                                {multiColWidth > 0 && multiDayScheduledTasks.map((task) => {
                                  const dayOffset = continuousDateOffset(task.scheduledDate || "");
                                  const dayIndex = continuousTimelineEnabled ? ((dayOffset % timelineColumnCount) + timelineColumnCount) % timelineColumnCount : threeDates.indexOf(task.scheduledDate || "");
                                  if (dayIndex === -1) return null;
                                  const gutter = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
                                  const gap = timelineView === "weekly" ? 3 : 4;
                                  const baseLeft = dayIndex * multiColWidth + gutter;
                                  const innerW = multiColWidth - gutter * 2;
                                  const cs = computeConflictStyle(task.id, conflictLayout, innerW, baseLeft, gap, timelineView);
                                  let left = baseLeft;
                                  let width = innerW;
                                  if (cs) {
                                    left = cs.left;
                                    width = cs.width;
                                  }
                                  const isPreview = previewIdByClonedId.has(task.id);
                                  return (
                                    <TimeBlock blockRef={returnGuideAnchorFor(task)} resolvedUnfinished={isResolvedUnfinished(task)} engagementEnabled={engagementEnabled} key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} showResizeHint={resizeHintTaskId === resolveTimelineRecordId(task.id)} projectInteractive={!compactLayout} onHover={setHoveredBlock} mouseOptimized={dockMouseLayout} onSelect={(event) => selectTimelineTask(task, event)} onEdit={() => {
                                      if (!suppressBlockClickRef.current) openTaskEdit(task);
                                    }} onToggleDone={() => toggleTaskDone(task.id)} onTaskUpdate={(patch) => updateTask(resolveOwningTask(task.id)?.id || task.id, patch)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
                                      createProjectForTask(task.id, title);
                                    }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)} resizeEdges={explicitVisibleTimeline.resizeEdges.get(task.id) || eventVisibleTimeline.resizeEdges.get(task.id)}
                                      extraStyle={{ position: "absolute", left, width, top: continuousTimelineEnabled ? continuousTimedTop(task.scheduledDate || timelineDate, task.scheduledStart || "09:00") : undefined, pointerEvents: "auto", ...(isPreview ? { ["--df-preview" as any]: "1" } as CSSProperties : {}) }}
                                      onAcceptPreview={isPreview ? () => acceptOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                                      onCancelPreview={isPreview ? () => cancelOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                                      viewMode={timelineView}
                                      lang={lang}
                                      dayStartHour={dayStartHour}
                                      hourHeight={timelineHourHeight}
                                      dragState={drag?.kind === "block" && drag.taskId === task.id ? "source-placeholder" : undefined}
                                    />
                                  );
                                })}
                                {/* Preview block during drag */}
                                {guideSlotHint}
                                {multiColWidth > 0 && hoverSlot && drag && !drag.outsideTimeline && (() => {
                                  const tgtDate = dragTargetDateRef.current || threeDates[0];
                                  const dayOffset = continuousDateOffset(tgtDate);
                                  const dayIndex = continuousTimelineEnabled ? ((dayOffset % timelineColumnCount) + timelineColumnCount) % timelineColumnCount : threeDates.indexOf(tgtDate);
                                  if (dayIndex === -1) return null;
                                  const gutter = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
                                  return (
                                    <SnappedTimelineDragBlock task={draggedTask} startTime={hoverSlot} duration={drag.duration} projectName={draggedTask ? projectName(draggedTask) : ""} projects={projects} viewMode={timelineView} lang={lang}
                                      extraStyle={{ position: "absolute", left: dayIndex * multiColWidth + gutter, width: multiColWidth - gutter * 2, top: continuousTimelineEnabled ? continuousTimedTop(tgtDate, hoverSlot) : undefined }}
                                      dayStartHour={dayStartHour}
                                      hourHeight={timelineHourHeight}
                                    />
                                  );
                                })()}
                                {multiColWidth > 0 && placementPreviewTask && placementPreview && placementChoices.map((choice) => {
                                  const dayOffset = continuousDateOffset(choice.date);
                                  const dayIndex = continuousTimelineEnabled ? ((dayOffset % timelineColumnCount) + timelineColumnCount) % timelineColumnCount : threeDates.indexOf(choice.date);
                                  if (dayIndex === -1) return null;
                                  const gutter = compactLayout ? 1 : timelineView === "weekly" ? 5 : 8;
                                  return (
                                    <PreviewBlock
                                      key={`${choice.date}-${choice.startTime}`}
                                      task={placementPreviewTask}
                                      date={choice.date}
                                      startTime={choice.startTime}
                                      duration={choice.durationMinutes}
                                      onConfirm={mobilePlacement ? undefined : () => confirmPlacementChoice(choice)}
                                      lang={lang}
                                      extraStyle={{
                                        position: "absolute",
                                        left: dayIndex * multiColWidth + gutter,
                                        width: multiColWidth - gutter * 2,
                                        top: continuousTimelineEnabled ? continuousTimedTop(choice.date, choice.startTime) : undefined,
                                        ["--df-preview" as any]: "1",
                                      } as CSSProperties}
                                      dayStartHour={dayStartHour}
                                      hourHeight={timelineHourHeight}
                                    />
                                  );
                                })}
                                {/* Now line — only in today's column in multi-day view */}
                                {(() => {
                                  // Render the now-line whenever today is inside the visible
                                  // date range, regardless of whether infinite cross-day
                                  // scrolling is enabled. In continuous mode the range is the
                                  // 7-day vertical canvas; in non-continuous mode it is the
                                  // 3-day/week window derived from `threeDates`.
                                  if (!continuousTimelineDates.includes(today) || multiColWidth <= 0) return null;
                                  const todayOffset = continuousDateOffset(today);
                                  const todayIdx = continuousTimelineEnabled ? ((todayOffset % timelineColumnCount) + timelineColumnCount) % timelineColumnCount : threeDates.indexOf(today);
                                  if (todayIdx === -1) return null;
                                  const now = workspaceNow();
                                  return <NowLine highlighted={nowLineReturnPulse} extraStyle={{ left: todayIdx * multiColWidth, width: multiColWidth, top: continuousTimelineEnabled ? continuousTimedTop(today, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`) : undefined }} lang={lang} dayStartHour={dayStartHour} hourHeight={timelineHourHeight} />;
                                })()}
                              </div>
                              {dragCreate && (
                                <div className="drag-create-preview df-task-block df-task-block--scheduled df-time-block-quick-add" style={{
                                  position: "absolute", zIndex: 99998,
                                  overflow: "visible",
                                  top: `${dragCreate.top}px`, height: `${dragCreate.height}px`,
                                  ...draftConflictStyle(dragCreate, timelineView),
                                }}>
                                  <button type="button" className="df-timeline-draft-handle start" aria-label={lang === "zh" ? "拖动调整开始时间" : "Drag to adjust start"} onPointerDown={(event) => beginDragCreateResize(event, "start")} />
                                  <button type="button" className="df-timeline-draft-handle end" aria-label={lang === "zh" ? "拖动调整结束时间" : "Drag to adjust end"} onPointerDown={(event) => beginDragCreateResize(event, "end")} />
                                  {dragCreate.committed && inlineTimelineDraft ? (
                                    <DragCreateQuickAdd state={dragCreate} projects={projects} lang={lang}
                                      onSave={(title, projectId, subtasks) => commitDragCreatedTask(dragCreate, title, projectId, subtasks)}
                                      onCancel={() => setDragCreate(null)}
                                    />
                                  ) : (
                                    null
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })() : timelineView === "month" ? (
                  <Suspense fallback={null}><MonthView weeks={monthWeeks} tasks={tasks} projects={projects}
                    schedules={[...explicitVisibleTimeline.tasks, ...recurrenceVisibleTimeline.tasks, ...allDayTimelineTasks, ...eventVisibleTimeline.tasks]
                      .map((task) => isResolvedUnfinished(task) ? { ...task, completed: true } : task)}
                    selectedDate={timelineDate} today={today} lang={lang} weekStartsOn={settings.weekStartsOn}
                    compact={compactLayout} dragging={Boolean(drag)} dropDate={monthDropDate} scrollRef={monthScrollRef}
                    projectColor={(task) => categories[task.category].color} isEvent={isEventDisplayTask}
                    onSelectDate={setSelectedDate} onOpenDate={openTimelineDay} onMoveTask={moveTaskToMonthDate}
                    onReturnTask={(task, point) => {
                      if (!isEventDisplayTask(task) &&
                        document.elementFromPoint(point.x, point.y)?.closest(".df-candidate-panel")) returnTimelineTaskToCandidates(task.id);
                    }}
                    onEditTask={(task) => { if (!suppressBlockClickRef.current) openTaskEdit(task); }}
                    onAddTask={(date) => {
                      if (compactLayout) {
                        setMonthQuickAdd(null);
                        setQuickTitle("");
                        setMobileQuickAddKind("task");
                        setMobileQuickAddDate(date);
                        setMobileQuickAddFromProjectTree(false);
                        setQuickAddOpen(true);
                      } else setMonthQuickAdd({ date, left: 0, top: 30, width: 0, dayIndex: 0 });
                    }}
                    onDragActivate={() => { setMonthQuickAdd(null); suppressBlockClickRef.current = true; }}
                    onDragFinish={suppressClickAfterDrag}
                    quickAddDate={monthQuickAdd?.date}
                    renderQuickAdd={(day) => monthQuickAdd?.date === day && <AllDayQuickAddPopover absolute add={monthQuickAdd} projects={projects}
                      onSave={(title, projectId) => {
                        if (!title.trim()) return;
                        createAllDayTask(title, day, projectId);
                        setMonthQuickAdd(null);
                      }} onCancel={() => setMonthQuickAdd(null)} />}
                  /></Suspense>
                ) : (
                  <div className="df-timeline-daily">
                    <TimelineDateTag
                      type={productPresentation ? undefined : "button"}
                      className={`df-date-title df-date-title-compact${productPresentation ? "" : " df-date-title-button"}${timelineWindowAnchorDate === today ? " today" : ""}`}
                      aria-expanded={productPresentation ? undefined : mobileDatePickerOpen}
                      aria-label={productPresentation ? (lang === "zh" ? "当前日期" : "Current date") : (lang === "zh" ? "打开日期快选" : "Open quick date picker")}
                      onClick={productPresentation || compactLayout ? undefined : toggleTimelineDatePicker}
                    >
                      <span className="df-date-num">{(() => { const d = new Date(`${timelineWindowAnchorDate}T00:00:00`); return d.getDate(); })()}</span>
                      <span className="df-date-sep"></span>
                      <span className="df-date-wd">
                        {(() => {
                          const weekdayShort = lang === "zh" ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                          const d = new Date(`${timelineWindowAnchorDate}T00:00:00`);
                          return weekdayShort[d.getDay()];
                        })()}
                      </span>
                      {!productPresentation && <UiChevronDownIcon className={`df-date-title-chevron${mobileDatePickerOpen ? " open" : ""}`} size={14} />}
                    </TimelineDateTag>
                    {!compactLayout && timelineDatePicker}
                    <div
                      className="df-timeline-allday"
                      data-all-day-date={timelineWindowAnchorDate}
                      onDragEnter={(e) => { e.preventDefault(); setAllDayDragOver(true); }}
                      onDragOver={(e) => { e.preventDefault(); if (!allDayDragOver) setAllDayDragOver(true); }}
                      onDragLeave={(e) => {
                        // Only set false if truly leaving the all-day bar (not entering a child)
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                          setAllDayDragOver(false);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setAllDayDragOver(false);
                        setAllDayDragDate("");
                        const taskId = e.dataTransfer.getData("taskId") || drag?.taskId;
                        if (taskId) makeAllDay(taskId, timelineWindowAnchorDate);
                      }}
                    >
                      <span className="df-timeline-allday-label">{t(lang, "timeline.allDay")}</span>
                      {showBackToNow && <button className="df-back-to-now" type="button" onClick={goToNow} title={lang === "zh" ? "回到现在" : "Back to now"} aria-label={lang === "zh" ? "回到现在" : "Back to now"}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
                        <span>{lang === "zh" ? "回到现在" : "Back to now"}</span>
                      </button>}
                      <div className="df-timeline-allday-content"
                        onClick={(event) => {
                          if (drawerOpen || drag || resizePreview || autoScheduleState === "generating") return;
                          if ((event.target as HTMLElement).closest(".df-all-day-block,.df-all-day-quick")) return;
                          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                          const gutter = 6;
                          setAllDayQuickAdd({ date: timelineWindowAnchorDate, left: rect.left + gutter, top: rect.top + 4, width: rect.width - gutter * 2, dayIndex: 0 });
                        }}
                      >
                        {allDayQuickAdd && !drag && (
                          <AllDayQuickAddPopover add={allDayQuickAdd} projects={projects} onSave={(title, projectId) => createAllDayTask(title, allDayQuickAdd.date, projectId)} onCancel={() => setAllDayQuickAdd(null)} />
                        )}
                        {allDayDragDate === timelineWindowAnchorDate && drag && draggedTask && <AllDayDropPreview task={draggedTask} projects={projects} lang={lang} />}
                        {[
                          ...tasks.filter((task) => isAllDayTask(task) && task.scheduledDate === timelineWindowAnchorDate),
                          ...allDayTimelineTasks.filter((task) => task.scheduledDate === timelineWindowAnchorDate),
                          ...eventVisibleTimeline.tasks.filter((task) => !task.scheduledStart && task.scheduledDate === timelineWindowAnchorDate),
                        ].map((task) => (
                          <AllDayBlock resolvedUnfinished={isResolvedUnfinished(task)} engagementEnabled={engagementEnabled} key={task.id} task={task} dragging={drag?.source === "allDay" && drag.taskId === task.id} projectName={projectName(task)} projects={projects} onEdit={() => { if (!suppressBlockClickRef.current) openTaskEdit(task); }} onToggleDone={() => toggleTaskDone(task.id)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => createProjectForTask(task.id, title)} onPointerDragStart={(event) => beginShelfDrag(event, task, "allDay")} lang={lang} />
                        ))}
                      </div>
                    </div>
                    <TimelineCanvas
                      scrollRef={attachTimelineScroll}
                      canvasRef={timelineCanvasRef}
                      height={dailyTimelineCanvasHeight}
                      onScrollDragOver={(event) => {
                      event.preventDefault();
                      const gridEl = timelineCanvasRef.current;
                      const scrollEl = timelineRef.current;
                      if (gridEl && scrollEl) {
                        const target = getDropTargetFromPointer({
                          clientX: event.clientX, clientY: event.clientY,
                          gridElement: gridEl,
                          scrollElement: scrollEl,
                          visibleDays: [timelineDate],
                          startHour: dayStartHour,
                          hourHeight: timelineHourHeight,
                          debugLabel: "drag-daily",
                        });
                        const dailyTarget = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(event.clientY) : target;
                        dragTargetDateRef.current = dailyTarget.date;
                        setHoverSlot(dailyTarget.startTime);
                      }
                    }} onScrollDrop={(event) => {
                      event.preventDefault();
                      const taskId = event.dataTransfer.getData("taskId") || drag?.taskId;
                      if (taskId) {
                        const gridEl = timelineCanvasRef.current;
                        const scrollEl = timelineRef.current;
                        if (gridEl && scrollEl) {
                          const target = getDropTargetFromPointer({
                            clientX: event.clientX, clientY: event.clientY,
                            gridElement: gridEl,
                            scrollElement: scrollEl,
                            visibleDays: [timelineDate],
                            startHour: dayStartHour,
                            hourHeight: timelineHourHeight,
                          });
                          const dailyTarget = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(event.clientY) : target;
                          dragTargetDateRef.current = dailyTarget.date;
                          scheduleTask(taskId, dailyTarget.startTime, drag?.source === "allDay");
                        } else {
                          scheduleTask(taskId, hoverSlot || slotFromPointer(event.clientY, 0, event.clientX), drag?.source === "allDay");
                        }
                      }
                    }} onScrollDragLeave={() => { setHoverSlot(""); dragTargetDateRef.current = ""; }}
                      onCanvasMouseDown={(event) => {
                          if (drag || resizePreview || autoScheduleState === "generating") return;
                          if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule")) return;
                          if ((event.target as HTMLElement).closest(".df-all-day-block,.df-all-day-quick")) return;
                          const gridEl = timelineCanvasRef.current;
                          const scrollEl = timelineRef.current;
                          if (!gridEl || !scrollEl) return;
                          const startTarget = getDropTargetFromPointer({
                            clientX: event.clientX, clientY: event.clientY,
                            gridElement: gridEl, scrollElement: scrollEl,
                            visibleDays: [timelineDate],
                            startHour: dayStartHour,
                            hourHeight: timelineHourHeight,
                          });
                          const dailyStartTarget = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(event.clientY) : startTarget;
                          const startMinutes = dailyStartTarget.minutes;
                          const startDate = dailyStartTarget.date;
                          const snap = SLOT_MINUTES;
                          let hasMoved = false;
                          const moveHandler = (moveEvent: MouseEvent) => {
                            if (Math.abs(moveEvent.clientY - event.clientY) < 6) return;
                            hasMoved = true;
                            const currentTarget = getDropTargetFromPointer({
                              clientX: moveEvent.clientX, clientY: moveEvent.clientY,
                              gridElement: gridEl, scrollElement: scrollEl,
                              visibleDays: [timelineDate],
                              startHour: dayStartHour,
                              hourHeight: timelineHourHeight,
                            });
                            const dailyCurrentTarget = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(moveEvent.clientY) : currentTarget;
                            if (dailyCurrentTarget.date !== startDate) return;
                            let s = startMinutes, e = dailyCurrentTarget.minutes;
                            if (s > e) { const t = s; s = e; e = t; }
                            s = Math.max(s, TIMELINE_START * 60);
                            e = Math.min(e, TIMELINE_END * 60 - SLOT_MINUTES);
                            if (e - s < SLOT_MINUTES * 2) e = s + SLOT_MINUTES * 2;
                            const gridRect = gridEl.getBoundingClientRect();
                            const startPx = continuousTimedTop(startDate, minutesToTime(s));
                            const endPx = startPx + ((e - s) / SLOT_MINUTES) * timelineSlotHeight;
                            const gut = compactLayout ? 0 : 8;
                            setDragCreate({
                              date: startDate, dayIndex: 0,
                              startMinutes: s, endMinutes: e,
                              top: startPx, height: endPx - startPx,
                              left: gut, width: gridRect.width - gut * 2,
                              committed: false,
                            });
                          };
                          const keyHandler = (keyEvent: KeyboardEvent) => {
                            if (keyEvent.key === "Escape") {
                              window.removeEventListener("mousemove", moveHandler);
                              window.removeEventListener("mouseup", upHandler);
                              window.removeEventListener("keydown", keyHandler);
                              setDragCreate(null);
                            }
                          };
                          const upHandler = () => {
                            window.removeEventListener("mousemove", moveHandler);
                            window.removeEventListener("mouseup", upHandler);
                            window.removeEventListener("keydown", keyHandler);
                            if (hasMoved) {
                              dragCreateSuppressClickRef.current = true;
                              setDragCreate((prev) => prev ? { ...prev, committed: true } : prev);
                            }
                          };
                          window.addEventListener("mousemove", moveHandler);
                          window.addEventListener("mouseup", upHandler);
                          window.addEventListener("keydown", keyHandler);
                        }}
                        onCanvasClick={(event) => {
                          if (dragCreateSuppressClickRef.current) { dragCreateSuppressClickRef.current = false; return; }
                          if (suppressBlockClickRef.current) return;
                          if (drag || resizePreview) return;
                          if ((event.target as HTMLElement).closest(".df-time-block,.df-suggestion,.df-drop-preview,.df-quick-schedule")) return;
                          if (selectMobilePlacement(event)) return;
                          if (clearTimelineSelection()) return;
                          const startTime = slotFromPointer(event.clientY, 0, event.clientX);
                          const target = settings.continuousCrossDayScroll !== false ? dailyTargetFromPointer(event.clientY) : { date: timelineDate };
                          const startMinutes = timeToMinutes(startTime);
                          const endMinutes = Math.min(startMinutes + 30, TIMELINE_END * 60);
                          const canvasWidth = timelineCanvasRef.current?.getBoundingClientRect().width || 300;
                          setDragCreate({
                            date: target.date,
                            dayIndex: 0,
                            startMinutes,
                            endMinutes,
                            top: settings.continuousCrossDayScroll !== false
                              ? continuousTimedTop(target.date, startTime)
                              : timeBlockTop(startTime, dayStartHour),
                            height: ((endMinutes - startMinutes) / SLOT_MINUTES) * timelineSlotHeight,
                            left: compactLayout ? 0 : 8,
                            width: canvasWidth - (compactLayout ? 0 : 16),
                            committed: true,
                          });
                        }}
                    >
                        <DailyTimelineGrid slotCount={dailyTimelineSlotCount} dayStartHour={dayStartHour} slotHeight={timelineSlotHeight} />
                        {continuousTimelineEnabled && <TimelineDayBoundaries anchorDate={continuousTimelineStartDate} bandCount={continuousTimelineBandCount} columnCount={1} dayStartHour={dayStartHour} slotHeight={timelineSlotHeight} lang={lang} />}
                        {/* Now line — renders whenever today is inside the visible date range.
                            In non-continuous daily mode the range is [timelineDate], so this
                            evaluates to true only when viewing today. In continuous mode the
                            range is the 7-day vertical canvas. Position uses `dayStartHour`
                            in non-continuous mode (via NowLine's internal timeBlockTop) and
                            the continuous absolute coordinate in continuous mode. */}
                        {continuousTimelineDates.includes(today) && (() => { const now = workspaceNow(); return <NowLine highlighted={nowLineReturnPulse} lang={lang} dayStartHour={dayStartHour} hourHeight={timelineHourHeight} extraStyle={{ top: continuousTimelineEnabled ? continuousTimedTop(today, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`) : undefined }} />; })()}
                        {guideSlotHint}
                        {hoverSlot && drag && !drag.outsideTimeline && <SnappedTimelineDragBlock task={draggedTask} startTime={hoverSlot} duration={drag.duration} projectName={draggedTask ? projectName(draggedTask) : ""} projects={projects} viewMode="daily" lang={lang} dayStartHour={dayStartHour} hourHeight={timelineHourHeight} extraStyle={continuousTimelineEnabled ? { top: continuousTimedTop(dragTargetDateRef.current || timelineWindowAnchorDate, hoverSlot) } : undefined} />}
                        {placementPreviewTask && placementPreview && placementChoices.filter((choice) => continuousTimelineDates.includes(choice.date)).map((choice) => (
                          <PreviewBlock
                            key={`${choice.date}-${choice.startTime}`}
                            task={placementPreviewTask}
                            date={choice.date}
                            startTime={choice.startTime}
                            duration={choice.durationMinutes}
                            onConfirm={mobilePlacement ? undefined : () => confirmPlacementChoice(choice)}
                            lang={lang}
                            extraStyle={{ top: continuousTimelineEnabled ? continuousTimedTop(choice.date, choice.startTime) : undefined, ["--df-preview" as any]: "1" } as CSSProperties}
                            dayStartHour={dayStartHour}
                            hourHeight={timelineHourHeight}
                          />
                        ))}
                        {(() => {
                          // Reuse the observer's measurement; at most one fallback
                          // read for the entire list, never one per task.
                          const avail = dailyCanvasWidth > 0 ? dailyCanvasWidth : timelineCanvasRef.current?.getBoundingClientRect().width || 0;
                          return scheduledTasks.map((task) => {
                          const gutter = compactLayout ? 0 : 8;
                          const innerW = avail > 0 ? avail - gutter * 2 : 0;
                          const baseLeft = gutter;
                          const gap = compactLayout ? 2 : 4;
                          const cs = innerW > 0 ? computeConflictStyle(task.id, conflictLayout, innerW, baseLeft, gap, "daily") : null;
                          const left = cs ? cs.left : baseLeft;
                          const width = cs ? cs.width : innerW;
                          const top = continuousTimedTop(task.scheduledDate || timelineDate, task.scheduledStart || "09:00");
                          const extraStyle: CSSProperties | undefined = innerW > 0 ? { left, width, top } : { top };

                          const isPreview = previewIdByClonedId.has(task.id);
                          return (
                            <TimeBlock blockRef={returnGuideAnchorFor(task)} resolvedUnfinished={isResolvedUnfinished(task)} engagementEnabled={engagementEnabled} key={task.id} task={task} preview={resizePreview?.taskId === task.id ? resizePreview : null} projectName={projectName(task)} projects={projects} hovered={hoveredBlock === task.id || resizePreview?.taskId === task.id} showResizeHint={resizeHintTaskId === resolveTimelineRecordId(task.id)} projectInteractive={!compactLayout} onHover={setHoveredBlock} mouseOptimized={dockMouseLayout} onSelect={(event) => selectTimelineTask(task, event)} onEdit={() => {
                              if (!suppressBlockClickRef.current) openTaskEdit(task);
                            }} onToggleDone={() => toggleTaskDone(task.id)} onTaskUpdate={(patch) => updateTask(resolveOwningTask(task.id)?.id || task.id, patch)} onProjectChange={(projectId) => updateTask(resolveOwningTask(task.id)?.id || task.id, { projectId: projectId || undefined })} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onCreateProject={(title) => {
                              createProjectForTask(task.id, title);
                            }} onDragStart={(event) => beginBlockDrag(event, task)} onResizeStart={(event, edge) => beginBlockResize(event, task, edge)} resizeEdges={explicitVisibleTimeline.resizeEdges.get(task.id) || eventVisibleTimeline.resizeEdges.get(task.id)} extraStyle={{ ...extraStyle, ...(isPreview ? { ["--df-preview" as any]: "1" } as CSSProperties : {}), ...(productAiPresentation ? { "--product-arrival-order": scheduledTasks.filter(other => (other.scheduledStart || "") < (task.scheduledStart || "")).length } as CSSProperties : {}) }}
                              onAcceptPreview={isPreview ? () => acceptOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                              onCancelPreview={isPreview ? () => cancelOnePreview(previewIdByClonedId.get(task.id)!) : undefined}
                              viewMode="daily"
                              lang={lang}
                              dayStartHour={dayStartHour}
                              hourHeight={timelineHourHeight}
                              dragState={drag?.kind === "block" && drag.taskId === task.id ? "source-placeholder" : undefined}
                            />
                          );
                          });
                        })()}
                        {dragCreate && (
                          <div className="drag-create-preview df-task-block df-task-block--scheduled df-time-block-quick-add" style={{
                            position: "absolute", zIndex: 99998,
                            overflow: "visible",
                            top: `${dragCreate.top}px`, height: `${dragCreate.height}px`,
                            ...draftConflictStyle(dragCreate, "daily"),
                          }}>
                            {(!dragCreate.committed || !inlineTimelineDraft) && <span className="df-timeline-draft-time">{minutesToTime(dragCreate.startMinutes)} – {minutesToTime(dragCreate.endMinutes)}</span>}
                            <button type="button" className="df-timeline-draft-handle start" aria-label={lang === "zh" ? "拖动调整开始时间" : "Drag to adjust start"} onPointerDown={(event) => beginDragCreateResize(event, "start")} />
                            <button type="button" className="df-timeline-draft-handle end" aria-label={lang === "zh" ? "拖动调整结束时间" : "Drag to adjust end"} onPointerDown={(event) => beginDragCreateResize(event, "end")} />
                            {dragCreate.committed && inlineTimelineDraft ? (
                              <DragCreateQuickAdd state={dragCreate} projects={projects} lang={lang} showTime
                                onSave={(title, projectId, subtasks) => commitDragCreatedTask(dragCreate, title, projectId, subtasks)}
                                onCancel={() => setDragCreate(null)}
                              />
                            ) : (
                              null
                            )}
                          </div>
                        )}
                    </TimelineCanvas>
                  </div>
                )}
              </div>
              {!productPresentation && <div className="df-view-switch-vertical ui-choice-list ui-choice-list--motion-selection" aria-label={t(lang, "timeline.switchView")}>
                <SelectionIndicator activeKey={timelineView + ":" + lang} />
                {([
                  ["daily", viewLabel(lang, "daily")],
                  ["3day", viewLabel(lang, "3day")],
                  ["weekly", viewLabel(lang, "weekly")],
                  ["month", viewLabel(lang, "month")]
                ] as Array<[TimelineView, string]>).map(([view, label]) => <button type="button" key={view} className={"ui-choice-item" + (timelineView === view ? " active" : "")} aria-pressed={timelineView === view} onClick={() => changeTimelineView(view)}>{label}</button>)}
              </div>}
            </div>
          </section>
        </ExecutionSplitLayout>
      {!inlineTimelineDraft && dragCreate?.committed && (
        <DragCreateQuickAdd
          sheet
          lang={lang}
          state={dragCreate}
          projects={projects}
          onSave={(title, projectId, subtasks) => commitDragCreatedTask(dragCreate, title, projectId, subtasks)}
          onMore={(title, projectId, subtasks) => commitDragCreatedTask(dragCreate, title, projectId, subtasks, true)}
          onCancel={() => setDragCreate(null)}
          onRangeChange={updateDragCreateRange}
        />
      )}

      {!productAiPresentation && compactLayout && !compactOverlayOpen && (
        createPortal(<nav className={`df-mobile-dock df-mobile-dock--viewport${settings.theme === "dark" ? " theme-dark" : ""}`} style={themeVars(settings, "execute")} aria-label={lang === "zh" ? "工作区导航" : "Workspace navigation"}>
          {productDemo ? <div className="df-mobile-dock-slots">{compactChat}</div> : <Suspense fallback={<div className="df-mobile-dock-slots">{compactChat}<IconButton className="df-mobile-dock-action df-mobile-more-wrap" label={lang === "zh" ? "更多" : "More"} icon={<UiMoreIcon />} /></div>}>
            <CompactPluginDock lang={lang} chat={compactChat} activePanel={workspacePanel?.kind} activeOwner={workspacePanel?.owner} notificationCount={showNotificationBadge ? proactiveNotifications.length : 0} onNotifications={() => setNotificationCenterOpen(true)} onSearch={() => { setCommandQuery(""); setCommandOpen(true); }} onSettings={() => openSettingsHome()} onHistory={openTaskHistory} onOpenPage={openExtensionPage} />
          </Suspense>}
        </nav>, document.body)
      )}

      {!productPresentation && !compactLayout && !workspacePanel && <button ref={quickAddButtonRef} className="df-add-fab df-icon-action i-plus" data-tip={t(lang, "fab.add")} aria-label={t(lang, "fab.add")} onClick={showGuide && onboardingStep === "add" ? openTaskDraft : () => openAdd("task")} />}
      {!productPresentation && !compactLayout && aiEnabled && (!workspacePanel || aiOpen) && <button className="df-ai-fab df-icon-action i-ai" data-tip={t(lang, "fab.askNavo")} aria-label={t(lang, "fab.askNavo")} aria-pressed={aiOpen} onClick={() => aiOpen ? closeWorkspaceChat() : setAiOpen(true)} />}
      {createPortal(<div className="df-mobile-floating-actions" data-guide-return-drag={returningGuideBlock || undefined} style={themeVars(settings, "execute")}>
        {(mobileExecution || mobilePlacement?.guided) && <Suspense fallback={null}><MobileExecutionControls
          desktop={!mobileExecution}
          hidden={compactFloatingActionsHidden && !mobilePlacement}
          drawerOpen={candidateDrawerOpen} panelRef={candidatePanelRef} scrollRef={candidateScrollRef} onClose={closeCandidateDrawer}
          lang={lang} count={visibleCandidates.filter((task) => !task.completed).length} triggerRef={candidateTriggerRef}
          title={mobilePlacement ? (placementPreviewTask?.title || (lang === "zh" ? "任务已移除" : "Task removed")) : undefined}
          time={mobilePlacement && placementPreview ? `${placementPreview.date} · ${placementPreview.startTime}–${placementPreview.endTime}` : undefined}
          noSlot={mobilePlacement?.noSuggestedSlotDate === timelineWindowAnchorDate ? (timelineWindowAnchorDate === today ? "today" : "selected") : undefined}
          conflict={Boolean(mobilePlacement && placementPreview && getScheduledEventsForRange([addDays(placementPreview.date, -1), placementPreview.date, addDays(placementPreview.date, 1)]).some((item) => (!mobilePlacement.recordId || resolveTimelineRecordId(item.id) !== mobilePlacement.recordId) && item.scheduledStart && item.scheduledEnd && scheduledDateTimesOverlap(placementPreview.date, placementPreview.startTime, placementPreview.endTime, item.scheduledDate || placementPreview.date, item.scheduledStart, item.scheduledEnd)))}
          onOpen={() => {
            setCandidateDrawerExpanded(false);
            if (tourStep === "return") revealTasks();
            else if (onboardingTask || tourWaitingForTasks) revealTasks();
            else { setCandidatePanelCollapsed(false); setCandidateDrawerOpen(true); }
          }} onCancel={() => cancelMobilePlacement(true)} onConfirm={() => void confirmMobilePlacement()} /></Suspense>}
        <MobileQuickAddButton buttonRef={quickAddButtonRef} compactLayout={compactLayout} productPresentation={productPresentation}
        drawerOpen={compactFloatingActionsHidden} notificationCenterOpen={notificationCenterOpen}
        utilityPanelOpen={Boolean(utilityPanel)} aiOpen={aiOpen} lang={lang} style={themeVars(settings, "execute")}
        onAdd={() => openQuickTaskAdd()}
      /></div>, document.body)}

      {drawerOpen && !(compactLayout && mobileTaskSummary) && <div className="df-drawer-backdrop" onMouseDown={() => editingId && addType === "task" ? closeTaskDrawer({ autoSave: true }) : closeTaskDrawer()} />}
      {drawerOpen && <EditDrawer engagementEnabled={engagementEnabled} type={addType} setType={(type) => { if (type === "habit" && !habitsEnabled) return; setAddType(type); if (!editingId) { const initial = defaultForm(type); drawerInitialFormRef.current = initial; setForm(initial); } }} form={form} setForm={setForm} projects={projects} editing={Boolean(editingId)} task={tasks.find((task) => task.id === editingId)} project={projects.find((project) => project.id === editingId)} habit={(data.habits || []).find((habit) => habit.id === editingId)} today={today} onClose={() => closeTaskDrawer(editingId && addType === "task" ? { autoSave: true } : undefined)} onSave={saveForm} onDelete={deleteEditingItem} onCopy={copyEditingTask} onTaskUpdate={updateTask} onQuickReschedule={quickRescheduleTask} onEditSchedule={editTaskSchedule} weekStartsOn={settings.weekStartsOn} onLocateTimeline={locateTaskOnTimeline} onLocateTree={treeView ? locateTaskInTree : undefined} onProjectColorChange={(projectId, color) => updateProject(projectId, { color })} onToggleDone={() => updateTask(editingId, { completed: !tasks.find((task) => task.id === editingId)?.completed })} onCreateProject={quickCreateProject} editingRecordId={editingRecordId} setEditingRecordId={setEditingRecordId} editingOccurrence={editingOccurrence} data={data} saveData={saveData} onSaveRecurrence={saveTaskRecurrence} onCancelOccurrence={cancelRecurringOccurrence} onReplanOccurrence={replanRecurringOccurrence} onCancelAllRecurrence={cancelAllRecurringFuture} aiEnabled={!productDemo && aiEnabled} subtaskAiLoading={subtaskAiBusyId === editingId} subtaskAiRevealIds={subtaskAiRevealIds} onGenerateSubtasks={(taskId) => void generateTaskSubtasks(taskId)} lang={lang} compactSummary={compactLayout && mobileTaskSummary} onCompactActionSuccess={(message) => { void closeTaskDrawer(); showToast(message); }} onShowMore={() => setMobileTaskSummary(false)} />}
      {!productAiPresentation && aiPanel && workspaceChatPanel && <div className="df-utility-backdrop" data-workspace-backdrop data-motion-closing={aiPresence.closing || undefined} onMouseDown={closeWorkspaceChat} />}
      {!productAiPresentation && aiPanel}
      {commandPresence.present && (commandOpen || !workspacePanel) && <Suspense fallback={null}><CommandPalette closing={commandPresence.closing} query={commandQuery} data={data} settings={settings} lang={lang} onQuery={setCommandQuery} onClose={() => setCommandOpen(false)} onChoose={chooseCommand} /></Suspense>}
      {utilityPanel === "metrics" && metricsAvailable && <RightUtilityPanel workspace label={metricsLabel} closeLabel={t(lang, "settings.close")} className="df-metrics-utility" onClose={() => closeUtilityPanel()}>
        <Suspense fallback={<div className="df-shelf-loading" role="status">{lang === "zh" ? "正在打开…" : "Opening…"}</div>}>
          <PlanningViewLazy {...planningViewProps} viewMode="metrics" readingLibrary={readingEnabled ? reading.library ?? undefined : undefined} tasks={tasks} analyticsScope={productDemo?undefined:authState?.user?.id||"preview"} dayStartTime={settings.dayStartTime} weekStartsOn={settings.weekStartsOn}
            metricsRangePreset={settings.metricsRangePreset} metricsGroupBy={settings.metricsGroupBy}
            metricsDisplayMetric={settings.metricsDisplayMetric} metricsIncludeHabits={settings.metricsIncludeHabits}
            metricsCompletionFilter={settings.metricsCompletionFilter} metricsCustomStart={settings.metricsCustomStart}
            metricsCustomEnd={settings.metricsCustomEnd} onMetricsSettingsChange={(patch) => void saveSettings(patch)} />
        </Suspense>
      </RightUtilityPanel>}
      {utilityPanel && utilityPanel !== "metrics" && utilityPanel !== "extension" && settings && <Suspense fallback={<SettingsLoading lang={lang} onClose={() => closeUtilityPanel()} />}><UtilityPanel kind={utilityPanel} settings={settings} initialSection={settingsSectionTarget} onboardingSettings={onboardingSettings} compactLayout={compactLayout} data={data} authEmail={authState?.user?.email || ""} onClose={() => closeUtilityPanel()} onRestartOnboarding={() => {
        closeUtilityPanel(() => {
          void saveSettings(ONBOARDING_START);
          setShelfViewId("");
          setFullscreen(false);
          setCandidatePanelCollapsed(false);
          setCandidateDrawerOpen(false);
          setCompactExecuteView(mobileExecution ? "schedule" : "tasks");
        });
      }} onSave={(patch) => void saveSettings(patch)} onSaveProfile={async (patch) => { await saveSettings(patch); await flushPendingSettings({ urgent: true }); }} onWidgetAction={handleWidgetAction} onSaveData={(next) => void saveData(next)} onClearChatHistory={() => { void saveData({ ...data, chat: [], aiConversations: [], activeAiConversationId: undefined }); setAiMessages([]); setActiveAiConversationId(""); setAiConversationListOpen(false); setAiMemoryNotice(""); }} onShowAbout={() => window.open(`https://navopath.com/changelog?lang=${lang}`, "_blank", "noopener,noreferrer")} onOpenNotifications={() => setNotificationCenterOpen(true)} onSignOut={authState?.mode === "cloud" && authState.user ? (() => void handleSignOut()) : undefined} onDeleteAccount={authState?.mode === "cloud" && authState.user ? (() => void handleDeleteAccount()) : undefined} onSyncNow={(direction) => handleSyncNow({ direction })} isManualSyncing={isManualSyncing} cloudReady={authState?.mode === "cloud" && Boolean(authState?.user)} settingsSavePhase={saveFeedback.settings} lang={lang} /></Suspense>}
      {utilityPanel === "extension" && activeExtensionPanel && <RightUtilityPanel workspace label={activeExtensionPanel.nativeMode === "activity-history" ? (lang === "zh" ? "活动历史" : "Activity history") : activeExtensionPanel.name} closeLabel={t(lang, "settings.close")} className="df-extension-utility" onClose={() => closeUtilityPanel()}>
        {activeExtensionPanel.nativeMode === "activity-history" ? <Suspense fallback={<div className="df-shelf-loading" role="status">{lang === "zh" ? "正在打开…" : "Opening…"}</div>}>
          <TaskOperationHistory operations={taskOperations} projects={projects} lang={lang} now={workspaceNow()} label={lang === "zh" ? "活动历史" : "Activity history"} onUndo={undoTaskOperation} />
        </Suspense> : <div className="df-extension-page-content"><ExtensionMount contribution={activeExtensionPanel} lang={lang} /></div>}
      </RightUtilityPanel>}
      {habitPanel && data && habitsEnabled && <HabitPanel mode={habitPanel} habitId={editingHabitId} draft={newHabitDraft} data={data} today={today} lang={lang} onClose={() => { setHabitPanel(null); setEditingHabitId(null); setNewHabitDraft(null); }} onEditHabit={openHabitDetail} onBack={openHabitOverview} onSave={saveHabitEdit} onArchive={toggleHabitArchive} onToggleDay={toggleHabitForDate} onDeleteHabit={deleteHabitPermanently} onCreateHabit={createHabit} onConvertTo={openHabitConvert} />}
      {focusOverlayMode && (
        <RightUtilityPanel workspace label={focusProvider?.label[lang] || (lang === "zh" ? "专注" : "Focus")} closeLabel={t(lang, "settings.close")} className="df-focus-utility" onClose={() => setFocusOverlayMode(null)}>
          <FocusTimerPanel
            lang={lang}
            mode={focusOverlayMode}
            modes={[...getTimerModes().filter(item => item.mode !== "countdown"), ...(flowtimeEnabled ? [{ mode: "flowtime", zh: "Flowtime", en: "Flowtime" }] : [])]}
            onModeChange={chooseFocusMode}
            clock={focusClockDisplay}
            clockFont={normalizePomodoroClockFont(settings.extensionConfigs?.[POMODORO_EXTENSION_KEY]?.clockFont)}
            note={focusModeNote}
            task={focusTask}
            project={focusProject}
            onOpenTasks={() => { setFocusOverlayMode(null); revealTasks(); }}
            running={focusProvider ? Boolean(focusTick?.runtime.running) : timerRunning}
            canStart={Boolean(focusTask || focusProvider || timerTaskId)}
            canSave={focusIsPomodoro ? Boolean(focusSessionTaskId && focusElapsed > 0) : Boolean(timerTaskId)}
            canReset={focusIsPomodoro ? focusSessionStarted || Boolean(pomodoroTaskChoice) : Boolean(timerTaskId || widgetTimerRuntime.unlinked)}
            pomodoro={focusIsPomodoro && focusTick ? {
              runtime: focusTick.runtime,
              longBreakEvery: widgetTimerPreferences.longBreakEvery,
              started: focusSessionStarted,
              taskChoice: pomodoroTaskChoice,
              tasks,
              projects,
              onTaskChoice: setPomodoroTaskChoice,
              onCreateTask: async () => {
                const title = await dialog.prompt(lang === "zh" ? "添加任务" : "Add task", "", {
                  placeholder: lang === "zh" ? "任务名称" : "Task name",
                  confirmLabel: lang === "zh" ? "添加" : "Add",
                });
                if (title?.trim()) {
                  const taskId = widgetQuickAdd(title);
                  if (taskId && resolvePomodoroSessionTaskId(widgetTimerRuntimeRef.current, timerTaskRef.current) === undefined) setPomodoroTaskChoice(taskId);
                }
              },
              onEnd: () => handleWidgetAction({ type: "finishPomodoro", save: false, startedAt: focusRuntime.pomodoroStartedAt }),
            } : undefined}
            onToggle={() => {
              if (focusIsPomodoro && !focusSessionStarted) handleWidgetAction({ type: "startPomodoro", taskId: pomodoroTaskChoice });
              else if (focusProvider) handleWidgetAction({ type: "toggleWidgetTimer" });
              else if (timerRunning) pauseTimer();
              else if (timerTaskId) resumeTimer();
              else if (focusTask) startTimer(focusTask.id);
            }}
            resuming={Boolean(timerTaskId || widgetTimerRuntime.unlinked)}
            onSave={() => {
              if (focusIsPomodoro) handleWidgetAction({ type: "finishPomodoro", save: true, startedAt: focusRuntime.pomodoroStartedAt });
              else stopAndSaveTimer();
            }}
            onReset={async () => {
              if (focusIsPomodoro) {
                if (focusSessionTaskId && focusElapsed > 0 && !await dialog.confirm(lang === "zh" ? "重置本轮计时？" : "Reset this session?", {
                  message: lang === "zh" ? "本轮尚未记录的专注用时会被清除。" : "Unsaved focus time from this session will be discarded.",
                  confirmLabel: lang === "zh" ? "重置" : "Reset",
                })) return;
                setPomodoroTaskChoice(undefined);
                handleWidgetAction({ type: "finishPomodoro", save: false, startedAt: focusRuntime.pomodoroStartedAt });
              } else {
                if (focusProvider) handleWidgetAction({ type: "resetWidgetTimer", draft: widgetTimerPreferences });
                discardTimer();
              }
            }}
          />
        </RightUtilityPanel>
      )}
      {scheduleTemplatePresence.present && (scheduleTemplateOpen || !workspacePanel) && data && (
        <RightUtilityPanel workspace label={lang === "zh" ? "日程模板" : "Schedule templates"} closeLabel={t(lang, "settings.close")} closing={scheduleTemplatePresence.closing} className="df-template-utility" onClose={() => setScheduleTemplateOpen(false)}>
          <Suspense fallback={null}>
            <ScheduleTemplatePanel
              active={scheduleTemplateOpen}
              lang={lang}
              today={today}
              weekStartsOn={settings.weekStartsOn}
              slotHeight={timelineSlotHeight}
              customTemplates={data.scheduleTemplates || []}
              onSaveCustomTemplates={(update) => {
                const current = dataRef.current;
                if (!current) return;
                const previous = current.scheduleTemplates ?? [];
                const next = update(previous);
                if (next !== previous) void saveData({ ...current, scheduleTemplates: next });
              }}
              getApplication={getTemplateApplication}
              onApply={applyTemplateToDate}
              confirmDelete={(name) => dialog.confirm(lang === "zh" ? "删除「" + name + "」？" : "Delete “" + name + "”?", {
                confirmLabel: lang === "zh" ? "删除" : "Delete",
              })}
            />
          </Suspense>
        </RightUtilityPanel>
      )}
      {drag?.kind === "block" && drag.pointer && draggedTask && !timelineSnapActive && (
        <TaskDragLayer
          pointer={drag.pointer}
          sourceRect={{ width: drag.sourceRect?.width || 220, height: drag.sourceRect?.height || Math.max(timeBlockHeight(draggedTask.scheduledStart || "09:00", draggedTask.scheduledEnd || addMinutes(draggedTask.scheduledStart || "09:00", drag.duration)), SLOT_HEIGHT) }}
          offset={drag.offset || { x: 24, y: Math.min((drag.sourceRect?.height || SLOT_HEIGHT) / 2, 32) }}
        >
          <TimeBlock
            task={draggedTask}
            preview={null}
            projectName={projectName(draggedTask)}
            projects={projects}
            hovered={false}
            onHover={() => {}}
            onSelect={() => {}}
            onEdit={() => {}}
            onToggleDone={() => {}}
            onTaskUpdate={() => {}}
            onProjectChange={() => {}}
            onProjectColorChange={() => {}}
            onCreateProject={() => {}}
            onDragStart={() => {}}
            onResizeStart={() => {}}
            extraStyle={{ position: "relative", top: 0, left: 0, width: "100%", height: "100%" }}
            viewMode={timelineView === "month" ? "daily" : timelineView}
            lang={lang}
            dayStartHour={dayStartHour}
            dragState="overlay"
          />
        </TaskDragLayer>
      )}
      {drag?.source === "allDay" && drag.pointer && !hoverSlot && !allDayDragDate && !dragOverlay && <FloatingShelfDragPreview task={draggedTask} pointer={drag.pointer} candidateTarget={candidateDropActive} lang={lang} />}
      {drag?.source === "candidate" && drag.pointer && draggedTask && !timelineSnapActive && (
        <TaskDragLayer pointer={drag.pointer} sourceRect={drag.sourceRect || { width: 360, height: 44 }} offset={drag.offset || { x: 24, y: 22 }}>
          <TaskCard
            task={draggedTask}
            projects={projects}
            focusDate={today}
            placementPreview={null}
            placementChoices={[]}
            onQuickDuration={() => {}}
            onProjectChange={() => {}}
            onDelete={() => {}}
            onStartPlacementPreview={() => {}}
            onCancelPlacementPreview={() => {}}
            onConfirmPlacementPreview={() => {}}
            onConfirmPlacementChoice={() => {}}
            onScheduleDate={() => {}}
            onSaveDueDate={() => {}}
            onSaveRecurrence={() => {}}
            onClick={() => {}}
            onPointerDragStart={() => {}}
            onToggleDone={() => {}}
            onToggleSubtask={() => {}}
            onSubtaskDragStart={() => {}}

            onMarkUnfinished={() => {}}
            onUnschedule={() => {}}
            onMetaUpdate={() => {}}
            dragState="overlay"
            lang={lang}
          />
          {candidateDropTarget?.kind === "project" && <span className="df-project-drop-hint" role="status">{lang === "zh" ? "松手后归属此项目" : "Release to assign to this project"}</span>}
          {candidateDropTarget?.kind === "task" && <span className="df-project-drop-hint" role="status">{lang === "zh"
            ? `松手后放到目标${candidateDropTarget.position === "before" ? "上方" : "下方"}`
            : `Release to place ${candidateDropTarget.position === "before" ? "above" : "below"}`}</span>}
        </TaskDragLayer>
      )}
      {dragOverlay && dragOverlayTask && drag?.source !== "candidate" && !timelineSnapActive && (
        <TaskDragLayer pointer={dragOverlayPointer} sourceRect={{ width: dragOverlay.sourceRect.width, height: dragOverlay.sourceRect.height }} offset={dragOverlay.offset}>
          <TaskCard
            task={activeDragItem?.taskSnapshot || dragOverlayTask.task}
            projects={projects}
            focusDate={today}
            placementPreview={null}
            placementChoices={[]}
            onQuickDuration={() => {}}
            onProjectChange={() => {}}
            onDelete={() => {}}
            onStartPlacementPreview={() => {}}
            onCancelPlacementPreview={() => {}}
            onConfirmPlacementPreview={() => {}}
            onConfirmPlacementChoice={() => {}}
            onScheduleDate={() => {}}
            onSaveDueDate={() => {}}
            onSaveRecurrence={() => {}}
            onClick={() => {}}
            onPointerDragStart={() => {}}
            onToggleDone={() => {}}
            onToggleSubtask={() => {}}
            onSubtaskDragStart={() => {}}

            onMarkUnfinished={() => {}}
            onUnschedule={() => {}}
            onMetaUpdate={() => {}}
            dragState="overlay"
            lang={lang}
          />
        </TaskDragLayer>
      )}
      {dragOverlay && !dragOverlayTask && drag?.kind !== "block" && <UnifiedDragOverlay snapshot={dragOverlay} pointer={dragOverlayPointer} />}
      {toast && (
        <div key={toast.deletionId} className={toastAction ? "df-toast df-toast-undo" : "df-toast"}>
          <span className="df-toast-message" role="status">{toast.deletionId && <UiTrashIcon className="df-toast-delete-icon" size={15} />}{toast.message}</span>
          {toastAction && (toastAction.undo
            ? <UndoButton onClick={toastAction.onClick}>{toastAction.label}</UndoButton>
            : <Button variant="text" onClick={toastAction.onClick}>{toastAction.label}</Button>)}
        </div>
      )}
    </div>
  );
}

function FloatingShelfDragPreview({ task, pointer, candidateTarget, lang }: { task?: Task; pointer: { x: number; y: number }; candidateTarget: boolean; lang: Language }) {
  if (!task) return null;
  const hint = candidateTarget
    ? (lang === "zh" ? "放回任务" : "Return to Tasks")
    : (lang === "zh" ? "拖到时间轴安排" : "Drag to timeline to schedule");
  return <div className={`df-floating-unschedule df-floating-shelf-drag${candidateTarget ? " candidate-target" : ""}`} style={{ left: pointer.x + 14, top: pointer.y + 14 }}><strong>{task.title}</strong><span>{hint}</span></div>;
}

/** Quick-add popover for all-day bar clicks. */
function AllDayQuickAddPopover({ add, projects, onSave, onCancel, absolute }: { add: NonNullable<AllDayQuickAdd>; projects: Project[]; onSave: (title: string, projectId: string | null) => void; onCancel: () => void; absolute?: boolean }) {
  const [input, setInput] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const inputBoxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputBoxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onCancel();
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onCancel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  function handleInputChange(value: string) {
    setInput(value);
    const hm = value.match(/#([^\s#]*)$/);
    setProjectQuery(hm ? hm[1] || "" : "");
  }

  function selectProject(project: Project) {
    setSelectedProject(project);
    const base = input.replace(/#[^\s#]*$/, "").trimEnd();
    setInput(`${base}${base ? " " : ""}#${project.title}`);
    setProjectQuery("");
    inputRef.current?.focus();
  }

  function handleSave() {
    if (!input.trim()) return;
    const cleanTitle = input.replace(/#[^\s#]+/g, "").trim();
    if (!cleanTitle) return;
    onSave(cleanTitle, selectedProject?.id || null);
  }

  const showProjectMenu = input.includes("#") && !input.endsWith(" ");
  const filtered = showProjectMenu
    ? projects.filter((p) => p.title.toLowerCase().includes(projectQuery.toLowerCase()))
    : [];

  // Align popover with the column
  const INPUT_H = 36;
  let pos: "absolute" | "fixed" | "relative" = "fixed";
  let top: number | undefined;
  let left: number | string | undefined;
  let width: number | string = "100%";
  if (absolute) {
    pos = "relative";
    top = undefined;
    left = undefined;
    width = "100%";
  } else {
    pos = "fixed";
    top = add.top;
    left = add.left;
    width = add.width;
    if (top! + INPUT_H + 60 > window.innerHeight) {
      top = add.top - INPUT_H - 8;
    }
    top = Math.max(top!, 8);
  }

  // Compact mode
  const compact = !absolute && typeof width === "number" && width < 110;
  const placeholder = compact ? "任务名" : "输入任务名，#选择项目";

  // Menu position (independent sibling layer)
  const menuTop = typeof top === "number" ? top + INPUT_H + 6 : 0;
  const menuWidth = typeof width === "number" ? Math.max(220, width) : 220;
  let menuLeft = typeof left === "number" ? left : 8;
  if (menuLeft + menuWidth > window.innerWidth - 8) {
    menuLeft = window.innerWidth - menuWidth - 8;
  }

  const popup = (
    <>
      <div ref={inputBoxRef} className="df-quick-add-input-box"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        style={{ position: pos, top, left, width, height: INPUT_H, zIndex: 999999 } as React.CSSProperties}
      >
        <input ref={inputRef} value={input} onChange={(e) => handleInputChange(e.target.value)}
          enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } if (e.key === "Escape") onCancel(); }}
          placeholder={placeholder} />
        <button onClick={handleSave}
          disabled={!input.trim()}
          className="df-quick-add-confirm">✓</button>
      </div>
      {showProjectMenu && filtered.length > 0 && (
        <div ref={menuRef} className="df-quick-add-project-menu ui-divided-list"
          style={{
            position: "fixed", top: menuTop, left: menuLeft, width: menuWidth, zIndex: 1000000,
          }}
        >
          {filtered.map((p) => (
            <button key={p.id} onMouseDown={(e) => { e.preventDefault(); selectProject(p); }}
            >#{p.title}</button>
          ))}
        </div>
      )}
    </>
  );

  if (absolute) return popup;
  return createPortal(popup, document.getElementById("df-portal-target") || document.body);
}

type CandidateTimeSettings = {
  date: string;
  startTime: string;
  durationMinutes: number;
  allDay: boolean;
  clearSchedule?: boolean;
};

function habitDragTaskId(habitId: string) {
  return `habit:${habitId}`;
}

function habitDragTask(habit: Habit, dueDate: string): Task {
  const duration = Math.max(habit.defaultDurationMinutes || 15, 5);
  return {
    id: habitDragTaskId(habit.id),
    title: habit.title,
    projectId: habit.projectId,
    dueDate,
    category: "personal",
    priority: null,
    notes: "",
    goalId: "",
    completed: false,
    estimatedHours: duration / 60,
    createdAt: "",
    updatedAt: "",
  };
}

function HabitCandidateCard(props: {
  habits: Habit[];
  projects: Project[];
  habitDailyStates: HabitDailyState[];
  today: string;
  lang: Language;
  onToggle: (habitId: string, completed: boolean) => void;
  onPointerDragStart: (event: React.PointerEvent, habit: Habit) => void;
  onFocusScheduled: (recordId: string) => void;
  onEditHabit: (habitId: string) => void;
  onOpenOverview: () => void;
  isClickSuppressed?: () => boolean;
  draggedHabitId: string | null;
}) {
  const active = props.habits
    .filter((habit) => !habit.archived)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const completed = active.filter((habit) => isHabitWithinDateRange(habit, props.today) && props.habitDailyStates.some((state) => state.habitId === habit.id && state.date === props.today && state.completed)).length;
  if (active.length === 0) return null;

  return (
    <TaskGroup
      className="df-habit-candidate-card"
      title={(
        <span className="df-habit-card-title">
          <strong>{props.lang === "zh" ? "习惯" : "Habits"}</strong>
        </span>
      )}
      count={`${completed}/${active.length}`}
      onClick={() => { if (!props.isClickSuppressed?.()) props.onOpenOverview(); }}
      aria-label={props.lang === "zh" ? "习惯" : "Habits"}
    >
      {active.map((habit) => {
        const state = props.habitDailyStates.find((item) => item.habitId === habit.id && item.date === props.today);
        const inDateRange = isHabitWithinDateRange(habit, props.today);
        const isDone = inDateRange && Boolean(state?.completed);
        return (
          <TaskBlock
            as="article"
            variant="habit-child"
            appearance="calm"
            checked={isDone}
            selected={Boolean(state?.timelineRecordId)}
            projectColor={props.projects.find((project) => project.id === habit.projectId)?.color}
            key={habit.id}
            className={`df-habit-candidate-row${isDone ? " completed" : ""}${state?.timelineRecordId ? " scheduled" : ""}${inDateRange ? "" : " is-out-of-range"}`}
            dragState={props.draggedHabitId === habitDragTaskId(habit.id) ? "source-placeholder" : undefined}
            onPointerDown={inDateRange ? (event) => props.onPointerDragStart(event, habit) : undefined}
            onClick={(event) => { event.stopPropagation(); if (!props.isClickSuppressed?.()) props.onEditHabit(habit.id); }}
            title={props.lang === "zh" ? "点击编辑，拖动安排到时间轴" : "Click to edit, drag to schedule"}
          >
            <TaskBlockRow>
              <TaskCheckbox lang={props.lang}
                checked={isDone}
                disabled={!inDateRange}
                tone="muted"
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.stopPropagation(); props.onToggle(habit.id, !isDone); }}
              >
                {isDone ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : ""}
              </TaskCheckbox>
              <TaskBlockContent title={habit.title} />
              <TaskBlockDuration>
                {state?.timelineRecordId ? (
                  <button
                    type="button"
                    className="df-habit-scheduled"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); props.onFocusScheduled(state.timelineRecordId!); }}
                    aria-label={props.lang === "zh" ? "跳转到已规划的习惯安排" : "Jump to planned habit schedule"}
                  >
                    {props.lang === "zh" ? "已规划" : "Planned"}
                  </button>
                ) : (`${habit.defaultDurationMinutes || 15}m`)}
              </TaskBlockDuration>
            </TaskBlockRow>
          </TaskBlock>
        );
      })}
    </TaskGroup>
  );
}

function HabitPanel(props: {
  mode: "overview" | "detail";
  habitId: string | null;
  draft: Habit | null;
  data: PlannerData;
  today: string;
  lang: Language;
  onClose: () => void;
  onEditHabit: (habitId: string) => void;
  onBack: () => void;
  onSave: (habitId: string, patch: Partial<Habit>) => void;
  onArchive: (habitId: string, archived: boolean) => void;
  onToggleDay: (habitId: string, date: string, completed: boolean) => void;
  onDeleteHabit: (habitId: string) => void;
  onCreateHabit: () => void;
  onConvertTo: (habit: Habit, targetType: "task" | "project") => void;
}) {
  const editorRef = useRef<{ save: () => void }>(null);
  const metrics = buildHabitMetrics(props.data, props.today);
  const zh = props.lang === "zh";
  const weekdays = weekdayLabels(props.lang);
  const archivedHabits = (props.data.habits || [])
    .filter((habit) => habit.archived)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const detailHabit = props.mode === "detail" && props.habitId
    ? (props.data.habits || []).find((h) => h.id === props.habitId) || (props.draft?.id === props.habitId ? props.draft : null)
    : null;
  const creating = Boolean(detailHabit && props.draft?.id === detailHabit.id && !props.data.habits?.some((habit) => habit.id === detailHabit.id));
  const close = () => {
    if (!creating) editorRef.current?.save();
    props.onClose();
  };

  return (
    <>
      <div className="df-utility-backdrop" onMouseDown={close} />
      <aside className="df-utility-panel df-habit-panel">
        <div className="df-utility-head">
          <h2>{creating ? (zh ? "创建习惯" : "Create Habit") : props.mode === "detail" && detailHabit ? (zh ? "编辑习惯" : "Edit Habit") : (zh ? "习惯总览" : "Habits Overview")}</h2>
          <CloseButton label={zh ? "关闭" : "Close"} onClick={close} />
        </div>
        <div className="df-utility-body">
          {props.mode === "overview" ? (
            <HabitOverviewBody metrics={metrics} archivedHabits={archivedHabits} dailyStates={props.data.habitDailyStates || []} zh={zh} today={props.today} onEditHabit={props.onEditHabit} onArchive={props.onArchive} onToggleDay={props.onToggleDay} onCreateHabit={props.onCreateHabit} />
          ) : detailHabit ? (
            <Suspense fallback={<p className="df-habit-empty">{zh ? "正在打开习惯…" : "Opening habit…"}</p>}><HabitDetailBodyLazy key={detailHabit.id} ref={editorRef} habit={detailHabit} creating={creating} projects={props.data.projects} dailyStates={props.data.habitDailyStates || []} today={props.today} zh={zh} weekdays={weekdays} onSave={(patch) => props.onSave(detailHabit.id, patch)} onToggleDay={(date, completed) => props.onToggleDay(detailHabit.id, date, completed)} onDelete={() => props.onDeleteHabit(detailHabit.id)} onBack={() => { editorRef.current?.save(); props.onBack(); }} onConvertTo={(targetType) => { editorRef.current?.save(); props.onConvertTo(detailHabit, targetType); }} /></Suspense>
          ) : (
            <p className="df-habit-empty">{zh ? "未找到该习惯。" : "Habit not found."}</p>
          )}
        </div>
      </aside>
    </>
  );
}

function HabitOverviewBody(props: {
  metrics: HabitMetrics;
  archivedHabits: Habit[];
  dailyStates: HabitDailyState[];
  zh: boolean;
  today: string;
  onEditHabit: (habitId: string) => void;
  onArchive: (habitId: string, archived: boolean) => void;
  onToggleDay: (habitId: string, date: string, completed: boolean) => void;
  onCreateHabit: () => void;
}) {
  const { metrics, zh } = props;
  const [weekOffset, setWeekOffset] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(props.today.slice(0, 7));
  const baseDay = addDays(props.today, weekOffset * 7);
  const baseDate = new Date(`${baseDay}T00:00:00`);
  const mondayOffset = (baseDate.getDay() + 6) % 7;
  const weekStart = addDays(baseDay, -mondayOffset);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const fmt = (iso: string) => iso.slice(5).replace("-", "/");
  const weekRange = `${fmt(weekDays[0])} - ${fmt(weekDays[6])}`;
  const selectDate = (date: string) => {
    const dateWeekStart = addDays(date, -((new Date(`${date}T00:00:00`).getDay() + 6) % 7));
    const todayWeekStart = addDays(props.today, -((new Date(`${props.today}T00:00:00`).getDay() + 6) % 7));
    const offset = Math.round((Date.parse(`${dateWeekStart}T00:00:00Z`) - Date.parse(`${todayWeekStart}T00:00:00Z`)) / 604800000);
    setWeekOffset(offset);
    setDatePickerOpen(false);
  };
  const weekdayShort = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return zh
      ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()]
      : d.toLocaleDateString("en-US", { weekday: "short" });
  };
  const dayNum = (iso: string) => iso.slice(8);
  return (
    <>
      <section className="df-habit-overview" aria-label={zh ? "习惯周视图" : "Habit week view"}>
        <header className="df-habit-overview-toolbar">
          <div className="df-habit-overview-range">
            <button type="button" className="df-habit-overview-range-trigger" aria-expanded={datePickerOpen} onClick={() => { setDatePickerMonth(weekDays[0].slice(0, 7)); setDatePickerOpen((open) => !open); }}>{weekRange}<span className="df-date-title-chevron" aria-hidden="true">⌄</span></button>
            <span>{zh ? `${metrics.todayCompleted}/${metrics.todayDue} 今日完成` : `${metrics.todayCompleted}/${metrics.todayDue} complete today`}</span>
          </div>
          <div className="df-habit-overview-actions">
            <button type="button" className="df-habit-nav" aria-label={zh ? "上一周" : "Previous week"} onClick={() => setWeekOffset((value) => value - 1)}>‹</button>
            <button type="button" className="df-habit-nav" onClick={() => setWeekOffset(0)}>{zh ? "今天" : "Today"}</button>
            <button type="button" className="df-habit-nav" aria-label={zh ? "下一周" : "Next week"} onClick={() => setWeekOffset((value) => value + 1)}>›</button>
            <button type="button" className="df-habit-overview-add" onClick={props.onCreateHabit}>{zh ? "+ 新增习惯" : "+ New habit"}</button>
          </div>
        </header>

        {<DateQuickPicker open={datePickerOpen} month={datePickerMonth} selectedDate={weekDays[0]} today={props.today} weekStartsOn={1} lang={zh ? "zh" : "en"} onMonthChange={setDatePickerMonth} onSelect={selectDate} />}

        <div className="df-habit-overview-table" role="grid">
          <div className="df-habit-overview-thead" role="row">
            <span className="df-habit-overview-th-label" role="columnheader">{zh ? "习惯" : "Habit"}</span>
            {weekDays.map((day) => (
              <span
                key={day}
                className={`df-habit-overview-th-day${day === props.today ? " is-today" : ""}`}
                role="columnheader"
              >
                <b>{weekdayShort(day)}</b>
                <small>{dayNum(day)}</small>
              </span>
            ))}
          </div>

          {metrics.perHabit.length === 0 ? (
            <EmptyState announce title={zh ? "还没有启用习惯" : "No active habits yet"}>
              <Button variant="primary" onClick={props.onCreateHabit}>{zh ? "新增习惯" : "New habit"}</Button>
            </EmptyState>
          ) : metrics.perHabit.map((item) => (
            <div key={item.habit.id} className="df-habit-overview-trow" role="row">
              <button type="button" className="df-habit-overview-name" onClick={() => props.onEditHabit(item.habit.id)}>
                <span className="df-habit-overview-name-text">{item.habit.title}</span>
                <small className="df-habit-overview-duration">{item.habit.defaultDurationMinutes || 15}m</small>
              </button>
              {weekDays.map((day) => {
                const state = props.dailyStates.find((entry) => entry.habitId === item.habit.id && entry.date === day);
                const due = isHabitDueOnDate(item.habit, day);
                const completed = due && Boolean(state?.completed);
                const planned = due && Boolean(state?.timelineRecordId);
                return (
                  <button
                    type="button"
                    key={`${item.habit.id}-${day}`}
                    className={`df-habit-overview-cell${day === props.today ? " is-today" : ""}${completed ? " is-done" : ""}${planned ? " is-planned" : ""}${due ? " is-due" : ""}`}
                    aria-pressed={completed}
                    aria-label={`${!due ? (zh ? "无需检查" : "Not scheduled") : completed ? (zh ? "取消完成" : "Mark incomplete") : (zh ? "完成" : "Mark complete")} ${item.habit.title} ${day}`}
                    disabled={!due}
                    onClick={() => props.onToggleDay(item.habit.id, day, !completed)}
                  >
                    <span className="df-habit-overview-dot" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="df-habit-overview-archived">
        <button type="button" className="df-habit-overview-archived-toggle" aria-expanded={listOpen} onClick={() => setListOpen((open) => !open)}>
          <span>{zh ? "已禁用的习惯" : "Disabled Habits"}</span>
          <small>{props.archivedHabits.length}</small>
          <i aria-hidden="true" className="df-habit-overview-chevron">{listOpen ? "▾" : "▸"}</i>
        </button>
        {listOpen && (
          props.archivedHabits.length === 0 ? (
            <EmptyState compact title={zh ? "暂无已禁用习惯" : "No disabled habits"} />
          ) : (
            <ul className="df-habit-overview-archived-list">
              {props.archivedHabits.map((habit) => (
                <li key={habit.id} className="df-habit-overview-archived-row">
                  <button type="button" className="df-habit-overview-archived-name" onClick={() => props.onEditHabit(habit.id)} title={zh ? "查看 / 编辑" : "View / Edit"}>
                    <span className="df-habit-overview-archived-title">{habit.title}</span>
                    <small>{habit.defaultDurationMinutes || 15}m</small>
                  </button>
                  <div className="df-habit-overview-archived-tools">
                    <button
                      type="button"
                      className="df-habit-overview-tool"
                      onClick={() => props.onEditHabit(habit.id)}
                      title={zh ? "编辑" : "Edit"}
                      aria-label={zh ? "编辑" : "Edit"}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2.5l2.5 2.5L5 13.5H2.5V11z"/><path d="M9.5 4l2.5 2.5"/></svg>
                    </button>
                    <button
                      type="button"
                      className="df-habit-overview-tool"
                      onClick={() => props.onArchive(habit.id, false)}
                      title={zh ? "恢复启用" : "Restore"}
                      aria-label={zh ? "恢复启用" : "Restore"}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a5 5 0 1 1 1.5 3.5"/><path d="M3 4v4h4"/></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </>
  );
}

function LegacyHabitDetailBody(props: {
  habit: Habit;
  dailyStates: HabitDailyState[];
  today: string;
  zh: boolean;
  weekdays: string[];
  onSave: (patch: Partial<Habit>) => void;
  onArchive: (archived: boolean) => void;
  onBack: () => void;
}) {
  const { habit, dailyStates, today, zh, weekdays } = props;
  const [title, setTitle] = useState(habit.title);
  const [notes, setNotes] = useState(habit.notes || "");
  const [duration, setDuration] = useState(String(habit.defaultDurationMinutes || 15));
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>(habit.activeWeekdays ?? [1, 2, 3, 4, 5]);
  const [targetCount, setTargetCount] = useState(String(habit.targetCount || ""));
  const [trackingType, setTrackingType] = useState<HabitTrackingType>(habit.trackingType || "click-counter");
  const [enabled, setEnabled] = useState(!habit.archived);
  const [weekOffset, setWeekOffset] = useState(0);

  // Sync local state when habit prop changes (e.g. after save)
  useEffect(() => {
    setTitle(habit.title);
    setNotes(habit.notes || "");
    setDuration(String(habit.defaultDurationMinutes || 15));
    setActiveWeekdays(habit.activeWeekdays ?? [1, 2, 3, 4, 5]);
    setTargetCount(String(habit.targetCount || ""));
    setTrackingType(habit.trackingType || "click-counter");
    setEnabled(!habit.archived);
    setWeekOffset(0);
  }, [habit.id, habit.updatedAt]);

  function toggleWeekday(day: number) {
    const next = activeWeekdays.includes(day) ? activeWeekdays.filter((d) => d !== day) : [...activeWeekdays, day].sort();
    setActiveWeekdays(next);
  }

  function saveChanges() {
    const parsedDuration = Number(duration);
    const parsedTarget = Number(targetCount);
    props.onSave({
      title: title.trim() || habit.title,
      notes,
      trackingType,
      defaultDurationMinutes: parsedDuration >= SLOT_MINUTES && parsedDuration <= 480 && parsedDuration % SLOT_MINUTES === 0 ? parsedDuration : habit.defaultDurationMinutes,
      activeWeekdays,
      targetCount: targetCount.trim() && parsedTarget >= 0 ? parsedTarget : undefined,
      archived: !enabled,
    });
  }
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const baseDay = addDays(today, weekOffset * 7);
  const baseDate = new Date(`${baseDay}T00:00:00`);
  const weekStart = addDays(baseDay, -((baseDate.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const dueDays = weekDays.filter((date) => isHabitDueOnDate(habit, date));
  const completedDates = new Set(dailyStates.filter((state) => state.habitId === habit.id && state.completed).map((state) => state.date));
  const completedDays = dueDays.filter((date) => completedDates.has(date));
  const weekRange = `${weekDays[0].slice(5).replace("-", "/")} - ${weekDays[6].slice(5).replace("-", "/")}`;

  return (
    <>
      <section className="df-habit-detail-progress" aria-label={zh ? "习惯完成情况" : "Habit completion"}>
        <header>
          <div>
            <strong>{weekRange}</strong>
            <span>{zh ? `本周完成 ${completedDays.length}/${dueDays.length}` : `${completedDays.length}/${dueDays.length} complete this week`}</span>
          </div>
          <div className="df-habit-detail-progress-actions">
            <button type="button" aria-label={zh ? "上一周" : "Previous week"} onClick={() => setWeekOffset((value) => value - 1)}>‹</button>
            <button type="button" onClick={() => setWeekOffset(0)}>{zh ? "今天" : "Today"}</button>
            <button type="button" aria-label={zh ? "下一周" : "Next week"} onClick={() => setWeekOffset((value) => value + 1)}>›</button>
          </div>
        </header>
        <div className="df-habit-detail-progress-days">
          {weekDays.map((date) => {
            const dateValue = new Date(`${date}T00:00:00`);
            const day = dateValue.getDay();
            const due = isHabitDueOnDate(habit, date);
            const completed = completedDates.has(date);
            const label = zh ? `周${weekdays[day]} ${date.slice(8)}` : `${weekdays[day]} ${date.slice(8)}`;
            return (
              <div key={date} className={`df-habit-detail-progress-day${due ? " is-due" : ""}${completed ? " is-complete" : ""}${date === today ? " is-today" : ""}`} title={label} aria-label={`${label}: ${completed ? term(zh ? "zh" : "en", "done") : due ? term(zh ? "zh" : "en", "incomplete") : (zh ? "无需检查" : "Not scheduled")}`}>
                <b>{zh ? `周${weekdays[day]}` : weekdays[day]}</b>
                <small>{date.slice(8)}</small>
                <i aria-hidden="true">{completed && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.5 2.5L10 3" /></svg>}</i>
              </div>
            );
          })}
        </div>
      </section>
      <section className="df-habit-settings-form">
        <label className="df-habit-setting-field df-habit-setting-field-title">
          <span>{zh ? "标题" : "Title"}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="df-habit-setting-field df-habit-setting-toggle">
          <span>{zh ? "启用" : "Enabled"}</span>
          <button
            type="button"
            className={`df-habit-enabled-switch${enabled ? " is-on" : ""}`}
            role="switch"
            aria-checked={enabled}
            aria-label={zh ? "启用习惯" : "Enable habit"}
            onClick={() => setEnabled((value) => !value)}
          ><i aria-hidden="true" /></button>
        </div>
        <div className="df-habit-setting-field df-habit-type-field">
          <span>{zh ? "类型" : "Type"}</span>
          <div className="df-habit-type-options" role="group" aria-label={zh ? "习惯类型" : "Habit type"}>
            <button type="button" className={trackingType === "click-counter" ? "is-selected" : ""} aria-pressed={trackingType === "click-counter"} onClick={() => setTrackingType("click-counter")}>{zh ? "点击计数" : "Click Counter"}</button>
            <button type="button" className={trackingType === "duration" ? "is-selected" : ""} aria-pressed={trackingType === "duration"} onClick={() => setTrackingType("duration")}>{zh ? "累积时长" : "Duration"}</button>
          </div>
        </div>
        {trackingType === "click-counter" ? (
          <label className="df-habit-setting-field">
            <span>{zh ? "目标次数" : "Target Count"}</span>
            <input type="number" min={0} value={targetCount} onChange={(e) => setTargetCount(e.target.value)} />
          </label>
        ) : (
          <label className="df-habit-setting-field">
            <span>{zh ? "时长" : "Duration"}</span>
            <input type="number" min={SLOT_MINUTES} max={480} step={SLOT_MINUTES} value={duration} onChange={(e) => setDuration(e.target.value)} />
            <small>{zh ? "以 15 分钟为单位" : "Set in 15-minute increments"}</small>
          </label>
        )}
        <div className="df-habit-setting-field df-habit-weekday-field">
          <span>{zh ? "检查连续的星期几 *" : "Weekdays to check *"}</span>
          <div className="df-habit-weekday-checks">
            {weekdayOrder.map((day) => (
              <button
                key={day}
                type="button"
                className={`df-habit-weekday-check${activeWeekdays.includes(day) ? " is-selected" : ""}`}
                onClick={() => toggleWeekday(day)}
                aria-pressed={activeWeekdays.includes(day)}
              >
                <i aria-hidden="true">{activeWeekdays.includes(day) && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.5 2.5L10 3" /></svg>}</i>
                <strong>{zh ? `星期${weekdays[day]}` : weekdays[day]}</strong>
              </button>
            ))}
          </div>
        </div>
        <label className="df-habit-setting-field">
          <span>{zh ? "备注" : "Notes"}</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </section>

      <section className="df-settings-group df-habit-detail-actions">
        <button type="button" className="df-habit-back-btn" onClick={props.onBack}>{zh ? "返回总览" : "Back to overview"}</button>
        <button type="button" className="df-habit-save-btn" onClick={saveChanges}>{zh ? "保存" : "Save"}</button>
        <button
          type="button"
          className="df-habit-archive-btn"
          onClick={() => props.onArchive(!habit.archived)}
        >{habit.archived ? (zh ? "恢复习惯" : "Restore Habit") : (zh ? "归档习惯" : "Archive Habit")}</button>
      </section>
    </>
  );
}

function TaskMetaIconBar({ task, lang, onUpdate }: { task: Task; lang: Language; onUpdate?: (patch: Partial<Task>) => void }) {
  const [open, setOpen] = useState<"status" | "importance" | null>(null);
  const state = normalizeTaskState(task);
  const labels = buildTaskMetaBadges(task, lang).reduce((map, badge) => ({ ...map, [badge.key]: badge.label }), {} as Record<"status" | "importance" | "urgency", string>);
  const zh = lang === "zh";
  const close = () => setOpen(null);
  const chooseStatus = (status: "backlog" | "doing" | "done") => {
    onUpdate?.(workflowStatusForPatch(status));
    close();
  };
  const chooseImportance = (importance: NullablePriority) => {
    onUpdate?.({ importance });
    close();
  };
  return (
    <span className="df-task-meta-icons" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      <span className="df-meta-icon-wrap">
        <button type="button" className={`df-meta-icon status-${state.workflow}`} title={labels.status} aria-label={labels.status} onClick={() => setOpen(open === "status" ? null : "status")}>
          <span className="df-meta-symbol status" aria-hidden="true" />
        </button>
        {open === "status" && (
          <span className="df-meta-menu">
            <button className={state.workflow === "backlog" ? "active" : ""} onClick={() => chooseStatus("backlog")}>{zh ? "待办" : "Todo"}</button>
            <button className={state.workflow === "doing" ? "active" : ""} onClick={() => chooseStatus("doing")}>{zh ? "进行中" : "Doing"}</button>
            <button className={state.workflow === "done" ? "active" : ""} onClick={() => chooseStatus("done")}>{zh ? "完成" : "Done"}</button>
          </span>
        )}
      </span>
      <span className="df-meta-icon-wrap">
        <button type="button" className={`df-meta-icon importance-${state.importance || "empty"}`} title={labels.importance} aria-label={labels.importance} onClick={() => setOpen(open === "importance" ? null : "importance")}>
          <span className="df-meta-symbol importance" aria-hidden="true" />
        </button>
        {open === "importance" && (
          <span className="df-meta-menu">
            <button className={!state.importance ? "active" : ""} onClick={() => chooseImportance(null)}>{zh ? "无" : "None"}</button>
            <button className={state.importance === "high" ? "active" : ""} onClick={() => chooseImportance("high")}>{zh ? "重要" : "Important"}</button>
            <button className={state.importance === "medium" ? "active" : ""} onClick={() => chooseImportance("medium")}>{zh ? "一般" : "Normal"}</button>
            <button className={state.importance === "low" ? "active" : ""} onClick={() => chooseImportance("low")}>{zh ? "不重要" : "Low"}</button>
          </span>
        )}
      </span>
    </span>
  );
}

/** Quick‑add input shown on top of a drag‑created preview block. */
function DragCreateQuickAdd({ state, projects, onSave, onMore, onCancel, onRangeChange, sheet = false, lang = "zh", showTime = false }: {
  state: NonNullable<DragCreateState>;
  projects: Project[];
  onSave: (title: string, projectId: string | null, subtasks: Subtask[]) => void;
  onMore?: (title: string, projectId: string | null, subtasks: Subtask[]) => void;
  onCancel: () => void;
  onRangeChange?: (edge: "start" | "end", minutes: number) => void;
  sheet?: boolean;
  lang?: Language;
  showTime?: boolean;
}) {
  const [input, setInput] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const selectedProjectRef = useRef<Project | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const container = sheet ? sheetRef.current : containerRef.current;
      if (!container || container.contains(e.target as Node)) return;
      if (inputRef.current?.value.replace(/#[^\s#]+/g, "").trim()) handleSave();
      else onCancel();
    };
    const timer = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onCancel, sheet]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  function handleInputChange(value: string) {
    setInput(value);
    const hm = value.match(/#([^\s#]*)$/);
    setProjectQuery(hm ? hm[1] || "" : "");
  }

  function cleanTitle() {
    return (inputRef.current?.value || input).replace(/#[^\s#]+/g, "").trim();
  }

  function handleSave(openDetails = false) {
    const title = cleanTitle();
    if (!title || savingRef.current) return;
    savingRef.current = true;
    (openDetails && onMore ? onMore : onSave)(title, selectedProjectRef.current?.id || null, subtasks);
  }

  function addSubtask() {
    const title = subtaskTitle.trim();
    if (!title) return;
    const now = workspaceNow().toISOString();
    setSubtasks((current) => [...current, {
      id: `subtask_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
      title,
      completed: false,
      createdAt: now,
      order: Date.now(),
      subtasks: [],
    }]);
    setSubtaskTitle("");
    setAddingSubtask(false);
  }

  function selectProject(project: Project) {
    selectedProjectRef.current = project;
    setSelectedProject(project);
    const base = input.replace(/#[^\s#]*$/, "").trimEnd();
    setInput(`${base}${base ? " " : ""}#${project.title}`);
    setProjectQuery("");
    inputRef.current?.focus({ preventScroll: true });
  }

  const showProjectMenu = input.includes("#") && !input.endsWith(" ");
  const filtered = showProjectMenu
    ? projects.filter((p) => p.title.toLowerCase().includes(projectQuery.toLowerCase()))
    : [];

  if (sheet) return (
    <div ref={sheetRef} className="df-timeline-draft-sheet-host"><Suspense fallback={null}><MobileTimelineDraftSheet
      lang={lang}
      title={input}
      onTitleChange={handleInputChange}
      onClose={onCancel}
      onSwipeDown={() => cleanTitle() ? handleSave() : onCancel()}
      onMore={() => handleSave(true)}
      onSubmit={() => handleSave()}
      projects={projects}
      projectId={selectedProject?.id || ""}
      onProjectChange={(id) => { const project = projects.find((item) => String(item.id) === id) || null; selectedProjectRef.current = project; setSelectedProject(project); }}
      startMinutes={state.startMinutes}
      endMinutes={state.endMinutes}
      onRangeChange={(edge, minutes) => onRangeChange?.(edge, minutes)}
      date={state.date}
      subtasks={subtasks}
      addingSubtask={addingSubtask}
      subtaskTitle={subtaskTitle}
      onStartSubtask={() => setAddingSubtask(true)}
      onSubtaskTitleChange={setSubtaskTitle}
      onAddSubtask={addSubtask}
      onCancelSubtask={() => { setAddingSubtask(false); setSubtaskTitle(""); }}
    /></Suspense></div>
  );

  return (
    <form ref={containerRef} className="drag-create-quick-add"
      onSubmit={(event) => { event.preventDefault(); handleSave(); }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{ "--cat": selectedProject?.color || "var(--accent-active)" } as CSSProperties}>
      <div className="drag-create-quick-add-row">
        {showTime && <span className="df-timeline-draft-time">{minutesToTime(state.startMinutes)}</span>}
        <input ref={inputRef} value={input} onChange={(e) => handleInputChange(e.target.value)}
          enterKeyHint="done"
          onBlur={() => {
            window.setTimeout(() => {
              if (document.activeElement?.closest(".drag-create-quick-add,.df-timeline-draft-handle")) return;
              if (inputRef.current?.value.replace(/#[^\s#]+/g, "").trim()) handleSave();
            }, 0);
          }}
          aria-label={lang === "zh" ? "任务名称" : "Task title"}
          placeholder={lang === "zh" ? "任务名称" : "Task title"}
        />
      </div>
      {showProjectMenu && filtered.length > 0 && (
        <div className="df-quick-add-project-menu drag-create-project-menu ui-divided-list"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}>
          {filtered.map((p) => (
            <button type="button" key={p.id} onClick={() => selectProject(p)}># {p.title}</button>
          ))}
        </div>
      )}
    </form>
  );
}

/** Icon for tasks that were returned to planning but still show on timeline.
 *  Three horizontal bars + a checkmark in the bottom-right.
 *  Uses the project color for fill/stroke via currentColor. */

function SnappedTimelineDragBlock({ task, startTime, duration, projectName, projects, viewMode, lang, extraStyle, dayStartHour = 0, hourHeight = HOUR_HEIGHT }: { task?: Task; startTime: string; duration: number; projectName: string; projects: Project[]; viewMode: "daily" | "3day" | "weekly"; lang: Language; extraStyle?: CSSProperties; dayStartHour?: number; hourHeight?: number }) {
  if (!task) return null;
  const snappedTask = { ...task, scheduledStart: startTime, scheduledEnd: addMinutes(startTime, duration) };
  return (
    <TimeBlock
      task={snappedTask}
      preview={null}
      projectName={projectName}
      projects={projects}
      hovered={false}
      projectInteractive={false}
      onHover={() => {}}
      onSelect={() => {}}
      onEdit={() => {}}
      onToggleDone={() => {}}
      onTaskUpdate={() => {}}
      onProjectChange={() => {}}
      onProjectColorChange={() => {}}
      onCreateProject={() => {}}
      onDragStart={() => {}}
      onResizeStart={() => {}}
      extraStyle={{ ...extraStyle, position: "absolute", zIndex: 6, pointerEvents: "none", transition: "top var(--motion-instant) var(--motion-ease), left var(--motion-instant) var(--motion-ease)" }}
      viewMode={viewMode}
      lang={lang}
      dayStartHour={dayStartHour}
      hourHeight={hourHeight}
      dragState="overlay"
    />
  );
}

function QuickProjectPicker(props: {
  projects: Project[];
  value: string;
  open: boolean;
  newTitle: string;
  newColor: string;
  onOpenChange: (open: boolean) => void;
  onChange: (projectId: string) => void;
  onTitleChange: (title: string) => void;
  onColorChange: (color: string) => void;
  onProjectColorChange: (projectId: string, color: string) => void;
  onCreate: () => void;
  lang: Language;
}) {
  const selected = props.projects.find((project) => String(project.id) === String(props.value));
  const selectedColor = selected?.color || PROJECT_COLOR_PRESETS[0];
  const [newColorOpen, setNewColorOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) return;
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        props.onOpenChange(false);
        setNewColorOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    return () => document.removeEventListener("mousedown", closeOnOutsidePress);
  }, [props.open, props.onOpenChange]);

  return (
    <div ref={pickerRef} className="df-quick-project-picker" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <button type="button" className="df-quick-project-trigger" onClick={() => props.onOpenChange(!props.open)}>
        <span className="df-project-color-dot" style={{ "--project-color": projectColorInk(selectedColor) } as CSSProperties} />
        <span>{selected ? `# ${selected.title}` : "#"}</span>
      </button>
      {props.open && <div className="df-project-popover df-quick-project-popover up ui-divided-list">
        <button type="button" onClick={() => { props.onChange(""); props.onOpenChange(false); }}>{t(props.lang, "timeBlock.unassigned")}</button>
        {props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { props.onChange(project.id); props.onOpenChange(false); }} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}
        <ProjectCreateRow lang={props.lang} value={props.newTitle} onValueChange={props.onTitleChange} onCreate={props.onCreate}>
          <span className="df-create-color-wrap" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="df-project-color-dot-button" aria-label="新项目颜色" onClick={() => setNewColorOpen((v) => !v)}>
              <span className="df-project-color-dot" style={{ "--project-color": projectColorInk(props.newColor) } as CSSProperties} />
            </button>
            {newColorOpen && <ProjectColorPicker value={props.newColor} onChange={(c) => { props.onColorChange(c); }} compact />}
          </span>
        </ProjectCreateRow>
      </div>}
    </div>
  );
}

function AllDayDropPreview({ task, projects, lang }: { task: Task; projects: Project[]; lang: Language }) {
  const color = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category]?.color;
  const isEvent = isEventDisplayTask(task);
  return <TaskBlock as="div" variant="allDay" appearance="calm" priority={taskBlockPriorityFor(task.priority)} checked={!isEvent && task.completed} projectColor={color} dragState="overlay" className="df-all-day-block df-all-day-drop-preview" lang={lang}>
    <TaskBlockRow className="df-all-day-row">
      {!isEvent && <TaskCheckbox lang={lang} checked={task.completed} tone={normalizeTaskCheckTone(task)} priority={task.priority}>{task.completed ? "✓" : ""}</TaskCheckbox>}
      <TaskBlockContent className="df-all-day-main" title={task.title} />
    </TaskBlockRow>
  </TaskBlock>;
}

function AllDayBlock({ task, resolvedUnfinished, engagementEnabled, dragging, projectName, projects, onEdit, onToggleDone, onProjectChange, onProjectColorChange, onCreateProject, onPointerDragStart, lang }: { task: Task; resolvedUnfinished: boolean; engagementEnabled?: boolean; dragging?: boolean; projectName: string; projects: Project[]; onEdit: () => void; onToggleDone: () => void; onProjectChange: (projectId: string) => void; onProjectColorChange: (projectId: string, color: string) => void; onCreateProject: (title: string) => void; onPointerDragStart: (event: React.PointerEvent) => void; lang: Language }) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const stripeColor = projects.find((project) => String(project.id) === String(task.projectId || ""))?.color || categories[task.category].color;
  const isEvent = isEventDisplayTask(task);
  const isExternalEvent = isExternalCalendarDisplayTask(task);
  const isShortName = task.title.length <= 6;
  const isReturnedUnfinished = task.executionStatus === "returned_unfinished";
  const isSkipped = task.executionStatus === "skipped";
  const [badgeWidth, setBadgeWidth] = useState(0);
  useLayoutEffect(() => {
    if (hovered && projectBtnRef.current) {
      setBadgeWidth(projectBtnRef.current.offsetWidth);
    } else if (!hovered) {
      setBadgeWidth(0);
    }
  }, [hovered]);
  return (
    <TaskBlock lang={lang} engagement={engagementEnabled && !isEvent ? normalizeEngagement(task.engagement) : undefined} as="article" variant="allDay" appearance="calm" priority={taskBlockPriorityFor(task.priority)} checked={!isEvent && task.completed} selected={projectOpen} dragging={dragging} projectColor={stripeColor} className={`df-all-day-block ${!isEvent && task.completed ? "completed" : ""} ${isEvent ? "is-event" : ""} ${isExternalEvent ? "is-external-calendar" : ""} ${isReturnedUnfinished ? "returned-unfinished" : ""} ${isSkipped ? "skipped" : ""} ${projectOpen ? "project-open" : ""} ${isShortName ? "short-name" : ""}${dragging ? " is-dragging" : ""}`} dataAttrs={{ kind: isEvent ? "event" : "task", "resolved-unfinished": resolvedUnfinished ? "true" : undefined, readonly: isEvent ? "true" : undefined }} style={{ "--badge-width": badgeWidth ? `${badgeWidth}px` : "0px" } as CSSProperties} onPointerDown={isEvent || isSkipped ? undefined : onPointerDragStart} onClick={task.fixedCourse ? undefined : onEdit} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setProjectOpen(false); setHovered(false); }} title={isExternalEvent ? (lang === "zh" ? "外部日历（只读）" : "External calendar (read-only)") : isReturnedUnfinished ? "已回到规划，可重新安排" : undefined}>
      <TaskRecurrenceIndicator recurrence={task.recurrence} lang={lang} />
      <TaskBlockRow className="df-all-day-row">
        {!isEvent && <TaskCheckbox lang={lang} checked={task.completed} tone={normalizeTaskCheckTone(task)} priority={task.priority} returned={isReturnedUnfinished || isSkipped} onClick={(event) => {
          event.stopPropagation();
          onToggleDone();
        }}>{task.completed ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg> : isSkipped ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l6 6M9 3L3 9" /></svg> : isReturnedUnfinished ? <ReturnedToPlanIcon /> : ""}</TaskCheckbox>}
        <TaskBlockContent className="df-all-day-main" title={task.title}>
          {isExternalEvent && <span className="df-external-calendar-label">{lang === "zh" ? "外部日历" : "External"}</span>}
        </TaskBlockContent>
        {!isEvent && hovered && <TaskActions className="df-all-day-actions" onClick={(event) => event.stopPropagation()}>
          <button ref={projectBtnRef} className="df-block-project" title={projectName} onClick={(event) => { event.stopPropagation(); setProjectOpen((open) => !open); }}># {projectName}</button>
        </TaskActions>}
      </TaskBlockRow>
      {projectOpen && projectBtnRef.current && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setProjectOpen(false)}>
            <div className="df-project-popover-portal ui-divided-list" onClick={(event) => event.stopPropagation()} style={{
              top: projectBtnRef.current.getBoundingClientRect().bottom + 8,
              left: Math.max(8, projectBtnRef.current.getBoundingClientRect().right - 220),
            } as CSSProperties}>
              <button type="button" onClick={() => { onProjectChange(""); setProjectOpen(false); }}>{t(lang, "timeBlock.unassigned")}</button>
              {projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => { onProjectChange(project.id); setProjectOpen(false); }} onColorChange={(color) => onProjectColorChange(project.id, color)} />)}
              <ProjectCreateRow lang={lang} value={newProjectTitle} onValueChange={setNewProjectTitle} onCreate={() => { onCreateProject(newProjectTitle); setNewProjectTitle(""); setProjectOpen(false); }} />
            </div>
          </div>,
          document.querySelector('.df-app') || document.body
        )}
    </TaskBlock>
  );
}

function NowLine({ extraStyle, dayStartHour = 0, hourHeight = HOUR_HEIGHT, highlighted = false }: { extraStyle?: CSSProperties; lang?: Language; dayStartHour?: number; hourHeight?: number; highlighted?: boolean }) {
  const [now, setNow] = useState(workspaceNow());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(workspaceNow()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 0 || minutes > 24 * 60) return null;
  const top = timeBlockTop(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, dayStartHour, hourHeight);
  // Merge so an `undefined` top from extraStyle (non-continuous mode) does NOT
  // clobber the computed, day-start-aware top. Continuous mode supplies a real
  // top via extraStyle and wins; non-continuous mode omits it and the computed
  // top is used.
  const mergedStyle: CSSProperties = { ...extraStyle };
  if (mergedStyle.top === undefined) mergedStyle.top = top;
  return <div className={`df-now-line${highlighted ? " is-return-highlighted" : ""}`} style={mergedStyle} />;
}

function EditDrawer(props: {
  engagementEnabled?: boolean;
  type: AddType; setType: (type: AddType) => void; form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; projects: Project[]; editing: boolean; task?: Task; project?: Project; habit?: Habit; today: string; onClose: () => void; onSave: () => void; onDelete: () => void; onCopy: () => void; onTaskUpdate: (taskId: string, patch: Partial<Task>) => Promise<void> | undefined; onQuickReschedule: (taskId: string, date: string, recordId?: string) => void; onLocateTimeline: (date: string, startTime: string, taskId: string) => void; onLocateTree?: (task: Task) => void; onProjectColorChange: (projectId: string, color: string) => void; onToggleDone: () => void; onCreateProject: (title: string) => string;
  onEditSchedule: (taskId: string, source: TaskScheduleRange, next: TaskScheduleRange, duration: number, recordId?: string, occurrence?: EditingOccurrence) => string | undefined; weekStartsOn: 0 | 1;
  editingRecordId?: string; setEditingRecordId?: (id: string | undefined) => void; editingOccurrence?: EditingOccurrence; data?: PlannerData | null; saveData?: (next: PlannerData) => Promise<void>; onSaveRecurrence: (taskId: string, recurrence?: TaskRecurrence) => void; onCancelOccurrence: (taskId: string, occurrence: EditingOccurrence) => void; onReplanOccurrence: (taskId: string, occurrence: EditingOccurrence) => void; onCancelAllRecurrence: (taskId: string, cutoffDate: string) => void; aiEnabled: boolean; subtaskAiLoading: boolean; subtaskAiRevealIds: string[]; onGenerateSubtasks: (taskId: string) => void; lang: Language; compactSummary?: boolean; onCompactActionSuccess: (message: string) => void; onShowMore?: () => void;
}) {
  const dialog = useInAppDialog(props.lang);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [detailPopoverPosition, setDetailPopoverPosition] = useState<CSSProperties>({ top: 0, left: 0, width: 280 });
  const detailPopoverRef = useRef<HTMLElement>(null);
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const durationTriggerRef = useRef<HTMLButtonElement>(null);
  const summaryExpanded = useRef("");
  const showMore = (inset: string) => { summaryExpanded.current = inset; props.onShowMore?.(); };
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [recurrenceDraft, setRecurrenceDraft] = useState<TaskRecurrence | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [quickActionMenu, setQuickActionMenu] = useState<"reschedule" | null>(null);
  const [incompleteMenuOpen, setIncompleteMenuOpen] = useState(false);
  const incompleteMenuHoverTimer = useRef<number | null>(null);
  const quickRescheduleHoverTimer = useRef<number | null>(null);
  const [cancelAllConfirm, setCancelAllConfirm] = useState(false);
  const f = props.form;
  const set = (key: keyof FormState, value: FormState[keyof FormState]) => props.setForm((current) => ({ ...current, [key]: value }));
  const zh = props.lang === "zh";
  const selectedProject = props.projects.find((project) => String(project.id) === String(f.projectId));
  const selectedProjectTitle = selectedProject?.title || (zh ? "未归属" : "Unassigned");
  const addTypeHints: Record<AddType, string> = {
    task: props.lang === "zh" ? "Task：需要完成的行动，可以安排到时间轴并标记完成。" : "Task: an action to complete, schedulable on the timeline and markable as done.",
    project: props.lang === "zh" ? "Project：一组任务的长期目标，用颜色和重要度组织计划。" : "Project: a longer-term goal that groups tasks with color and priority context.",
    habit: props.lang === "zh" ? "习惯：每天或每周重复的固定练习。" : "Habit: a recurring practice you want to keep on the day.",
  };
  useEffect(() => {
    setRecurrenceOpen(false);
    setRecurrenceDraft(null);
    setRescheduleOpen(false);
    setQuickActionMenu(null);
    setIncompleteMenuOpen(false);
    if (incompleteMenuHoverTimer.current !== null) window.clearTimeout(incompleteMenuHoverTimer.current);
    if (quickRescheduleHoverTimer.current !== null) window.clearTimeout(quickRescheduleHoverTimer.current);
    setCancelAllConfirm(false);
  }, [props.task?.id, props.task?.notes, props.project?.id, props.project?.notes, props.habit?.id, props.habit?.notes, props.editingOccurrence?.scheduledDate, props.editingRecordId]);
  function positionDetailPopover(trigger: HTMLButtonElement | null, width: number) {
    const panel = detailPopoverRef.current;
    if (!trigger || !panel) return;
    const placement = anchorPlacement(trigger.getBoundingClientRect(), viewportBounds(), width, Math.min(350, panel.scrollHeight + panel.offsetHeight - panel.clientHeight));
    const { upward, ...geometry } = placement;
    setDetailPopoverPosition({ ...geometry, transformOrigin: upward ? "center bottom" : "center top", "--detail-popover-shift-y": upward ? "7px" : "-7px" } as CSSProperties);
  }
  function toggleProjectPicker() {
    const next = !projectPickerOpen;
    setDurationPickerOpen(false);
    setProjectPickerOpen(next);
  }
  function toggleDurationPicker() {
    const next = !durationPickerOpen;
    setProjectPickerOpen(false);
    setDurationPickerOpen(next);
  }
  useLayoutEffect(() => {
    if (!projectPickerOpen && !durationPickerOpen) return;
    const update = () => positionDetailPopover(
      projectPickerOpen ? projectTriggerRef.current : durationTriggerRef.current,
      projectPickerOpen ? 300 : 260,
    );
    return observeAnchor([detailPopoverRef.current, projectPickerOpen ? projectTriggerRef.current : durationTriggerRef.current], update);
  }, [projectPickerOpen, durationPickerOpen]);
  function createAndSelectProject() {
    const id = props.onCreateProject(newProjectTitle);
    if (!id) return;
    chooseProject(id);
    setNewProjectTitle("");
  }
  function setDurationMinutes(minutes: number) {
    const safeMinutes = Math.max(minutes, SLOT_MINUTES);
    props.setForm((current) => ({
      ...current,
      estimatedHours: safeMinutes / 60,
      ...(!props.editing && props.type === "task" && current.dueTime ? { endTime: addMinutes(current.dueTime, safeMinutes) } : {}),
    }));
    if (!props.editing || props.type !== "task" || !props.task) return;
    const patch: Partial<Task> = { estimatedHours: safeMinutes / 60 };
    if (props.editingRecordId && props.task.timelineRecords?.length) {
      patch.timelineRecords = props.task.timelineRecords.map((record) =>
        record.id === props.editingRecordId
          ? rescheduleTimelineRecord(record, record.scheduledDate, record.scheduledStart, safeMinutes)
          : record,
      );
    }
    if (props.task.scheduledStart) patch.scheduledEnd = addMinutes(props.task.scheduledStart, safeMinutes);
    props.onTaskUpdate(props.task.id, patch);
  }
  async function addSubtask(parentId?: string) {
    if (!props.task) return;
    const title = await dialog.prompt(props.lang === "zh" ? "子任务名称" : "Subtask name");
    if (!title?.trim()) return;
    const nextSubtask: Subtask = {
      id: uid("subtask"),
      title: title.trim(),
      completed: false,
      done: false,
      order: Date.now(),
      subtasks: [],
      createdAt: workspaceNow().toISOString(),
    };
    props.onTaskUpdate(props.task.id, {
      subtasks: addSubtaskToTree(props.task.subtasks || [], nextSubtask, parentId),
    });
  }
  function updateSubtask(subtaskId: string, patch: { title?: string; completed?: boolean }) {
    if (!props.task) return;
    const recurse = (st: Subtask[]): Subtask[] =>
      st.map((sub) =>
        sub.id === subtaskId
          ? { ...sub, ...patch, done: patch.completed ?? sub.done }
          : { ...sub, subtasks: sub.subtasks ? recurse(sub.subtasks) : sub.subtasks }
      );
    props.onTaskUpdate(props.task.id, { subtasks: recurse(props.task.subtasks || []) });
  }
  function renderSubtaskRows(subtasks: Subtask[], depth = 0): React.ReactNode {
    return subtasks.map((subtask, index) => {
      const done = Boolean(subtask.completed || subtask.done);
      const aiGenerated = props.subtaskAiRevealIds.includes(subtask.id);
      return (
      <div className={`df-subtask-tree-item ui-divided-list${depth > 0 ? " nested" : ""}${aiGenerated ? " ai-generated" : ""}`} key={subtask.id} style={{ "--subtask-depth": depth, "--subtask-reveal-index": index } as CSSProperties}>
        <div className={`df-subtask-row-new${done ? " completed" : ""}`}>
          <TaskCheckbox lang={props.lang} checked={done} tone={done ? "done" : "muted"} className={`df-subtask-check${done ? " done" : ""}`} ariaLabel={done ? (props.lang === "zh" ? "标记为未完成" : "Mark incomplete") : (props.lang === "zh" ? "标记为完成" : "Mark complete")} onClick={() => updateSubtask(subtask.id, { completed: !done })}>
            {done ? <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 6l3 3 5-6" /></svg> : null}
          </TaskCheckbox>
          <input className="df-subtask-title-input" value={subtask.title} aria-label={props.lang === "zh" ? "子任务名称" : "Subtask title"} onChange={(event) => updateSubtask(subtask.id, { title: event.target.value })} />
          <button
            type="button"
            className="df-subtask-add-child"
            title={props.lang === "zh" ? "添加下一级子任务" : "Add nested subtask"}
            aria-label={props.lang === "zh" ? `在 ${subtask.title} 下添加子任务` : `Add a subtask under ${subtask.title}`}
            onClick={() => void addSubtask(subtask.id)}
          >
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 2v8M2 6h8" /></svg>
          </button>
        </div>
        {(subtask.subtasks || []).length > 0 && <div className="df-subtask-tree-children ui-divided-list">{renderSubtaskRows(subtask.subtasks || [], depth + 1)}</div>}
      </div>
    );
    });
  }
  function scheduleText(task: Task) {
    const activeRecord = props.editingRecordId
      ? (task.timelineRecords || []).find((r) => r.id === props.editingRecordId)
      : null;
    const occurrence = props.editingOccurrence;
    const sd = activeRecord?.scheduledDate || task.scheduledDate;
    const ss = activeRecord?.scheduledStart || occurrence?.scheduledStart || task.scheduledStart;
    const se = activeRecord?.scheduledEnd || task.scheduledEnd;
    if (sd && ss && se) {
      const dur = clockTimeSpanMinutes(ss, se) / 60;
      return `${sd} ${ss} - ${se} · ${formatDuration(dur)}`;
    }
    if (occurrence?.scheduledDate && occurrence.scheduledStart && task.recurrence) {
      return `${occurrence.scheduledDate} ${occurrence.scheduledStart} · ${formatMinutes(task.recurrence.durationMinutes || taskDuration(task))}`;
    }
    if (isRecurringScheduledTask(task) && task.recurrence?.startDate && task.recurrence.startTime) {
      return `${task.recurrence.startDate} ${task.recurrence.startTime} · ${recurrenceLabel(task.recurrence)} · ${formatMinutes(task.recurrence.durationMinutes || taskDuration(task))}`;
    }
    if (task.plannedForDate === props.today) return t(props.lang, "drawer.todayUnscheduled");
    if (task.dueDate) return `${task.dueDate} · ${formatDuration(f.estimatedHours || 0.5)}`;
    return t(props.lang, "drawer.unscheduled");
  }
  const importanceOptions: Array<{ value: TaskLevel; zh: string; en: string }> = [
    { value: "high", zh: "高", en: "High" },
    { value: "medium", zh: "中", en: "Medium" },
    { value: "low", zh: "低", en: "Low" },
    { value: "unset", zh: "未设置", en: "Unset" },
  ];
  const urgencyOptions: Array<{ value: TaskLevel; zh: string; en: string }> = [
    { value: "high", zh: "高", en: "High" },
    { value: "medium", zh: "中", en: "Medium" },
    { value: "low", zh: "低", en: "Low" },
    { value: "unset", zh: "未设置", en: "Unset" },
  ];
  const levelColors: Record<TaskLevel, string> = {
    high: "var(--task-priority-high, #C96F5B)",
    medium: "var(--task-priority-medium, #C49A32)",
    low: "var(--task-priority-low, #6E8DA6)",
    unset: "var(--task-priority-unset, #8E8478)",
  };
  function commitTaskMeta(kind: "priority" | "importance" | "urgency", value: TaskLevel) {
    set(kind, value === "unset" ? null : value);
    if (!props.editing || props.type !== "task" || !props.task) return;
    props.onTaskUpdate(props.task.id, taskMetaPatch(kind, value));
  }
  function taskLevelSelector(kind: "priority" | "importance" | "urgency", options: Array<{ value: TaskLevel; zh: string; en: string }>) {
    const selectedValue = (f[kind] ?? "unset") as TaskLevel;
    return <div className={`df-level-selector df-level-${kind === "priority" ? "importance" : kind}`} role="group" aria-label={kind === "priority" ? (props.lang === "zh" ? "优先级" : "Priority") : kind === "importance" ? (props.lang === "zh" ? "重要程度" : "Importance") : (props.lang === "zh" ? "紧急程度" : "Urgency")}>
      {options.map((option) => <button
        key={`${kind}-${option.value}`}
        type="button"
        className={`df-level-option df-level-${option.value}`}
        data-selected={selectedValue === option.value ? "true" : "false"}
        aria-pressed={selectedValue === option.value}
        onClick={() => commitTaskMeta(kind, option.value)}
        title={props.lang === "zh" ? option.zh : option.en}
        style={{ "--option-color": levelColors[option.value] } as React.CSSProperties}
      >
        {kind !== "urgency"
          ? option.value === "unset"
            ? <svg viewBox="0 0 24 24" className="df-level-icon" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            : <svg viewBox="0 0 24 24" className="df-level-icon" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/><line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          : <span className={`df-urgency-mark${option.value === "unset" ? " df-urgency-dash" : ""}`}>{option.value === "high" ? "!!!" : option.value === "medium" ? "!!" : option.value === "low" ? "!" : "—"}</span>}
      </button>)}
    </div>;
  }
  const dueLabel = props.lang === "zh" ? "截止日期" : "Due date";
  const editDueDate = (onChange: (date: string) => void) => <EditorDate outlined clearable label={dueLabel} value={f.dueDate} today={props.today} weekStartsOn={props.weekStartsOn} lang={props.lang} emptyLabel={props.lang === "zh" ? "未设置" : "Not set"} onChange={onChange} />;
  const selectProject = <button ref={projectTriggerRef} type="button" className={`df-detail-pill-trevor ${projectPickerOpen ? "active" : ""}`} onClick={toggleProjectPicker} title={selectedProjectTitle} aria-expanded={projectPickerOpen}>
    <span className="df-detail-project-dot" style={{ background: projectColorInk(selectedProject?.color || "#888") }} />
    <span className="df-detail-project-name"># {selectedProjectTitle}</span>
    <UiChevronDownIcon size={12} />
  </button>;
  const selectDuration = (minutes: number, label: string) => <button ref={durationTriggerRef} type="button" className={`df-detail-pill-trevor ${durationPickerOpen ? "active" : ""}`} onClick={toggleDurationPicker} aria-label={`${label} · ${formatMinutes(minutes)}`} aria-expanded={durationPickerOpen}>
    <UiTimerIcon size={14} /><span>{formatMinutes(minutes)}</span><UiChevronDownIcon size={12} />
  </button>;
  function chooseProject(projectId: string) {
    set("projectId", projectId);
    if (props.editing && props.type === "task" && props.task) props.onTaskUpdate(props.task.id, { projectId: projectId || undefined });
    setProjectPickerOpen(false);
  }
  const projectPopover = (allowCreate: boolean) => projectPickerOpen && createPortal(
          <div className="df-detail-popover-layer" onMouseDown={() => setProjectPickerOpen(false)}>
            <section ref={detailPopoverRef} className="df-detail-floating-popover project" style={detailPopoverPosition} onMouseDown={(event) => event.stopPropagation()}>
              <header><strong>{t(props.lang, "drawer.assignProject")}</strong><span>{selectedProjectTitle}</span></header>
              <div className="df-drawer-project-list ui-divided-list">
                <button onClick={() => chooseProject("")}>{t(props.lang, "drawer.unassigned")}</button>
                {props.projects.map((project) => <ProjectChoice key={project.id} project={project} onChoose={() => chooseProject(project.id)} onColorChange={(color) => props.onProjectColorChange(project.id, color)} />)}
                {allowCreate && <ProjectCreateRow lang={props.lang} value={newProjectTitle} onValueChange={setNewProjectTitle} onCreate={createAndSelectProject} />}
              </div>
            </section>
          </div>,
          document.getElementById("df-portal-target") || document.body,
        );
  const durationPopover = (value: number) => durationPickerOpen && createPortal(<div className="df-detail-popover-layer" onMouseDown={() => setDurationPickerOpen(false)}>
            <section ref={detailPopoverRef} className="df-detail-floating-popover duration" style={detailPopoverPosition} onMouseDown={(event) => event.stopPropagation()}>
              <header><strong>{t(props.lang, "drawer.duration")}</strong><span>{formatMinutes(value)}</span></header>
              <div className="df-detail-duration-options">
                {DURATION_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    className={value === minutes ? "active" : ""}
                    onClick={() => {
                      setDurationMinutes(minutes);
                      setDurationPickerOpen(false);
                    }}
                  >
                    {formatMinutes(minutes)}
                  </button>
                ))}
              </div>
            </section>
          </div>,
          document.getElementById("df-portal-target") || document.body,
        );
  const projectMetadata = () => <section className="df-editor-metadata">
    <div className="df-editor-project-fields">
      <div className="df-detail-meta-setting">
        <span>{zh ? "重要程度" : "Importance"}</span>
        {taskLevelSelector("importance", importanceOptions)}
      </div>
      {editDueDate((date) => set("dueDate", date))}
    </div>
    <div className="df-detail-meta-setting">
      <span>{t(props.lang, "form.color")}</span>
      <SettingColorInput ariaLabel={zh ? "项目颜色" : "Project color"} value={f.projectColor || props.project?.color || DEFAULT_PROJECT_COLOR} onChange={(color) => set("projectColor", color)} />
    </div>
  </section>;
  const typeName = (type: AddType) => type === "habit" ? (zh ? "习惯" : "Habit") : t(props.lang, `form.${type}`);
  const createLabel = (type: AddType) => props.editing
    ? (zh ? `转换为${typeName(type)}` : `Convert to ${typeName(type)}`)
    : (zh ? `创建${typeName(type)}` : `Create ${typeName(type).toLowerCase()}`);
  if (!props.editing || props.type === "habit" || (props.type === "task" && !props.task)) {
    const type = props.type;
    const isTask = type === "task";
    const isProject = type === "project";
    const titlePlaceholder = isTask ? (zh ? "任务名称" : "Task name") : isProject ? (zh ? "项目名称" : "Project name") : (zh ? "习惯名称" : "Habit name");
    const estimatedMinutes = Math.max(Math.round((f.estimatedHours || 0.5) * 60), SLOT_MINUTES);
    const duration = f.dueTime && f.endTime && isTask ? Math.max(clockTimeSpanMinutes(f.dueTime, f.endTime), SLOT_MINUTES) : estimatedMinutes;
    const setStartTime = (startTime: string) => props.setForm((current) => ({
      ...current, dueTime: startTime,
      endTime: startTime ? addMinutes(startTime, Math.max(Math.round((current.estimatedHours || 0.5) * 60), SLOT_MINUTES)) : "",
    }));
    const setEndTime = (endTime: string) => props.setForm((current) => ({
      ...current, endTime,
      estimatedHours: current.dueTime && endTime ? Math.max(clockTimeSpanMinutes(current.dueTime, endTime), SLOT_MINUTES) / 60 : current.estimatedHours,
    }));
    return (
      <aside className="df-drawer df-task-detail df-entity-editor df-create-editor" onMouseDown={(event) => event.stopPropagation()}>
        <CloseButton className="df-detail-close" label={t(props.lang, "form.close")} onClick={props.onClose} />
        <div className="df-segment df-detail-type-segment" role="group" aria-label={zh ? "选择添加类型" : "Choose what to add"}>
          {(["task", "project", "habit"] as const).map((option) => (
            <button key={option} type="button" className={type === option ? "active" : ""} aria-pressed={type === option} title={addTypeHints[option]} onClick={() => {
              if (type === option) return;
              setProjectPickerOpen(false);
              setDurationPickerOpen(false);
              setNewProjectTitle("");
              props.setType(option);
            }}>{typeName(option)}</button>
          ))}
        </div>
        <section className="df-detail-hero-trevor">
          <EditorTitle key={type} label={titlePlaceholder} autoFocus value={f.title} onChange={(event) => set("title", event.target.value)} onKeyDown={(event) => {
            if (!isTask && event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              props.onSave();
            }
          }} />
        </section>
        {isProject ? projectMetadata() : <section className="df-editor-metadata">
          <div className="df-detail-tag-row df-editor-task-fields">
            {selectProject}
            {isTask && editDueDate((date) => set("dueDate", date))}
            {selectDuration(duration, isTask ? t(props.lang, "form.estimatedTime") : (zh ? "每次时长" : "Duration per session"))}
          </div>
          {isTask && <div className="df-detail-importance-row" role="group" aria-label={zh ? "任务标记" : "Task flags"}>{taskLevelSelector("priority", importanceOptions)}</div>}
        </section>}
        {isTask && !props.editing && <section className="df-detail-time-range" aria-label={zh ? "起止时间" : "Start and end time"}>
          <label><span>{t(props.lang, "drawer.startTime")}</span><input type="time" step={SLOT_MINUTES * 60} value={f.dueTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          <span className="df-detail-time-arrow" aria-hidden="true">→</span>
          <label><span>{t(props.lang, "drawer.endTime")}</span><input type="time" step={SLOT_MINUTES * 60} value={f.endTime} disabled={!f.dueTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        </section>}
        {!isProject && projectPopover(isTask)}
        {!isProject && durationPopover(duration)}
        <EditorNotes key={type} lang={props.lang} value={f.details} onChange={(notes) => set("details", notes)} />
        <EditorActionRow className="df-create-editor-actions">
          <Button className="df-editor-action" variant="primary" disabled={!f.title.trim()} onClick={props.onSave}><UiPlusIcon size={14} />{createLabel(type)}</Button>
        </EditorActionRow>
      </aside>
    );
  }
  if (props.editing && props.type === "task" && props.task) {
    const activeRecord = props.editingRecordId
      ? (props.task.timelineRecords || []).find((r) => r.id === props.editingRecordId)
      : null;
    const activeOccurrence = props.editingOccurrence || (activeRecord ? {
      taskId: props.task.id,
      scheduledDate: activeRecord.scheduledDate,
      scheduledStart: activeRecord.scheduledStart,
    } : null);
    const scheduledRecord = props.task.timelineRecords?.find((record) => record.executionStatus === "scheduled");
    const timelineRecord = activeRecord || scheduledRecord || props.task.timelineRecords?.at(-1);
    const scheduleRecord = activeRecord || (!props.editingOccurrence ? scheduledRecord : undefined);
    const legacySchedule = !props.task.executionStatus || props.task.executionStatus === "scheduled" || props.task.completed;
    const scheduleDate = scheduleRecord?.scheduledDate || props.editingOccurrence?.scheduledDate || (legacySchedule ? props.task.scheduledDate : undefined);
    const scheduleStart = scheduleRecord ? scheduleRecord.scheduledStart
      : props.editingOccurrence?.scheduledStart || (legacySchedule ? props.task.scheduledStart : undefined);
    let scheduleRange: TaskScheduleRange | undefined;
    const clockTime = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (scheduleDate && scheduleStart && validIsoDate(scheduleDate) && clockTime.test(scheduleStart)) {
      const fallbackDuration = props.task.recurrence?.durationMinutes || taskDuration(props.task);
      const legacyDuration = props.task.scheduledEnd && !props.editingOccurrence && clockTime.test(props.task.scheduledEnd)
        ? clockTimeSpanMinutes(scheduleStart, props.task.scheduledEnd) : fallbackDuration;
      const end = (scheduleRecord?.scheduledEnd && normalizeTimelineRecord(scheduleRecord))
        || calculateTimelineRecordEnd(scheduleDate, scheduleStart, legacyDuration);
      const endDate = end.scheduledEndDate || scheduleDate;
      if (validIsoDate(endDate) && clockTime.test(end.scheduledEnd)) {
        scheduleRange = { date: scheduleDate, start: scheduleStart, endDate, end: end.scheduledEnd };
      }
    }
    const timelineLocation = timelineRecord
      ? { date: timelineRecord.scheduledDate, startTime: timelineRecord.scheduledStart, taskId: timelineRecord.id }
      : activeOccurrence
        ? { date: activeOccurrence.scheduledDate, startTime: activeOccurrence.scheduledStart, taskId: buildRecurrenceOccurrenceId(props.task.id, activeOccurrence.scheduledDate, activeOccurrence.scheduledStart) }
        : props.task.scheduledDate && props.task.scheduledStart
          ? { date: props.task.scheduledDate, startTime: props.task.scheduledStart, taskId: props.task.id }
          : null;
    const isCandidate = props.task.plannedForDate === props.today && getExecutionLane(props.task) === "candidate" && !activeRecord && !(props.task.timelineRecords || []).some((r) => r.executionStatus === "scheduled");
    const isScheduled = activeRecord
      ? Boolean(activeRecord.scheduledDate)
      : Boolean(props.task.scheduledDate || activeOccurrence || (props.task.timelineRecords || []).some((record) => record.executionStatus === "scheduled") || isRecurringScheduledTask(props.task));
    const recordStatus = activeRecord?.executionStatus;
    const recurrenceText = recurrenceLabel(props.task.recurrence);
    const showUncomplete = (
      props.task.completed ||
      (isScheduled && recordStatus !== "returned_unfinished")
    );
    function chooseIncompleteOutcome(outcome: "unfinished-return" | "unfinished-stay" | "skipped-return" | "skipped-stay") {
      if (!props.task) return;
      const showInPlanning = outcome === "unfinished-return" || outcome === "skipped-return";
      const wasDone = outcome === "skipped-return" || outcome === "skipped-stay";
      const executionStatus = wasDone ? "skipped" : showInPlanning ? "returned_unfinished" : "scheduled";
      const taskPatch: Partial<Task> = {
        completed: false,
        plannedForDate: showInPlanning ? props.today : undefined,
        executionLane: showInPlanning ? "candidate" : undefined,
      };
      setIncompleteMenuOpen(false);
      if (props.editingRecordId && props.data && props.saveData) {
        const now = workspaceNow().toISOString();
        const incompleteData = setTaskCompletion(props.data, props.editingRecordId, false, now);
        return props.saveData({
          ...incompleteData,
          tasks: incompleteData.tasks.map((task) => task.id === props.task!.id
            ? {
                ...task,
                ...taskPatch,
                executionStatus: undefined,
                timelineRecords: (task.timelineRecords || []).map((record) => record.id === props.editingRecordId
                  ? { ...record, executionStatus }
                  : record),
                updatedAt: now,
              }
            : task),
        });
      }
      return props.onTaskUpdate(props.task.id, { ...taskPatch, executionStatus });
    }
    const statusText = props.task.completed
      ? t(props.lang, "drawer.completed")
      : recordStatus === "returned_unfinished"
        ? t(props.lang, "drawer.unfinishedReturned")
        : isScheduled
          ? t(props.lang, "drawer.scheduledOnTimeline")
          : isCandidate
            ? t(props.lang, "drawer.candidateStatus")
            : t(props.lang, "drawer.unscheduled");
    const fixedRecurrence = props.task.recurrence || {
      mode: "scheduled" as const,
      frequency: "weekly" as RecurrenceFrequency,
      startDate: activeOccurrence?.scheduledDate || props.task.dueDate || props.today,
      startTime: activeOccurrence?.scheduledStart || props.task.scheduledStart || "09:00",
      durationMinutes: Math.max(Math.round((f.estimatedHours || 0.5) * 60), 30),
    };
    const recurrenceEditor = recurrenceDraft || fixedRecurrence;
    const setCandidateReschedule = (date: string) => {
      props.onQuickReschedule(props.task!.id, date, activeRecord?.id);
      setRescheduleOpen(false);
      setQuickActionMenu(null);
    };
    const quickRescheduleOptions = [
      { date: addDays(props.today, 1), zh: "明天", en: "Tomorrow" },
      { date: addDays(props.today, 2), zh: "后天", en: "In 2 days" },
      { date: addDays(props.today, 3), zh: "3 天后", en: "In 3 days" },
      { date: addDays(props.today, 7), zh: "下周", en: "Next week" },
      { date: addDays(props.today, 30), zh: "下个月", en: "Next month" },
    ];
    const removeConfirmLabel = isScheduled ? (zh ? "确认删除" : "Confirm") : undefined;
    if (props.compactSummary) {
      return (
        <>
          {dialog.host}
          <Suspense fallback={null}><MobileTaskSummary engagementEnabled={props.engagementEnabled} lang={props.lang} task={props.task} form={f} setForm={props.setForm} projects={props.projects} record={activeRecord} occurrence={activeOccurrence} today={props.today} onClose={props.onClose} onDelete={props.onDelete} removeConfirmLabel={removeConfirmLabel} onMore={showMore} onIncomplete={() => chooseIncompleteOutcome("unfinished-return")} onUpdate={props.onTaskUpdate} onActionSuccess={props.onCompactActionSuccess} /></Suspense>
        </>
      );
    }
    return (
      <>
      {dialog.host}
      <aside className={`df-drawer df-task-detail df-entity-editor${summaryExpanded.current ? " is-expanded-from-summary" : ""}`} style={{ "--mobile-sheet-start-inset": summaryExpanded.current } as CSSProperties} onMouseDown={(event) => event.stopPropagation()}>
        <CloseButton className="df-detail-close" type="button" label={t(props.lang, "form.close")} onClick={props.onClose} />
        {/* ── Hero title area ── */}
        <section className="df-detail-hero-trevor">
          <EditorTitle label={t(props.lang, "drawer.titlePlaceholder")} value={f.title} onChange={(event) => set("title", event.target.value)} />
          {scheduleRange && <TaskDetailSchedule range={scheduleRange} today={props.today} weekStartsOn={props.weekStartsOn} lang={props.lang}
            countdown={!props.task.completed && (!scheduleRecord || scheduleRecord.executionStatus === "scheduled")}
            onSave={(source, next, duration) => props.onEditSchedule(props.task!.id, source, next, duration, scheduleRecord?.id, props.editingOccurrence || undefined)} />}
        </section>

        <section className="df-editor-metadata">
          <div className="df-detail-tag-row df-editor-task-fields">
          {selectProject}
          {editDueDate((dueDate) => { set("dueDate", dueDate); props.onTaskUpdate(props.task!.id, { dueDate, dueDateSource: dueDate ? "manual" : undefined }); })}
          {isScheduled && !scheduleRange && selectDuration(Math.round((f.estimatedHours || 0.5) * 60), t(props.lang, "form.estimatedTime"))}
          {recurrenceText ? <span className="df-detail-pill-trevor">↻ {recurrenceText}</span> : null}
          </div>
        <div className="df-detail-importance-row" role="group" aria-label={props.lang === "zh" ? "任务标记" : "Task flags"}>
          {taskLevelSelector("priority", importanceOptions)}
          {props.engagementEnabled && <Suspense fallback={null}><EngagementRating task={props.task} record={activeRecord} lang={props.lang} onUpdate={props.onTaskUpdate} /></Suspense>}
        </div>
        </section>

        <EditorActionRow className="df-editor-action-row--equal">
          <button className={`df-detail-pill-trevor action ${props.task.completed ? "green" : ""}`} onClick={props.onToggleDone}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-6"/></svg>
            <span>{t(props.lang, "drawer.complete")}</span>
          </button>
          {!isScheduled && selectDuration(Math.round((f.estimatedHours || 0.5) * 60), t(props.lang, "form.estimatedTime"))}
          {isScheduled && showUncomplete && <div className={`df-detail-incomplete-menu${incompleteMenuOpen ? " open" : ""}`} onMouseEnter={() => {
            if (incompleteMenuHoverTimer.current !== null) window.clearTimeout(incompleteMenuHoverTimer.current);
            incompleteMenuHoverTimer.current = window.setTimeout(() => { setIncompleteMenuOpen(true); incompleteMenuHoverTimer.current = null; }, 100);
          }} onMouseLeave={() => {
            if (incompleteMenuHoverTimer.current !== null) window.clearTimeout(incompleteMenuHoverTimer.current);
            incompleteMenuHoverTimer.current = null;
            setIncompleteMenuOpen(false);
          }} onFocus={() => setIncompleteMenuOpen(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIncompleteMenuOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { setIncompleteMenuOpen(false); event.currentTarget.querySelector("button")?.focus(); } }}>
            <button type="button" className="df-detail-pill-trevor action df-detail-incomplete-trigger" aria-haspopup="menu" aria-expanded={incompleteMenuOpen} onClick={() => {
              if (incompleteMenuHoverTimer.current !== null) window.clearTimeout(incompleteMenuHoverTimer.current);
              incompleteMenuHoverTimer.current = null;
              setIncompleteMenuOpen(true);
            }}>
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3l-6 6M3 3l6 6"/></svg>
              <span>{t(props.lang, "drawer.unfinished")}</span>
              <svg className="df-detail-incomplete-chevron" viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 2l4 3-4 3" /></svg>
            </button>
            {incompleteMenuOpen && <div className="df-detail-incomplete-options" role="menu" aria-label={props.lang === "zh" ? "未完成处理方式" : "Incomplete options"}>
              {INCOMPLETE_OUTCOMES.map((outcome, index) => <button key={outcome} type="button" role="menuitem" onClick={() => chooseIncompleteOutcome(outcome)}>{INCOMPLETE_LABELS[props.lang === "zh" ? "zh" : "en"][index]}</button>)}
            </div>}
          </div>}
          <ActionDisclosure label={props.lang === "zh" ? "更多" : "More"}>
            {timelineLocation && <Button onClick={() => props.onLocateTimeline(timelineLocation.date, timelineLocation.startTime, timelineLocation.taskId)}>{props.lang === "zh" ? `跳转到时间轴 · ${timelineLocation.date} ${timelineLocation.startTime}` : `Go to timeline · ${timelineLocation.date} ${timelineLocation.startTime}`}</Button>}
            {props.onLocateTree && !props.task.completed && props.task.workflowStatus !== "done" && <Button onClick={() => props.onLocateTree?.(props.task!)}>{props.lang === "zh" ? "在 Tree 中查看任务" : "Go to task in Tree"}</Button>}
            <Button onClick={() => { setQuickActionMenu(null); setRecurrenceDraft({ ...fixedRecurrence, mode: "scheduled" }); setRecurrenceOpen(true); }}>{t(props.lang, "drawer.setRepeat")}</Button>
            <Button onClick={props.onCopy}>{t(props.lang, "drawer.duplicate")}</Button>
            {!isScheduled && showUncomplete && INCOMPLETE_OUTCOMES.map((outcome, index) => <Button key={outcome} onClick={() => chooseIncompleteOutcome(outcome)}>{INCOMPLETE_LABELS[zh ? "zh" : "en"][index]}</Button>)}
            <EditorConversion targets={["project", "habit"]} lang={props.lang} onConvert={props.setType} />
          </ActionDisclosure>
        </EditorActionRow>

        <section className={isScheduled ? "df-detail-schedule-row df-detail-schedule-actions df-editor-action-row--equal" : "df-detail-schedule-row df-detail-schedule-actions df-editor-action-row--equal df-detail-schedule-actions--unscheduled"}>
          <div className={`df-detail-incomplete-menu${quickActionMenu === "reschedule" ? " open" : ""}`} onMouseEnter={() => {
            if (quickRescheduleHoverTimer.current !== null) window.clearTimeout(quickRescheduleHoverTimer.current);
            quickRescheduleHoverTimer.current = window.setTimeout(() => { setQuickActionMenu("reschedule"); quickRescheduleHoverTimer.current = null; }, 100);
          }} onMouseLeave={() => {
            if (quickRescheduleHoverTimer.current !== null) window.clearTimeout(quickRescheduleHoverTimer.current);
            quickRescheduleHoverTimer.current = null;
            setQuickActionMenu(null);
          }} onFocus={() => setQuickActionMenu("reschedule")} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setQuickActionMenu(null); }} onKeyDown={(event) => { if (event.key === "Escape") { setQuickActionMenu(null); event.currentTarget.querySelector("button")?.focus(); } }}>
            <button type="button" className="df-detail-pill-trevor action df-detail-incomplete-trigger" aria-haspopup="menu" aria-expanded={quickActionMenu === "reschedule"} onClick={() => {
              if (quickRescheduleHoverTimer.current !== null) window.clearTimeout(quickRescheduleHoverTimer.current);
              quickRescheduleHoverTimer.current = null;
              setQuickActionMenu((open) => open === "reschedule" ? null : "reschedule");
            }}>
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2v4l2 2"/><circle cx="6" cy="6" r="5"/></svg>
              <span>{isScheduled ? t(props.lang, "drawer.quickReschedule") : zh ? "安排至" : "Schedule to"}</span>
              <svg className="df-detail-incomplete-chevron" viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 2l4 3-4 3" /></svg>
            </button>
            {quickActionMenu === "reschedule" && <div className="df-detail-incomplete-options" role="menu" aria-label={props.lang === "zh" ? "快速改期选项" : "Quick reschedule options"}>
              {quickRescheduleOptions.map((option) => <button key={option.date} type="button" role="menuitem" onClick={() => setCandidateReschedule(option.date)}>{props.lang === "zh" ? option.zh : option.en}</button>)}
              <button type="button" role="menuitem" onClick={() => { setQuickActionMenu(null); setRescheduleDate(props.task!.plannedForDate || props.today); setRescheduleOpen(true); }}>{props.lang === "zh" ? "选择日期…" : "Choose a date…"}</button>
            </div>}
          </div>
          {isScheduled && <button className="df-detail-pill-trevor action" onClick={() => props.onTaskUpdate(props.task!.id, { scheduledDate: undefined, scheduledStart: undefined, scheduledEnd: undefined, timelineRecords: (props.task!.timelineRecords || []).filter((record) => record.executionStatus !== "scheduled") })}>
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3l-6 6M3 3l6 6"/></svg>
              <span>{t(props.lang, "drawer.cancelSchedule")}</span>
          </button>}
          <EditorRemove confirmLabel={removeConfirmLabel} onClick={props.onDelete}>{t(props.lang, "drawer.remove")}</EditorRemove>
        </section>

        {rescheduleOpen && (
          <section className="df-detail-project-pick df-reschedule-editor">
            <label><span>{props.lang === "zh" ? "改期至" : "Reschedule to"}</span><input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} /></label>
            <div className="df-recurrence-editor-actions">
              <button type="button" className="primary" onClick={() => setCandidateReschedule(rescheduleDate || props.today)}>{props.lang === "zh" ? "确认改期" : "Confirm"}</button>
              <button type="button" onClick={() => setRescheduleOpen(false)}>{props.lang === "zh" ? "取消" : "Cancel"}</button>
            </div>
          </section>
        )}

        {projectPopover(true)}
        {durationPopover(Math.round((f.estimatedHours || 0.5) * 60))}

        {/* ── Dropdown: Recurrence Form ── */}
        {recurrenceOpen && (
          <section className="df-detail-project-pick df-recurrence-editor">
            <div className="df-repeat-form">
              <label><span>{t(props.lang, "drawer.startDate")}</span><input type="date" value={recurrenceEditor.startDate || props.today} onChange={(event) => setRecurrenceDraft((current) => ({ ...(current || recurrenceEditor), startDate: event.target.value }))} /></label>
              <label><span>{t(props.lang, "drawer.startTime")}</span><input type="time" value={recurrenceEditor.startTime || "09:00"} onChange={(event) => setRecurrenceDraft((current) => ({ ...(current || recurrenceEditor), startTime: event.target.value }))} /></label>
              <label><span>{t(props.lang, "drawer.frequency")}</span><select value={recurrenceEditor.frequency} onChange={(event) => setRecurrenceDraft((current) => ({ ...(current || recurrenceEditor), frequency: event.target.value as RecurrenceFrequency }))}>{recurrenceOptions(props.lang).filter((option) => option.value !== "none").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span>{props.lang === "zh" ? "时长" : "Duration"}</span><select value={recurrenceEditor.durationMinutes || Math.max(Math.round((f.estimatedHours || 0.5) * 60), 30)} onChange={(event) => setRecurrenceDraft((current) => ({ ...(current || recurrenceEditor), durationMinutes: Number(event.target.value) }))}>{DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}</select></label>
            </div>
            <div className="df-recurrence-editor-actions">
              <button type="button" className="primary" onClick={() => { props.onSaveRecurrence(props.task!.id, { ...recurrenceEditor, mode: "scheduled" }); setRecurrenceOpen(false); setRecurrenceDraft(null); }}>{props.lang === "zh" ? "确认" : "Confirm"}</button>
              <button type="button" onClick={() => { setRecurrenceOpen(false); setRecurrenceDraft(null); }}>{props.lang === "zh" ? "取消" : "Cancel"}</button>
            </div>
          </section>
        )}

        {/* ── Sub-tasks ── */}
        <section className="df-detail-subtasks-new">
          <div className="df-detail-section-head">
            <h3>{t(props.lang, "drawer.subtasks")}</h3>
            <div className="df-detail-subtask-tools">
              {props.aiEnabled && <IconButton
                className={`ui-icon-button--borderless df-detail-ai-subtasks${props.subtaskAiLoading ? " loading" : ""}`}
                icon={<UiSparklesIcon size={15} />}
                title={props.lang === "zh" ? "AI 自动拆解" : "Break down with AI"}
                label={props.lang === "zh" ? `使用 AI 拆解“${props.task.title}”` : `Break down “${props.task.title}” with AI`}
                aria-busy={props.subtaskAiLoading}
                disabled={props.subtaskAiLoading}
                onClick={() => props.onGenerateSubtasks(props.task!.id)}
              />}
              <IconButton className="ui-icon-button--borderless" icon={<UiPlusIcon size={15} />} label={t(props.lang, "drawer.addSubtask")} onClick={() => void addSubtask()} />
            </div>
          </div>
          <div className="df-subtask-list-new ui-divided-list">
            {renderSubtaskRows(props.task.subtasks || [])}
          </div>
        </section>

        <EditorNotes key={props.task.id} lang={props.lang} value={f.details} onChange={(notes) => set("details", notes)}
          onCommit={(notes) => props.onTaskUpdate(props.task!.id, { notes })} />
      </aside>
      </>
    );
  }
  if (props.editing && props.type === "project") {
    return (
      <aside className="df-drawer df-task-detail df-project-detail df-entity-editor" onMouseDown={(event) => event.stopPropagation()}>
        <CloseButton className="df-detail-close" label={t(props.lang, "form.close")} onClick={props.onClose} />
        <section className="df-detail-hero-trevor">
          <EditorTitle label={props.lang === "zh" ? "项目名称" : "Project name"} autoFocus value={f.title} onChange={(event) => set("title", event.target.value)} />
        </section>
        {projectMetadata()}
        <EditorActionRow className="df-editor-action-row--equal">
          <Button className="df-editor-action" variant="primary" onClick={props.onSave}><UiCheckIcon size={14} />{props.project ? t(props.lang, "drawer.save") : createLabel("project")}</Button>
          {props.project && <EditorRemove onClick={props.onDelete}>{t(props.lang, "drawer.remove")}</EditorRemove>}
          <ActionDisclosure label={props.lang === "zh" ? "更多" : "More"}>
            <EditorConversion targets={["task", "habit"]} lang={props.lang} onConvert={props.setType} />
          </ActionDisclosure>
        </EditorActionRow>
        <EditorNotes key={props.project?.id} lang={props.lang} value={f.details} onChange={(notes) => set("details", notes)} />
      </aside>
    );
  }
  return null;
}

// ── AppErrorBoundary: permanent top-level error boundary ──
// Catches React render errors and displays the error message + stack so the
// user sees a diagnostic screen instead of a blank white window. Without this,
// any uncaught render error in the App tree unmounts the entire root and
// leaves the Electron window blank.
class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[AppErrorBoundary]", error, info);
    if (productDemo && parent !== window) parent.postMessage({ channel: "navopath-product-demo", type: "error" }, location.origin);
  }
  render() {
    if (this.state.error) {
      const message = String(this.state.error?.message || this.state.error);
      const stack = String(this.state.error?.stack || "");
      return (
        <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap", color: "#C96F5B", background: "#fff", minHeight: "100vh" }}>
          <h2 style={{ color: "#C96F5B", margin: "0 0 12px" }}>Render Error</h2>
          <pre>{message}</pre>
          {stack && <pre style={{ marginTop: 12, color: "#666" }}>{stack}</pre>}
          <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: "6px 12px", fontSize: 14 }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root")!;
const rootKey = "__plannerRoot";
const rootWindow = window as typeof window & { [rootKey]?: ReturnType<typeof createRoot> };
const root = rootWindow[rootKey] ?? createRoot(rootElement);
rootWindow[rootKey] = root;
const routeSearchParams = new URLSearchParams(window.location.search);
const isCompactWindowRoute = routeSearchParams.get("compactWindow") === "1";
const PasswordRecoveryPage = lazy(() => import("./PasswordRecoveryPage"));
const isRecoveryCallback = isPasswordRecoveryCallback(new URL(window.location.href));
if (!productDemo && (isRecoveryCallback || window.desktopApi || /^\/app(?:\/|$)/.test(window.location.pathname))) {
  document.title = "NavoPath";
}
root.render(
  isRecoveryCallback
    ? <Suspense fallback={<ExecuteSkeleton />}><PasswordRecoveryPage lang={detectSystemLanguage()} getApi={waitForPlannerApi} onRequest={sendPasswordResetEmail} /></Suspense>
    : window.location.pathname === "/plugin-guide"
        ? <Suspense fallback={<div className="df-loading-inline">Loading guide...</div>}><PluginGuidePageLazy /></Suspense>
      : window.location.pathname === "/guidelines" || window.location.pathname === "/plugin-guidelines"
        ? <Suspense fallback={<div className="df-loading-inline">Loading API docs...</div>}><PluginGuidePageLazy /></Suspense>
      : <AppErrorBoundary><App /></AppErrorBoundary>,
);
