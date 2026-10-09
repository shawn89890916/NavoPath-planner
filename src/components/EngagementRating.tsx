import type { Language } from "../i18n";
import type { Task, TimelineRecord } from "../types";
import { engagementFor, engagementMinutes, engagementPatch } from "../utils/engagement";
import { timelineRecordDurationMinutes } from "../utils/timelineRecords";

export function EngagementRating({ task, record, lang, onUpdate }: {
  task: Task;
  record?: TimelineRecord | null;
  lang: Language;
  onUpdate: (taskId: string, patch: Partial<Task>) => void;
}) {
  const records = record ? [record] : task.timelineRecords?.length ? task.timelineRecords : [null];
  const completed = records.filter((item) => item
    ? item.executionStatus === "completed" || task.completed && item.executionStatus === "scheduled"
    : task.completed);
  if (!completed.length) return null;
  const zh = lang === "zh";
  return <section className="df-engagement-rating" aria-label={zh ? "投入度评分" : "Engagement rating"}>
    {completed.map((item) => {
      const score = engagementFor(task, item);
      const minutes = item?.scheduledStart ? timelineRecordDurationMinutes(item) : (task.estimatedHours || .5) * 60;
      const label = item ? `${item.scheduledDate} ${item.scheduledStart}`.trim() : task.title;
      return <label key={item?.id || task.id}>
        <span className="df-engagement-heading"><span>{zh ? "投入度" : "Engagement"}</span><strong>{score}%</strong></span>
        {item && <span className="df-engagement-caption">{label}</span>}
        <input type="range" min="0" max="100" step="1" value={score} aria-label={`${zh ? "投入度" : "Engagement"} · ${label}`} aria-valuetext={`${score}%`} onChange={(event) => onUpdate(task.id, engagementPatch(task, Number(event.target.value), item))} />
        <span className="df-engagement-caption">{zh ? "投入时长" : "Engaged time"}: {minutes} × {score}% = {Math.round(engagementMinutes(minutes, score) * 10) / 10} {zh ? "分钟" : "min"}</span>
      </label>;
    })}
  </section>;
}
