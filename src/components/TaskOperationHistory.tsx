import { EmptyState } from "./EmptyState";
import { t } from "../i18n";
import type { Language, Project, Subtask, Task, TimelineRecord } from "../types";
import { isIsoDate } from "../utils/localDate";
import type { TaskUndo } from "../utils/taskUndo";
import type { SyncBatchUndo } from "../utils/syncBatchUndo";
import { countDoneSubtasks, countSubtasks } from "../utils/treeOrder";
import { UndoButton } from "./UiPrimitives";

const operationVerbs = {
  create: ["创建了", "Created"],
  edit: ["修改了", "Edited"],
  delete: ["删除了", "Deleted"],
  complete: ["完成了", "Completed"],
  reopen: ["重新打开了", "Reopened"],
  schedule: ["安排了", "Scheduled"],
  reschedule: ["调整了时间", "Rescheduled"],
  unschedule: ["取消了安排", "Cleared the schedule for"],
  reorder: ["调整了顺序", "Reordered"],
  sync: ["同步了", "Synced"],
} as const;

export type TaskOperationKind = keyof typeof operationVerbs;
export type TaskOperation = {
  id: string;
  workspaceKey: string;
  at: string;
  kind: TaskOperationKind;
  titles: string[];
  undo: TaskUndo;
  undone?: boolean;
  sync?: SyncBatchUndo;
};

function describeOperation(operation: TaskOperation, lang: Language) {
  if (operation.sync) {
    const tasks = operation.undo.added.length + operation.undo.removed.length + operation.undo.changes.length;
    const projects = operation.sync.projects.length;
    return lang === "zh" ? `Super Productivity 同步 · ${tasks} 项任务、${projects} 个项目` : `Super Productivity sync · ${tasks} tasks, ${projects} projects`;
  }
  const [chinese, english] = operationVerbs[operation.kind];
  const count = operation.titles.length;
  const title = operation.titles[0]?.trim() || (lang === "zh" ? "未命名任务" : "Untitled task");
  const subject = lang === "zh" ? (count === 1 ? `「${title}」` : `${count} 项任务`)
    : (count === 1 ? `“${title}”` : `${count} tasks`);
  if (lang === "en") return `${english} ${subject}`;
  if (operation.kind === "reschedule") return `调整了${subject}的时间`;
  if (operation.kind === "unschedule") return `取消了${subject}的安排`;
  if (operation.kind === "reorder") return `调整了${subject}的顺序`;
  return `${chinese}${subject}`;
}

const fieldLabels = {
  title: ["名称", "Title"],
  dueDate: ["截止日期", "Due date"],
  estimatedHours: ["预计时长", "Estimated duration"],
  projectId: ["所属项目", "Project"],
  priority: ["优先级", "Priority"],
  importance: ["重要性", "Importance"],
  urgency: ["紧急程度", "Urgency"],
  workflowStatus: ["状态", "Status"],
  plannedForDate: ["计划日期", "Planned date"],
} as const;

const valueLabels: Record<string, [string, string]> = {
  high: ["高", "high"], medium: ["中", "medium"], low: ["低", "low"],
  backlog: ["待办", "to do"], next: ["计划中", "up next"], doing: ["进行中", "in progress"],
  waiting: ["等待中", "waiting"], done: ["已完成", "done"],
};

