import { useState } from "react";
import type { Language, PlannerData } from "../types";
import { recordGapActivity, type ProactiveNotification } from "../proactiveAssistant";
import "./ProactiveNotificationCenter.css";

export function ProactiveNotificationCenter({
  data,
  lang,
  notifications,
  open,
  onClose,
  onDismiss,
  onOpenReview,
  onOpenUnfinished,
  onSaveData,
}: {
  data: PlannerData;
  lang: Language;
  notifications: ProactiveNotification[];
  open: boolean;
  onClose: () => void;
  onDismiss: (notification: ProactiveNotification) => void;
  onOpenReview: (notification?: ProactiveNotification) => void;
  onOpenUnfinished: (notification: ProactiveNotification) => void;
  onSaveData: (data: PlannerData) => void;
}) {
  const [selection, setSelection] = useState<Record<string, string>>({});

  if (!open) return null;
  const logGap = (item: ProactiveNotification) => {
    const metadata = item.metadata;
    if (!metadata?.date || !metadata.startTime || !metadata.endTime) return;
    const selected = selection[item.id];
    const title = selected === "__new__" ? window.prompt(lang === "zh" ? "新任务名称" : "New task title")?.trim() : "";
    if (!selected || (selected === "__new__" && !title)) return;
    onSaveData(recordGapActivity(data, {
      taskId: selected === "__new__" ? undefined : selected,
      newTaskTitle: title,
      date: metadata.date,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
    }));
    onDismiss(item);
  };

  return <div className="df-proactive-center-layer" role="presentation" onMouseDown={onClose}>
    <section className="df-proactive-center" role="dialog" aria-modal="true" aria-labelledby="df-proactive-center-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="df-proactive-center-head">
        <div><strong id="df-proactive-center-title">{lang === "zh" ? "主动助理" : "Proactive assistant"}</strong><small>{lang === "zh" ? `${notifications.length} 条待处理提醒` : `${notifications.length} pending message${notifications.length === 1 ? "" : "s"}`}</small></div>
        <button type="button" className="df-proactive-center-close" onClick={onClose} aria-label={lang === "zh" ? "关闭通知中心" : "Close notifications"}>×</button>
      </header>
      <div className="df-proactive-center-list">
        {notifications.length === 0 && <p className="df-proactive-center-empty">{lang === "zh" ? "目前没有新的提醒。" : "No new messages."}</p>}
        {notifications.map((item) => <article key={item.id} className="df-proactive-center-item">
          <button type="button" className="df-proactive-center-item-dismiss" onClick={() => onDismiss(item)} aria-label={lang === "zh" ? `关闭${item.title}` : `Dismiss ${item.title}`}>×</button>
          <div className="df-proactive-center-item-copy"><strong>{item.title}</strong><p>{item.body}</p></div>
          {item.kind === "daily_review" && <button type="button" className="df-proactive-center-action" onClick={() => onOpenReview(item)}>{lang === "zh" ? "打开每日复盘" : "Open daily review"}</button>}
          {item.kind === "unfinished_tasks" && <button type="button" className="df-proactive-center-action" onClick={() => onOpenUnfinished(item)}>{lang === "zh" ? "确认未完成任务" : "Review unfinished tasks"}</button>}
          {item.kind === "gap_check" && item.metadata?.date && <div className="df-proactive-center-gap">
            <select value={selection[item.id] || ""} onChange={(event) => setSelection((current) => ({ ...current, [item.id]: event.target.value }))} aria-label={lang === "zh" ? "选择实际执行的任务" : "Choose completed task"}>
              <option value="">{lang === "zh" ? "选择任务…" : "Choose task…"}</option>
              <option value="__new__">{lang === "zh" ? "+ 新建任务" : "+ New task"}</option>
              {data.tasks.filter((task) => !task.completed).map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}
            </select>
            <button type="button" className="df-proactive-center-action" onClick={() => logGap(item)}>{lang === "zh" ? "补记" : "Log"}</button>
          </div>}
        </article>)}
      </div>
    </section>
  </div>;
}
