import { useMemo } from "react";
import type { Language } from "../types";
import type { TimeAllocationMetrics } from "../metrics/timeAllocation";
import type { buildInsights } from "../metrics/insightFacts";
import type { ReadingLibrary } from "./model";

/** Reuse the filtered and range-clipped Metrics facts. No new collector or duration store. */
export function groupReadingMetrics(library: ReadingLibrary, allocation: Pick<TimeAllocationMetrics, "taskEntries">, trackedEntries: ReturnType<typeof buildInsights>["trackedEntries"]) {
  const bookByTask = new Map(library.taskLinks.map(link => [link.taskId, link.bookId]));
  const rows = new Map(library.books.map(book => [book.id, { id: book.id, title: book.title, planned: 0, tracked: 0 }]));
  const schedules = new Set<string>(), trackedIds = new Set<string>();
  for (const entry of allocation.taskEntries) {
    const row = rows.get(bookByTask.get(entry.taskId) || "");
    const start = entry.scheduledStart.getTime(), end = entry.scheduledEnd.getTime();
    const key = JSON.stringify([entry.taskId, entry.recordId, start, end]);
    if (!row || schedules.has(key) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    schedules.add(key); row.planned += (end - start) / 60_000;
  }
  for (const entry of trackedEntries) {
    const row = rows.get(bookByTask.get(entry.taskId) || "");
    if (!row || !entry.id || trackedIds.has(entry.id) || !Number.isFinite(entry.minutes) || entry.minutes <= 0) continue;
    trackedIds.add(entry.id); row.tracked += entry.minutes;
  }
  return [...rows.values()].filter(row => row.planned || row.tracked).sort((a,b) => b.tracked-a.tracked || b.planned-a.planned || a.title.localeCompare(b.title));
}

export default function ReadingMetrics({ library, allocation, trackedEntries, lang }: {
  library: ReadingLibrary; allocation: TimeAllocationMetrics; trackedEntries: ReturnType<typeof buildInsights>["trackedEntries"]; lang: Language;
}) {
  const zh = lang === "zh";
  const rows = useMemo(() => groupReadingMetrics(library, allocation, trackedEntries), [library, allocation, trackedEntries]);
  const minutes = (value: number) => Math.round(value) + (zh ? " 分钟" : " min");
  const planned = rows.reduce((n,row)=>n+row.planned,0), tracked = rows.reduce((n,row)=>n+row.tracked,0);
  return <section aria-label={zh ? "阅读统计" : "Reading statistics"}>
    <h3>{zh ? "阅读统计" : "Reading statistics"}</h3>
    <p>{zh ? "按当前统计范围和筛选条件汇总关联阅读任务，实际时长仅包含计时记录。" : "Reading tasks within the selected range and filters. Actual time uses recorded time entries only."}</p>
    <div className="df-metric-insight-stats"><div><span>{zh ? "阅读排程" : "Reading schedule"}</span><strong>{minutes(planned)}</strong></div><div><span>{zh ? "阅读计时" : "Reading tracked"}</span><strong>{minutes(tracked)}</strong></div></div>
    {rows.length ? <div className="df-metric-insight-table" tabIndex={0} role="region" aria-label={zh ? "按书籍统计" : "By book"}><table><thead><tr><th>{zh ? "书籍" : "Book"}</th><th>{zh ? "排程" : "Scheduled"}</th><th>{zh ? "计时" : "Tracked"}</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.title}</td><td>{minutes(row.planned)}</td><td>{minutes(row.tracked)}</td></tr>)}</tbody></table></div> : <p>{zh ? "所选范围暂无阅读记录。" : "No reading activity in this range."}</p>}
  </section>;
}