export function describeOperationDetails(operation: TaskOperation, lang: Language, projects: Project[], dates: Intl.DateTimeFormat, calendar: Intl.DateTimeFormat) {
  const zh = lang === "zh", localeIndex = zh ? 0 : 1;
  const list = new Intl.ListFormat(zh ? "zh-CN" : "en-GB", { style: "short", type: "conjunction" });
  const none = zh ? "未设置" : "unset";
  const quote = (title: string) => zh ? `「${title.trim()}」` : `“${title.trim()}”`;
  const year = new Date(operation.at).getFullYear();
  const date = (value: unknown) => {
    if (!isIsoDate(value)) return none;
    const day = new Date(`${value}T00:00:00`);
    return (day.getFullYear() === year ? dates : calendar).format(day);
  };
  const duration = (value: number) => zh ? `${Math.round(value * 60)} 分钟` : `${Math.round(value * 60)} min`;
  const project = (id: string) => {
    const title = projects.find((item) => item.id === id)?.title;
    return title ? quote(title) : (zh ? "已移除的项目" : "a removed project");
  };
  const slot = (day?: string, start?: string, end?: string, endDay?: string) => day
    ? `${date(day)} ${start ? `${start}${end ? `–${endDay && endDay !== day ? `${date(endDay)} ` : ""}${end}` : ""}` : (zh ? "全天" : "all day")}`
    : "";
  const slots = (records?: TimelineRecord[], legacy: [string?, string?, string?] = []) => [
    slot(...legacy),
    ...(records || []).filter((record) => record.executionStatus === "scheduled" || record.executionStatus === "completed")
      .map((record) => slot(record.scheduledDate, record.scheduledStart, record.scheduledEnd, record.scheduledEndDate)),
  ].filter(Boolean);
  const value = (key: keyof typeof fieldLabels, current: unknown) => {
    if (current == null || current === "") return none;
    if (key === "estimatedHours" && typeof current === "number") return duration(current);
    if (typeof current !== "string") return none;
    if (key === "dueDate" || key === "plannedForDate") return date(current);
    if (key === "projectId") return project(current);
    if (key === "title") return quote(current);
    return valueLabels[current]?.[localeIndex] || none;
  };
  const withTitle = (title: string, line: string) => operation.titles.length > 1 ? `${quote(title)} · ${line}` : line;
  const snapshot = (task: Task) => {
    const times = slots(task.timelineRecords, [task.scheduledDate, task.scheduledStart, task.scheduledEnd]);
    return [
      times.length ? (zh ? `安排在 ${list.format(times)}` : `Scheduled for ${list.format(times)}`) : "",
      task.projectId ? (zh ? `归属项目${project(task.projectId)}` : `In project ${project(task.projectId)}`) : "",
      task.dueDate && task.dueDateSource !== "automatic" ? (zh ? `${date(task.dueDate)}截止` : `Due ${date(task.dueDate)}`) : "",
      task.estimatedHours ? (zh ? `预计 ${duration(task.estimatedHours)}` : `Estimated at ${duration(task.estimatedHours)}`) : "",
    ].filter(Boolean).join(zh ? "，" : " · ");
  };
  const details = [...operation.undo.added, ...operation.undo.removed].flatMap((task) => {
    const text = snapshot(task);
    if (operation.sync) return [`${operation.undo.added.includes(task) ? (zh ? "新增" : "Added") : (zh ? "删除" : "Removed")} ${quote(task.title)}${text ? " · " + text : ""}`];
    return text ? [withTitle(task.title, text)] : [];
  });
  for (const { title, fields, previousSlot } of operation.undo.changes) {
    const field = new Map(fields.map((change) => [change.key, change]));
    const records = field.get("timelineRecords");
    const nextSlot = (["scheduledDate", "scheduledStart", "scheduledEnd"] as const).map((key, index) =>
      (field.has(key) ? field.get(key)?.after : previousSlot[index]) as string | undefined) as typeof previousSlot;
    const before = slots(records?.before as TimelineRecord[] | undefined, previousSlot);
    const after = slots(records?.after as TimelineRecord[] | undefined, nextSlot);
    const removed = before.filter((item) => !after.includes(item));
    const added = after.filter((item) => !before.includes(item));
    if (removed.length && added.length) details.push(withTitle(title, zh
      ? `排程从 ${list.format(removed)} 改到 ${list.format(added)}`
      : `Moved from ${list.format(removed)} to ${list.format(added)}`));
    else if (added.length) details.push(withTitle(title, zh ? `安排到 ${list.format(added)}` : `Scheduled for ${list.format(added)}`));
    else if (removed.length) details.push(withTitle(title, zh ? `移除了 ${list.format(removed)} 的时间块` : `Removed the time block at ${list.format(removed)}`));

    if (operation.kind !== "edit" && operation.kind !== "sync") continue;
    for (const key of Object.keys(fieldLabels) as (keyof typeof fieldLabels)[]) {
      const change = field.get(key);
      if (!change || (key === "plannedForDate" && (removed.length || added.length))) continue;
      const from = value(key, change.before), to = value(key, change.after);
      if (from === to) continue;
      const name = fieldLabels[key][localeIndex];
      details.push(withTitle(title, zh ? `${name}从 ${from} 改为 ${to}` : `${name} changed from ${from} to ${to}`));
    }
    if (field.has("notes")) details.push(withTitle(title, zh ? (field.get("notes")?.after ? "更新了备注" : "清空了备注") : (field.get("notes")?.after ? "Updated the notes" : "Cleared the notes")));
    if (field.has("recurrence")) details.push(withTitle(title, zh ? "修改了重复规则" : "Updated the repeat rule"));
    const subtasks = field.get("subtasks");
    if (subtasks) {
      const summarize = (items: unknown) => `${countDoneSubtasks(items as Subtask[] | undefined)}/${countSubtasks(items as Subtask[] | undefined)}`;
      const from = summarize(subtasks.before), to = summarize(subtasks.after);
      details.push(withTitle(title, from === to ? (zh ? "更新了子任务" : "Updated the subtasks")
        : zh ? `子任务完成进度从 ${from} 变为 ${to}` : `Subtask progress changed from ${from} to ${to}`));
    }
  }
  for (const change of operation.sync?.projects || []) {
    const action = !change.before ? (zh ? "新增项目" : "Added project") : !change.after ? (zh ? "删除项目" : "Removed project") : (zh ? "修改项目" : "Edited project");
    details.push(`${action} ${quote(change.after?.title || change.before?.title || "")}`);
  }
  return details;
}

