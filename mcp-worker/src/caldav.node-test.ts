/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import type { CalendarEvent } from "../../src/types";
import { handleCalDav, type CalDavProfile } from "./caldav.ts";
import { readAppointment, writeAppointment } from "./caldavEvents.ts";

const user = "33b995cd-fb50-4536-8cd2-e5bde9cc261f";
const otherUser = "66b995cd-fb50-4536-8cd2-e5bde9cc261f";
const password = "nvd_" + "a".repeat(64);
const origin = "https://navopath.com";
const calendar = "/caldav/calendars/" + user + "/navopath/";
const item = calendar + "phone-event.ics";
const authorization = "Basic " + btoa(user + ":" + password);
const native: CalendarEvent = {
  id: "native", calendarKind: "appointment", fixedCourse: true,
  title: "Native event", details: "", date: "2026-11-06", startTime: "13:00", endTime: "14:00",
  category: "personal", createdAt: "2026-11-06T00:00:00Z",
};
const appleEvent = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Apple//iPhone//EN", "BEGIN:VEVENT",
  "UID:calendar-smoke", "DTSTAMP:20261106T010000Z", "DTSTART:20261106T070000Z", "DTEND:20261106T080000Z",
  "SUMMARY:Apple meeting", "DESCRIPTION:Notes", "LOCATION:Library",
  "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "END:VALARM",
  "END:VEVENT", "END:VCALENDAR", "",
].join("\r\n");

function fixture() {
  let profile: CalDavProfile = { data: { events: [native, { ...native, id: "course", calendarKind: undefined }] }, settings: {}, revision: 4 };
  let conflict = false;
  const store: Parameters<typeof handleCalDav>[1] = {
    async authenticate(username, secret) {
      return username === user && secret === password ? { userId: user, timezone: "Asia/Shanghai" } : null;
    },
    async load(userId) {
      assert.equal(userId, user);
      return profile;
    },
    async save(userId, expected, data) {
      assert.equal(userId, user);
      if (conflict) {
        conflict = false;
        profile = { ...profile, revision: profile.revision + 1, data: { ...profile.data, savedAt: "2026-11-06T03:00:00Z" } };
        return false;
      }
      assert.equal(expected.revision, profile.revision);
      profile = { ...profile, data, revision: profile.revision + 1 };
      return true;
    },
  };
  return {
    request(method: string, path: string, body?: string, headers?: Record<string, string>) {
      return handleCalDav(new Request(origin + path, {
        method, body, headers: { authorization, ...headers },
      }), store);
    },
    conflictNextSave() { conflict = true; },
    get profile() { return profile; },
  };
}

test("discovers a private CalDAV calendar and lists only appointments", async () => {
  const api = fixture();
  const options = await api.request("OPTIONS", "/caldav/", undefined, { authorization: "" });
  assert.match(options.headers.get("DAV") || "", /calendar-access/);
  const challenge = await api.request("PROPFIND", "/caldav/", undefined, { authorization: "" });
  assert.equal(challenge.status, 401);
  assert.match(challenge.headers.get("WWW-Authenticate") || "", /^Basic/);
  const root = await api.request("PROPFIND", "/caldav/", '<x:propfind xmlns:x="DAV:"><x:prop><x:current-user-principal/></x:prop></x:propfind>');
  assert.equal(root.status, 207);
  assert.match(await root.text(), new RegExp("/caldav/principals/" + user + "/"));
  const principal = await api.request("PROPFIND", "/caldav/principals/" + user + "/");
  assert.match(await principal.text(), /calendar-home-set/);
  const home = await api.request("PROPFIND", "/caldav/calendars/" + user + "/", undefined, { Depth: "1" });
  assert.match(await home.text(), /<c:calendar\/>/);
  const query = await api.request("PROPFIND", calendar, undefined, { Depth: "1" });
  const xml = await query.text();
  assert.match(xml, /event-native\.ics/);
  assert.doesNotMatch(xml, /event-course\.ics/);
  const crossAccount = await api.request("GET", calendar.replace(user, otherUser) + "event-native.ics");
  assert.equal(crossAccount.status, 404);
});

