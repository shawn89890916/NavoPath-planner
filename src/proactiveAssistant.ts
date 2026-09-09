import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AiConversation, ChatMessage, PlannerData, Task, TimeEntry, TimelineRecord } from "./types";

export const DAILY_REVIEW_CONVERSATION_ID = "navopath-daily-review";

export type ProactiveNotificationItem = {
  taskId: string;
  recordId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type ProactiveNotification = {
  id: string;
  kind: "summary" | "material_change" | "deadline_risk" | "weather" | "needs_input" | "gap_check" | "task_start" | "unfinished_tasks" | "daily_review";
  title: string;
  body: string;
  metadata?: { action?: string; date?: string; startTime?: string; endTime?: string; taskId?: string; recordId?: string; targetConversation?: string; items?: ProactiveNotificationItem[] };
  read_at?: string | null;
  created_at: string;
};

let client: SupabaseClient | null | undefined;

function cloudClient() {
  if (client !== undefined) return client;
  const url = (import.meta as any).env?.VITE_SUPABASE_URL;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  return client;
}

export async function listProactiveNotifications() {
  const api = cloudClient();
  if (!api) return [] as ProactiveNotification[];
  const { data, error } = await api
    .from("navopath_notifications")
    .select("id,kind,title,body,metadata,read_at,created_at")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as ProactiveNotification[];
}

export async function listDailyReviewNotifications() {
  const api = cloudClient();
  if (!api) return [] as ProactiveNotification[];
  const { data, error } = await api
    .from("navopath_notifications")
    .select("id,kind,title,body,metadata,read_at,created_at")
    .eq("kind", "daily_review")
    .order("created_at", { ascending: true })
    .limit(365);
  if (error) throw error;
  return (data || []) as ProactiveNotification[];
}

/** Keep the workspace aware of new cloud-assistant messages outside Settings. */
export function subscribeToProactiveNotifications(onNotification: (notification: ProactiveNotification) => void) {
  const api = cloudClient();
  if (!api) return () => undefined;
  const channel = api
    .channel("navopath-proactive-notifications")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "navopath_notifications" }, (payload) => {
      const notification = payload.new as ProactiveNotification;
      if (notification?.id) onNotification(notification);
    })
    .subscribe();
  return () => { void api.removeChannel(channel); };
}

export async function requestProactiveNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported" as const;
  return Notification.permission === "default" ? Notification.requestPermission() : Notification.permission;
}

export function showProactiveSystemNotification(notification: Pick<ProactiveNotification, "title" | "body">) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    new Notification(notification.title, { body: notification.body });
    return true;
  } catch {
    return false;
  }
}

