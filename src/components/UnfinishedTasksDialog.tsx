import { useMemo, useState } from "react";
import type { Language, PlannerData } from "../types";
import { applyUnfinishedTaskDecisions, type ProactiveNotification, type UnfinishedTaskDecision } from "../proactiveAssistant";
import "./UnfinishedTasksDialog.css";

export function UnfinishedTasksDialog({ notification, data, lang, onClose, onSaveData, onOpenAi, onDismiss }: {
  notification: ProactiveNotification;
  data: PlannerData;
  lang: Language;
  onClose: () => void;
  onSaveData: (data: PlannerData) => void;
  onOpenAi: (taskIds: string[]) => void;
  onDismiss: (notification: ProactiveNotification) => void;
}) {
  const items = notification.metadata?.items || [];
  const tasks = useMemo(() => items.map((item) => ({ item, task: data.tasks.find((task) => task.id === item.taskId) })).filter((entry) => entry.task), [data.tasks, items]);
  const [decisions, setDecisions] = useState<Record<string, UnfinishedTaskDecision>>(() => Object.fromEntries(tasks.map(({ item }) => [item.taskId, "ai"])));

  const apply = () => {
    const result = applyUnfinishedTaskDecisions(data, items, decisions);
    if (result.data !== data) onSaveData(result.data);
    onDismiss(notification);
    onClose();
    if (result.aiTaskIds.length) onOpenAi(result.aiTaskIds);
  };

  return <div className="df-unfinished-dialog-layer" role="presentation" onMouseDown={onClose}>
    <section className="df-unfinished-dialog" role="dialog" aria-modal="true" aria-labelledby="df-unfinished-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="df-unfinished-dialog-head"><div><strong id="df-unfinished-dialog-title">{lang === "zh" ? "收工前确认" : "End-of-day check-in"}</strong><p>{lang === "zh" ? "确认今天未完成的时间块，决定下一步。" : "Decide what to do with today's unfinished time blocks."}</p></div><button type="button" onClick={onClose} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header>
      <div className="df-unfinished-dialog-list">
        {tasks.map(({ item, task }) => <label className="df-unfinished-dialog-row" key={`${item.taskId}:${item.recordId}`}>
          <span><strong>{task!.title}</strong><small>{item.startTime}–{item.endTime}</small></span>
          <select value={decisions[item.taskId] || "ai"} onChange={(event) => setDecisions((current) => ({ ...current, [item.taskId]: event.target.value as UnfinishedTaskDecision }))} aria-label={task!.title}>
            <option value="ai">{lang === "zh" ? "交给 AI 安排" : "Ask AI to arrange"}</option>
            <option value="tomorrow">{lang === "zh" ? "移至明日候选" : "Move to tomorrow"}</option>
            <option value="complete">{lang === "zh" ? "标记完成" : "Mark complete"}</option>
          </select>
        </label>)}
        {tasks.length === 0 && <p className="df-unfinished-dialog-empty">{lang === "zh" ? "这些任务已被更新。" : "These tasks have already changed."}</p>}
      </div>
      <footer className="df-unfinished-dialog-actions"><button type="button" className="df-unfinished-dialog-secondary" onClick={onClose}>{lang === "zh" ? "稍后处理" : "Later"}</button><button type="button" className="df-unfinished-dialog-primary" disabled={!tasks.length} onClick={apply}>{lang === "zh" ? "应用选择" : "Apply choices"}</button></footer>
    </section>
  </div>;
}
