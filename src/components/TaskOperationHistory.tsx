import type { Language } from "../types";
import type { TaskUndo } from "../utils/taskUndo";
import { Button } from "./UiPrimitives";

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
};

function describeOperation(operation: TaskOperation, lang: Language) {
  const [chinese, english] = operationVerbs[operation.kind];
  const count = operation.titles.length;
  const title = operation.titles[0] || (lang === "zh" ? "未命名任务" : "Untitled task");
  const subject = lang === "zh" ? (count === 1 ? `「${title}」` : `${count} 项任务`)
    : (count === 1 ? `“${title}”` : `${count} tasks`);
  if (lang === "en") return `${english} ${subject}`;
  if (operation.kind === "reschedule") return `调整了${subject}的时间`;
  if (operation.kind === "unschedule") return `取消了${subject}的安排`;
  if (operation.kind === "reorder") return `调整了${subject}的顺序`;
  return `${chinese}${subject}`;
}

export default function TaskOperationHistory({ operations, lang, now, label, onUndo }: {
  operations: TaskOperation[];
  lang: Language;
  now: Date;
  label: string;
  onUndo: (operation: TaskOperation) => void;
}) {
  const locale = lang === "zh" ? "zh-CN" : "en-GB";
  const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const calendar = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayLabel = calendar.format(now);
  const yesterdayLabel = calendar.format(yesterday);

  return (
    <section className="df-shelf-scroll df-task-history" aria-label={label}>
      {operations.length === 0 ? (
        <p className="df-task-history-empty">{lang === "zh" ? "本次打开应用后还没有任务操作。" : "No task activity in this session yet."}</p>
      ) : (
        <ol className="df-task-history-list">
          {operations.map((operation) => {
            const date = new Date(operation.at);
            const day = calendar.format(date);
            const dayLabel = day === todayLabel ? (lang === "zh" ? "今天" : "Today")
              : day === yesterdayLabel ? (lang === "zh" ? "昨天" : "Yesterday") : day;
            const description = describeOperation(operation, lang);
            return (
              <li className="df-task-history-row" key={operation.id}>
                <div>
                  <time dateTime={operation.at} title={`${day} ${clock.format(date)}`}>{dayLabel} {clock.format(date)}</time>
                  <p>{description}</p>
                </div>
                {operation.undone ? (
                  <span className="df-task-history-undone" role="status">{lang === "zh" ? "已撤销" : "Undone"}</span>
                ) : (
                  <Button variant="ghost" aria-label={`${lang === "zh" ? "撤销" : "Undo"} · ${description}`} onClick={() => onUndo(operation)}>
                    {lang === "zh" ? "撤销" : "Undo"}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