export async function markProactiveNotificationRead(id: string) {
  const api = cloudClient();
  if (!api) return;
  const { error } = await api.from("navopath_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function readProactiveEmailEnabled() {
  const api = cloudClient();
  if (!api) return false;
  const { data, error } = await api.from("navopath_cloud_assistant_settings").select("email_enabled").maybeSingle();
  if (error) throw error;
  return data?.email_enabled === true;
}

export async function setProactiveEmailEnabled(enabled: boolean) {
  const api = cloudClient();
  if (!api) throw new Error("Cloud assistant settings are unavailable.");
  const { data: auth, error: authError } = await api.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sign in to configure email notifications.");
  const { error } = await api.from("navopath_cloud_assistant_settings").update({ email_enabled: enabled }).eq("user_id", auth.user.id);
  if (error) throw error;
}

export function ensureDailyReviewConversation(data: PlannerData, notification: ProactiveNotification, lang: "zh" | "en") {
  if (notification.kind !== "daily_review" || !notification.body.trim()) return { data, conversationId: DAILY_REVIEW_CONVERSATION_ID, added: false };
  const now = notification.created_at || new Date().toISOString();
  const conversations = [...(data.aiConversations || [])];
  const existing = conversations.find((conversation) => conversation.id === DAILY_REVIEW_CONVERSATION_ID);
  const alreadyAdded = existing?.messages.some((message) => message.notificationId === notification.id);
  if (alreadyAdded) return { data, conversationId: DAILY_REVIEW_CONVERSATION_ID, added: false };
  const dateLabel = notification.metadata?.date || now.slice(0, 10);
  const message: ChatMessage = {
    id: `scheduled-summary-${notification.id}`,
    role: "assistant",
    content: notification.body,
    createdAt: now,
    saved: true,
    status: "done",
    format: "markdown",
    source: "scheduled_summary",
    notificationId: notification.id,
    steps: [{ label: lang === "zh" ? `每日复盘 · ${dateLabel}` : `Daily review · ${dateLabel}`, status: "done" }],
  };
  const nextConversation: AiConversation = existing
    ? { ...existing, title: lang === "zh" ? "每日复盘" : "Daily review", messages: [...existing.messages, message], updatedAt: now }
    : { id: DAILY_REVIEW_CONVERSATION_ID, title: lang === "zh" ? "每日复盘" : "Daily review", messages: [message], createdAt: now, updatedAt: now, pinned: true };
  const nextConversations = existing
    ? conversations.map((conversation) => conversation.id === DAILY_REVIEW_CONVERSATION_ID ? nextConversation : conversation)
    : [nextConversation, ...conversations];
  const active = nextConversations.find((conversation) => conversation.id === DAILY_REVIEW_CONVERSATION_ID)!;
  return {
    data: { ...data, aiConversations: nextConversations, activeAiConversationId: DAILY_REVIEW_CONVERSATION_ID, chat: active.messages.slice(-40) },
    conversationId: DAILY_REVIEW_CONVERSATION_ID,
    added: true,
  };
}

export type UnfinishedTaskDecision = "complete" | "tomorrow" | "ai";

export function applyUnfinishedTaskDecisions(data: PlannerData, items: ProactiveNotificationItem[], decisions: Record<string, UnfinishedTaskDecision>, now = new Date().toISOString()) {
  const tomorrow = new Date(`${items[0]?.date || now.slice(0, 10)}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowDate = tomorrow.toISOString().slice(0, 10);
  const aiTaskIds: string[] = [];
  const tasks = data.tasks.map((task) => {
    const item = items.find((candidate) => candidate.taskId === task.id && decisions[candidate.taskId]);
    if (!item) return task;
    const decision = decisions[item.taskId];
    if (decision === "ai") {
      aiTaskIds.push(task.id);
      return task;
    }
    const timelineRecords = (task.timelineRecords || []).map((record) => record.id !== item.recordId ? record : {
      ...record,
      executionStatus: decision === "complete" ? "completed" as const : "returned_unfinished" as const,
    });
    return {
      ...task,
      completed: decision === "complete" ? true : task.completed,
      ...(decision === "complete" ? { completedAt: now } : { plannedForDate: tomorrowDate, executionLane: "candidate" as const }),
      timelineRecords,
      updatedAt: now,
    };
  });
  return { data: { ...data, tasks }, aiTaskIds };
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function duration(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const from = startHour * 60 + startMinute;
  let to = endHour * 60 + endMinute;
  if (to <= from) to += 24 * 60;
  return Math.max(15, Math.min(1440, to - from));
}

export function recordGapActivity(data: PlannerData, input: { taskId?: string; newTaskTitle?: string; date: string; startTime: string; endTime: string }) {
  const now = new Date().toISOString();
  const minutes = duration(input.startTime, input.endTime);
  const existing = input.taskId ? data.tasks.find((task) => task.id === input.taskId) : undefined;
  const createdTask: Task | undefined = !existing && input.newTaskTitle?.trim()
    ? {
        id: uid("task"), title: input.newTaskTitle.trim().slice(0, 300), dueDate: input.date,
        category: "personal", priority: "medium", notes: "", goalId: "", completed: true,
        completedAt: now, estimatedHours: minutes / 60, order: Date.now(), subtasks: [], createdAt: now, updatedAt: now,
      }
    : undefined;
  const task = existing || createdTask;
  if (!task) throw new Error("Choose an existing task or enter a new task title.");
  const timelineRecord: TimelineRecord = {
    id: uid("record"), taskId: task.id, scheduledDate: input.date, scheduledStart: input.startTime,
    scheduledEnd: input.endTime, executionStatus: "completed", createdAt: now,
  };
  const entry: TimeEntry = {
    id: uid("time"), taskId: task.id, projectId: task.projectId, timelineRecordId: timelineRecord.id,
    startAt: `${input.date}T${input.startTime}:00+08:00`, endAt: `${input.date}T${input.endTime}:00+08:00`,
    durationMinutes: minutes, source: "manual", createdAt: now, updatedAt: now,
  };
  const updatedTask = { ...task, timelineRecords: [...(task.timelineRecords || []), timelineRecord], updatedAt: now };
  return {
    ...data,
    tasks: existing ? data.tasks.map((item) => item.id === existing.id ? updatedTask : item) : [...data.tasks, updatedTask],
    timeEntries: [...(data.timeEntries || []), entry],
  };
}