export default function TaskOperationHistory({ operations, projects, lang, now, label, onUndo }: {
  operations: TaskOperation[];
  projects: Project[];
  lang: Language;
  now: Date;
  label: string;
  onUndo: (operation: TaskOperation) => void;
}) {
  const locale = lang === "zh" ? "zh-CN" : "en-GB";
  const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const calendar = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
  const dates = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayLabel = calendar.format(now);
  const yesterdayLabel = calendar.format(yesterday);

  return (
    <section className="df-task-history" aria-label={label}>
      {operations.length === 0 ? (
        <EmptyState compact title={lang === "zh" ? "最近三天没有任务操作" : "No task activity in the last three days"} />
      ) : (
        <ol className="df-task-history-list">
          {operations.map((operation) => {
            const date = new Date(operation.at);
            const day = calendar.format(date);
            const dayLabel = day === todayLabel ? (lang === "zh" ? "今天" : "Today")
              : day === yesterdayLabel ? (lang === "zh" ? "昨天" : "Yesterday") : day;
            const description = describeOperation(operation, lang);
            const details = describeOperationDetails(operation, lang, projects, dates, calendar);
            return (
              <li className="df-task-history-row" key={operation.id}>
                <div>
                  <time dateTime={operation.at} title={`${day} ${clock.format(date)}`}>{dayLabel} {clock.format(date)}</time>
                  <p>{description}</p>
                  {details.map((detail, index) => <p key={index} className="df-task-history-detail">{detail}</p>)}
                </div>
                {operation.undone ? (
                  <span className="df-task-history-undone" role="status">{lang === "zh" ? "已撤销" : "Undone"}</span>
                ) : (
                  <UndoButton aria-label={`${t(lang, "toast.undo")} · ${description}`} onClick={() => onUndo(operation)}>
                    {t(lang, "toast.undo")}
                  </UndoButton>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
