import { addDays, minutesToTime, timeToMinutes } from "../timelineGeometry";
import type { ScheduleTemplate } from "../types";
import { clockTimeSpanMinutes } from "./timelineRecords";

export const TEMPLATE_DAY_MINUTES = 24 * 60;

export type TemplatePeriod = {
  id: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
};

export type TemplateInterval = { start: number; end: number };

export function readTemplatePeriods(slots: ScheduleTemplate["slots"]): TemplatePeriod[] {
  return slots.map((slot) => ({
    id: slot.id,
    title: slot.label,
    startMinutes: timeToMinutes(slot.start),
    durationMinutes: clockTimeSpanMinutes(slot.start, slot.end),
  }));
}

export function templatePeriodEnd(period: TemplatePeriod) {
  return period.startMinutes + period.durationMinutes;
}

export function templateApplication(
  periods: TemplatePeriod[],
  date: string,
  getIntervals: (date: string) => TemplateInterval[],
  onEmptyTitle: string,
) {
  const day = getIntervals(date);
  const overnight = periods.some((period) => templatePeriodEnd(period) > TEMPLATE_DAY_MINUTES)
    ? getIntervals(addDays(date, 1))
    : [];
  const skipped = new Set<string>();
  const available: TemplatePeriod[] = [];

  for (const period of [...periods].sort((a, b) => a.startMinutes - b.startMinutes)) {
    const end = templatePeriodEnd(period);
    if (day.some((interval) => period.startMinutes < interval.end && end > interval.start)
      || overnight.some((interval) => end - TEMPLATE_DAY_MINUTES > interval.start)) {
      skipped.add(period.id);
    } else {
      available.push({ ...period, title: period.title.trim() || onEmptyTitle });
    }
  }

  return { available, skipped };
}

export function saveTemplatePeriods(periods: TemplatePeriod[], fallbackTitle: (position: number) => string) {
  return [...periods].sort((a, b) => a.startMinutes - b.startMinutes).map((period, index) => ({
    id: period.id,
    label: period.title.trim() || fallbackTitle(index + 1),
    start: minutesToTime(period.startMinutes),
    end: minutesToTime(templatePeriodEnd(period)),
  }));
}
