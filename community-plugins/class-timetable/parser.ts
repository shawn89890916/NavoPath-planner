import type { CalendarEvent, PlannerData } from "../../src/types";
export function parseTimetableJson(text: string, now = new Date().toISOString()): CalendarEvent[] {
  const rows: unknown = JSON.parse(text);
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw Error("Invalid timetable rows");
  const seen = new Set<string>();
  return rows.map<CalendarEvent | null>((row) => {
    if (!row || typeof row.title !== "string" || !row.title.trim() || row.title.length > 300 || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.endTime) || row.endTime <= row.startTime) throw Error("Invalid timetable row");
    const title = row.title.trim();
    const key = `${row.date}_${row.startTime}_${row.endTime}_${title}`;
    if (seen.has(key)) return null;
    seen.add(key);
    let hash = 2166136261;
    for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    return { id: `course_${row.date}_${row.startTime}_${hash.toString(36)}`, title, date: row.date, startDate: row.date, endDate: row.date, startTime: row.startTime, endTime: row.endTime, category: "personal" as const, details: String(row.location || "").slice(0, 2000), imported: true, fixedCourse: true, createdAt: now };
  }).filter((event): event is CalendarEvent => event !== null);
}
export function mergeTimetable(data: PlannerData, imported: CalendarEvent[]): PlannerData {
  const existing = new Set(data.events.filter(event => event.fixedCourse).map(event => `${event.date}_${event.startTime}_${event.endTime}_${event.title}`));
  const additions = imported.filter(event => !existing.has(`${event.date}_${event.startTime}_${event.endTime}_${event.title}`));
  return additions.length ? { ...data, events: [...data.events, ...additions] } : data;
}
