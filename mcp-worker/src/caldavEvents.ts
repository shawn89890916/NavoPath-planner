import ICAL from "ical.js";
import type { CalendarEvent, RecurrenceFrequency, TaskRecurrence } from "../../src/types";

type Time = InstanceType<typeof ICAL.Time>;
type Component = InstanceType<typeof ICAL.Component>;
type EventFields = Pick<CalendarEvent, "title" | "details" | "date" | "startDate" | "endDate" | "startTime" | "endTime" | "recurrence">;

const RULES: Partial<Record<RecurrenceFrequency, string>> = {
  daily: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  weekends: "FREQ=WEEKLY;BYDAY=SA,SU",
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
  quarterly: "FREQ=MONTHLY;INTERVAL=3",
};
const DAY = 86_400_000;

function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * DAY).toISOString().slice(0, 10);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function localParts(milliseconds: number, timezone: string) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    formatters.set(timezone, formatter);
  }
  return formatter.format(milliseconds).replace(" ", "T");
}

function wallTime(value: Time, timezone: string) {
  return value.isDate || value.zone === ICAL.Timezone.localTimezone
    ? value.toString()
    : localParts(value.toUnixTime() * 1000, timezone);
}

function localEpoch(value: string, timezone: string) {
  const requested = Date.parse(value + "Z");
  let result = requested;
  for (let i = 0; i < 3; i++) {
    const actual = Date.parse(localParts(result, timezone) + "Z");
    if (actual === requested) break;
    result += requested - actual;
  }
  return result;
}

function project(event: EventFields) {
  return JSON.stringify([
    event.title, event.details || "", event.startDate || event.date,
    event.endDate || event.startDate || event.date, event.startTime || "", event.endTime || "",
    event.recurrence?.frequency || "none", event.recurrence?.endDate || "", event.recurrence?.count || 0,
  ]);
}

export function eventUid(event: CalendarEvent) {
  return event.caldav?.uid || "event-" + event.id + "@navopath.app";
}

export function eventFile(event: CalendarEvent) {
  return event.caldav?.file || "event-" + event.id.replace(/[^a-zA-Z0-9_-]/g, character =>
    "_" + character.charCodeAt(0).toString(16) + "_") + ".ics";
}

function recurrenceFromIcs(component: Component, start: Time, date: string, endDate: string, startTime: string | undefined, endTime: string | undefined, timezone: string): TaskRecurrence | undefined {
  if (["exdate", "rdate", "exrule", "recurrence-id"].some(name => component.hasProperty(name)) ||
    component.getAllProperties("rrule").length > 1) throw new Error("Unsupported recurrence exceptions");
  const rule = component.getFirstPropertyValue("rrule");
  if (!(rule instanceof ICAL.Recur)) return;
  const parts = rule.parts;
  const days = (parts.BYDAY || []).slice().sort().join(",");
  if (Object.keys(parts).some(key => !["BYDAY", "BYMONTHDAY", "BYSETPOS"].includes(key)) || (rule.count && rule.until)) throw new Error("Unsupported recurrence pattern");
  const interval = rule.interval || 1;
  let frequency: RecurrenceFrequency | undefined;
  const monthDays = (parts.BYMONTHDAY || []).map(Number);
  const positions = (parts.BYSETPOS || []).map(Number);
  const hasMonthFilter = monthDays.length > 0 || positions.length > 0;
  if (rule.freq === "DAILY" && interval === 1 && !days && !hasMonthFilter) frequency = "daily";
  if (rule.freq === "WEEKLY" && !hasMonthFilter) {
    if (interval === 1 && days === "FR,MO,TH,TU,WE") frequency = "weekdays";
    else if (interval === 1 && days === "SA,SU") frequency = "weekends";
    else if (!days || days === ICAL.Recur.numericDayToIcalDay(start.dayOfWeek())) {
      frequency = interval === 1 ? "weekly" : interval === 2 ? "biweekly" : undefined;
    }
  }
  if (rule.freq === "MONTHLY" && !days) {
    const simple = start.day <= 28 && !positions.length && (!monthDays.length || (monthDays.length === 1 && monthDays[0] === start.day));
    const clamped = start.day > 28 && monthDays.length === 2 && monthDays.includes(start.day) && monthDays.includes(-1) && positions.join() === "1";
    if (simple || clamped) frequency = interval === 1 ? "monthly" : interval === 3 ? "quarterly" : undefined;
  }
  if (!frequency || (start.isDate && endDate !== date)) throw new Error("Unsupported recurrence pattern");
  return {
    mode: "scheduled",
    frequency,
    startDate: date,
    startTime,
    durationMinutes: startTime && endTime
      ? (Date.parse(endDate + "T" + endTime + "Z") - Date.parse(date + "T" + startTime + "Z")) / 60_000
      : undefined,
    endDate: rule.until ? wallTime(rule.until, timezone).slice(0, 10) : undefined,
    count: rule.count || undefined,
  };
}

