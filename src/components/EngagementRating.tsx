import { useId, useState } from "react";
import type { Language } from "../i18n";
import type { Task, TimelineRecord } from "../types";
import { engagementFor, engagementMinutes, engagementPatch } from "../utils/engagement";
import { timelineRecordDurationMinutes } from "../utils/timelineRecords";
import { IconButton, Popover } from "./UiPrimitives";
import { UiInfoIcon } from "./UiIcons";

export function EngagementRating({ task, record, lang, onUpdate }: {
  task: Task;
  record?: TimelineRecord | null;
  lang: Language;
  onUpdate: (taskId: string, patch: Partial<Task>) => void;
}) {
  const tooltipId = useId();
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
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
      const key = item?.id || task.id;
      const helpId = `${tooltipId}-${key}`;
      return <div key={key}>
        {completed.length > 1 && <span className="df-engagement-caption">{label}</span>}
        <div className="df-engagement-row">
          <span className="df-engagement-help" onPointerEnter={(event) => { if (event.pointerType !== "touch") setActiveHelp(key); }} onPointerLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setActiveHelp(null); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveHelp(null); }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setActiveHelp(null); } }}>
            <IconButton icon={<UiInfoIcon size={20} />} label={zh ? "了解投入度" : "About engagement"} title="" aria-describedby={activeHelp === key ? helpId : undefined} onFocus={() => setActiveHelp(key)} onClick={() => setActiveHelp(key)} />
            {activeHelp === key && <Popover role="tooltip" id={helpId} className="df-engagement-tooltip">
              <span>{zh ? "投入度是你对这次任务专注和投入程度的自评分，范围 0–100%，默认 80%。时间轴按此比例显示任务块不透明度，统计时长也按投入度加权。" : "Engagement is your self-rating of focus and effort for this execution, from 0–100%, defaulting to 80%. It controls task-block opacity and weights the duration used in statistics."}</span>
              <span>{zh ? "投入时长" : "Engaged time"}: {minutes} × {score}% = {Math.round(engagementMinutes(minutes, score) * 10) / 10} {zh ? "分钟" : "min"}</span>
            </Popover>}
          </span>
          <span className="df-engagement-label">{zh ? "投入度" : "Engagement"}</span>
          <strong>{score}%</strong>
          <input type="range" min="0" max="100" step="1" value={score} aria-label={`${zh ? "投入度" : "Engagement"} · ${label}`} aria-valuetext={`${score}%`} onChange={(event) => onUpdate(task.id, engagementPatch(task, Number(event.target.value), item))} />
        </div>
      </div>;
    })}
  </section>;
}
