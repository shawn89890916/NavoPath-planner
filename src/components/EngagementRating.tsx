import { useId, useState } from "react";
import type { Language } from "../i18n";
import type { Task, TimelineRecord } from "../types";
import { canRateEngagement, engagementFor, engagementMinutes, engagementPatch } from "../utils/engagement";
import { timelineRecordDurationMinutes } from "../utils/timelineRecords";
import { Popover } from "./UiPrimitives";

export function EngagementRating({ task, record, lang, onUpdate }: {
  task: Task;
  record?: TimelineRecord | null;
  lang: Language;
  onUpdate: (taskId: string, patch: Partial<Task>) => void;
}) {
  const tooltipId = useId();
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const records = record ? [record] : task.timelineRecords?.length ? task.timelineRecords : [null];
  const rateable = records.filter(canRateEngagement);
  if (!rateable.length) return null;
  const zh = lang === "zh";
  return <section className="df-engagement-rating" aria-label={zh ? "投入度评分" : "Engagement rating"}>
    {rateable.map((item) => {
      const score = engagementFor(task, item);
      const minutes = item?.scheduledStart ? timelineRecordDurationMinutes(item) : (task.estimatedHours || .5) * 60;
      const label = item ? `${item.scheduledDate} ${item.scheduledStart}`.trim() : task.title;
      const key = item?.id || task.id;
      const helpId = `${tooltipId}-${key}`;
      return <div key={key}>
        {rateable.length > 1 && <span className="df-engagement-caption">{label}</span>}
        <div className="df-engagement-row">
          <span className="df-engagement-help" onPointerLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setActiveHelp(null); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveHelp(null); }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setActiveHelp(null); } }}>
            <button type="button" className="df-engagement-label" aria-describedby={activeHelp === key ? helpId : undefined} onPointerEnter={(event) => { if (event.pointerType !== "touch") setActiveHelp(key); }} onFocus={() => setActiveHelp(key)} onClick={() => setActiveHelp(key)}>{zh ? "投入度" : "Engagement"}</button>
            {activeHelp === key && <Popover role="tooltip" id={helpId} className="df-engagement-tooltip">
              <span>{zh ? "投入度是你对这次任务专注和投入程度的自评分，范围 10–100%，默认 80%。时间轴左侧色条从顶部按此比例填充，悬停色条可查看评分，统计时长按投入度加权。" : "Engagement is your self-rating of focus and effort for this execution, from 10–100%, defaulting to 80%. The left stripe fills down from the top; hover over it to see the rating. Statistics use duration weighted by engagement."}</span>
              <span>{zh ? "投入时长" : "Engaged time"}: {minutes} × {score}% = {Math.round(engagementMinutes(minutes, score) * 10) / 10} {zh ? "分钟" : "min"}</span>
            </Popover>}
          </span>
          <input type="range" min="10" max="100" step="10" value={score} aria-label={`${zh ? "投入度" : "Engagement"} · ${label}`} aria-valuetext={`${score}%`} onChange={(event) => onUpdate(task.id, engagementPatch(task, Number(event.target.value), item))} />
          <span className="df-engagement-score">{score}%</span>
        </div>
      </div>;
    })}
  </section>;
}