export function readAppointment(ics: string, timezone: string) {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(ics)) throw new Error("Invalid calendar text");
  const calendar = new ICAL.Component(ICAL.parse(ics));
  const items = calendar.getAllSubcomponents("vevent");
  if (calendar.name !== "vcalendar" || calendar.hasProperty("method") ||
    items.length !== 1 || calendar.getAllSubcomponents().some(item => !["vevent", "vtimezone"].includes(item.name))) {
    throw new Error("Expected a single calendar event");
  }
  const component = items[0];
  const event = new ICAL.Event(component);
  const { startDate: start, endDate: end, uid } = event;
  if (!uid || uid.length > 512 || !(start instanceof ICAL.Time) || !(end instanceof ICAL.Time) ||
    start.isDate !== end.isDate || component.hasProperty("organizer") || component.hasProperty("attendee")) {
    throw new Error("Unsupported calendar event");
  }
  for (const property of ["dtstart", "dtend"]) {
    const source = component.getFirstProperty(property) || component.getFirstProperty("dtstart");
    const tzid = source?.getParameter("tzid");
    const value = property === "dtstart" ? start : end;
    if (tzid && value.zone === ICAL.Timezone.localTimezone) {
      const utc = ICAL.Time.fromJSDate(new Date(localEpoch(value.toString(), String(tzid))), true);
      if (property === "dtstart") start.resetTo(utc.year, utc.month, utc.day, utc.hour, utc.minute, utc.second, utc.zone);
      else end.resetTo(utc.year, utc.month, utc.day, utc.hour, utc.minute, utc.second, utc.zone);
    }
  }
  const first = wallTime(start, timezone);
  const last = wallTime(end, timezone);
  const date = first.slice(0, 10);
  const startTime = start.isDate ? undefined : first.slice(11, 16);
  const endTime = end.isDate ? undefined : last.slice(11, 16);
  const endDate = start.isDate ? shiftDate(last.slice(0, 10), -1) : last.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || endDate < date ||
    (!start.isDate && (last <= first || (date === endDate && endTime === startTime)))) {
    throw new Error("Invalid calendar event dates");
  }
  const fields: EventFields = {
    title: event.summary || "Untitled event",
    details: event.description || "",
    date, startDate: date, endDate, startTime, endTime,
    recurrence: recurrenceFromIcs(component, start, date, endDate, startTime, endTime, timezone),
  };
  return { uid, fields, projection: project(fields) };
}

function timedRange(event: CalendarEvent, start: string, end: string) {
  if (!event.startTime) return null;
  const first = start + "T" + event.startTime + ":00";
  if (!event.endTime) {
    return [first, new Date(Date.parse(first + "Z") + 3_600_000).toISOString().slice(0, 19)];
  }
  const endDate = start === end && event.endTime <= event.startTime ? shiftDate(end, 1) : end;
  return [first, endDate + "T" + event.endTime + ":00"];
}