test("creates, retrieves, revises and deletes appointments using ETags and tombstones", async () => {
  const api = fixture();
  api.conflictNextSave();
  const created = await api.request("PUT", item, appleEvent, { "If-None-Match": "*" });
  assert.equal(created.status, 201);
  const etag = created.headers.get("ETag")!;
  const stored = api.profile.data.tasks!.at(-1)!;
  assert.equal(stored.timelineRecords?.[0].scheduledStart, "15:00");
  assert.equal(stored.timelineRecords?.[0].scheduledEnd, "16:00");
  assert.equal(stored.caldav?.uid, "calendar-smoke");
  assert.equal(stored.fixedCourse, undefined);
  assert.equal((await api.request("PUT", item, appleEvent, { "If-None-Match": "*" })).status, 412);
  assert.equal((await api.request("PUT", calendar + "duplicate.ics", appleEvent)).status, 403);
  assert.equal((await api.request("GET", item, undefined, { "If-None-Match": etag })).status, 304);
  const report = await api.request("REPORT", calendar, '<c:calendar-multiget xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:prop><d:getetag/><c:calendar-data/></d:prop><d:href>' + item + '</d:href><d:href>' + calendar + 'missing.ics</d:href></c:calendar-multiget>');
  assert.equal(report.status, 207);
  assert.match(await report.text(), /SUMMARY:Apple meeting[\s\S]+404 Not Found/);
  const revised = await api.request("PUT", item, appleEvent.replace("Apple meeting", "Revised meeting"), { "If-Match": etag });
  assert.equal(revised.status, 204);
  assert.equal((await api.request("DELETE", item, undefined, { "If-Match": etag })).status, 412);
  assert.equal((await api.request("DELETE", item, undefined, { "If-Match": revised.headers.get("ETag")! })).status, 204);
  assert.ok(api.profile.data.sync?.deleted?.["tasks:" + stored.id]);
  assert.equal((await api.request("GET", item)).status, 404);
});

test("round-trips all-day events and preserves Apple details after a native title edit", () => {
  const parsed = readAppointment(appleEvent, "Asia/Shanghai");
  const existing: CalendarEvent = {
    ...native, ...parsed.fields, title: "Renamed locally",
    caldav: { file: "phone-event.ics", uid: parsed.uid, ics: appleEvent, projection: parsed.projection },
  };
  const encoded = writeAppointment(existing, "Asia/Shanghai");
  assert.match(encoded, /SUMMARY:Renamed locally/);
  assert.match(encoded, /DTSTART:20261106T070000Z/);
  assert.match(encoded, /LOCATION:Library/);
  assert.match(encoded, /BEGIN:VALARM/);
  const allDay = writeAppointment({ ...native, startTime: undefined, endTime: undefined, endDate: "2026-11-08" }, "Asia/Shanghai");
  assert.match(allDay, /DTEND;VALUE=DATE:20261109/);
  assert.equal(readAppointment(allDay, "Asia/Shanghai").fields.endDate, "2026-11-08");
});

test("handles time range discovery and rejects unsupported input without mutating the workspace", async () => {
  const api = fixture();
  const report = await api.request("REPORT", calendar, '<c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:prop><d:getetag/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="20261106T050000Z" end="20261106T060000Z"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>');
  assert.equal(report.status, 207);
  assert.match(await report.text(), /event-native\.ics/);
  const dtd = await api.request("PROPFIND", calendar, '<!DOCTYPE d:propfind SYSTEM "https://example.invalid/"><d:propfind xmlns:d="DAV:"/>');
  assert.equal(dtd.status, 400);
  const unsupported = await api.request("PUT", item, appleEvent.replace("LOCATION:Library", "RRULE:FREQ=YEARLY"));
  assert.equal(unsupported.status, 403);
  assert.equal(api.profile.revision, 4);
});