function setEventDates(component: Component, event: CalendarEvent, timezone: string) {
  const start = event.startDate || event.date;
  const end = event.endDate || start;
  const rule = event.recurrence && RULES[event.recurrence.frequency];
  component.removeAllProperties("dtstart");
  component.removeAllProperties("dtend");
  component.removeAllProperties("duration");
  const range = timedRange(event, start, end);
  if (range) {
    const timed = (wall: string) => rule
      ? ICAL.Time.fromDateTimeString(wall)
      : ICAL.Time.fromJSDate(new Date(localEpoch(wall, timezone)), true);
    component.addPropertyWithValue("dtstart", timed(range[0]));
    component.addPropertyWithValue("dtend", timed(range[1]));
  } else {
    component.addPropertyWithValue("dtstart", ICAL.Time.fromDateString(start));
    component.addPropertyWithValue("dtend", ICAL.Time.fromDateString(shiftDate(end, 1)));
  }
  component.removeAllProperties("rrule");
  if (rule) {
    const day = Number(start.slice(8, 10));
    const clamp = rule.startsWith("FREQ=MONTHLY") && day > 28 ? ";BYMONTHDAY=" + day + ",-1;BYSETPOS=1" : "";
    const recurrence = ICAL.Recur.fromString(rule + clamp);
    if (event.recurrence?.count) recurrence.count = event.recurrence.count;
    if (event.recurrence?.endDate && !recurrence.count) {
      const date = event.recurrence.endDate;
      recurrence.until = event.startTime
        ? ICAL.Time.fromDateTimeString(date + "T23:59:59")
        : ICAL.Time.fromDateString(date);
    }
    component.addPropertyWithValue("rrule", recurrence);
  }
}

export function writeAppointment(event: CalendarEvent, timezone: string) {
  if (event.caldav?.projection === project(event)) return event.caldav.ics;
  const calendar = event.caldav ? new ICAL.Component(ICAL.parse(event.caldav.ics)) : new ICAL.Component("vcalendar");
  let component = calendar.getFirstSubcomponent("vevent");
  if (!component) {
    calendar.addPropertyWithValue("version", "2.0");
    calendar.addPropertyWithValue("prodid", "-//NavoPath//CalDAV//EN");
    component = new ICAL.Component("vevent");
    component.addPropertyWithValue("uid", eventUid(event));
    calendar.addSubcomponent(component);
  }
  component.updatePropertyWithValue("summary", event.title);
  component.updatePropertyWithValue("description", event.details || "");
  const stamp = new Date(event.updatedAt || event.createdAt);
  component.updatePropertyWithValue("dtstamp", ICAL.Time.fromJSDate(Number.isNaN(stamp.getTime()) ? new Date(0) : stamp, true));
  const previousFields = event.caldav?.projection ? JSON.parse(event.caldav.projection) as unknown[] : [];
  const currentFields = JSON.parse(project(event)) as unknown[];
  if (currentFields.slice(2).some((value, index) => value !== previousFields[index + 2])) {
    setEventDates(component, event, timezone);
  }
  return calendar.toString() + "\r\n";
}

export function appointmentOverlaps(event: CalendarEvent, start: number, end: number, timezone: string) {
  const first = event.startDate || event.date;
  const last = event.endDate || first;
  const range = timedRange(event, first, last);
  const from = localEpoch(range?.[0] || first + "T00:00:00", timezone);
  const to = localEpoch(range?.[1] || shiftDate(last, 1) + "T00:00:00", timezone);
  if (from >= end) return false;
  if (to > start) return true;
  if (!event.recurrence || event.recurrence.frequency === "none") return false;
  if (!event.recurrence.endDate) return true;
  const finalDay = localEpoch(shiftDate(event.recurrence.endDate, 1) + "T00:00:00", timezone);
  return finalDay + Math.max(0, to - from) > start;
}
