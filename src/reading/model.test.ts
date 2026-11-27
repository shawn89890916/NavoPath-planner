import { describe, expect, it } from "vitest";
import type { Task, TimeEntry } from "../types";
import { createBook, emptyReadingLibrary, groupReadingBooks, linkReadingTask, readingTotals, updateBook, validateProgress } from "./model";
const now = "2026-11-27T12:00:00Z";
const library = () => createBook(createBook(emptyReadingLibrary(), { id: "a", title: " First ", now }), { id: "b", title: "Second", now });
const task = (id: string, records: Task["timelineRecords"] = []): Task => ({
  id, title: "Read", dueDate: "", category: "personal", priority: null, notes: "", goalId: "",
  completed: false, createdAt: now, updatedAt: now, timelineRecords: records,
});
const entry = (id: string, taskId: string, durationMinutes: number, timelineRecordId?: string): TimeEntry => ({
  id, taskId, durationMinutes, timelineRecordId, startAt: now, endAt: "2026-11-27T13:00:00Z",
  source: "timer", createdAt: now, updatedAt: now,
});
const record = (id: string, taskId: string, status: NonNullable<Task["timelineRecords"]>[number]["executionStatus"] = "scheduled") => ({
  id, taskId, scheduledDate: "2026-11-27", scheduledStart: "20:00", scheduledEnd: "20:30",
  executionStatus: status, createdAt: now,
});
describe("reading library", () => {
  it("keeps book status and progress independent", () => {
    const initial = library();
    const reading = updateBook(initial, "a", { status: "reading", progress: { unit: "percent", current: 100 } }, now);
    expect(groupReadingBooks(reading).reading.map(book => book.id)).toEqual(["a"]);
    expect(groupReadingBooks(reading).finished).toEqual([]);
    expect(initial.books[0].progress.current).toBe(0);
    expect(updateBook(reading, "a", { status: "finished" }, now).books[0].status).toBe("finished");
  });
  it("normalizes titles and rejects duplicate identities", () => {
    expect(library().books[0].title).toBe("First");
    expect(() => createBook(library(), { id: "a", title: "Duplicate", now })).toThrow();
    expect(() => createBook(library(), { id: "c", title: " ", now })).toThrow();
    expect(() => updateBook(library(), "missing", { title: "New" }, now)).toThrow();
  });
  it("validates progress without silently clamping", () => {
    expect(validateProgress({ unit: "pages", current: 12, total: 100 })).toEqual({ unit: "pages", current: 12, total: 100 });
    expect(() => validateProgress({ unit: "percent", current: 101 })).toThrow();
    expect(() => validateProgress({ unit: "chapters", current: 1.5 })).toThrow();
    expect(() => validateProgress({ unit: "pages", current: 11, total: 10 })).toThrow();
    expect(() => validateProgress({ unit: "percent", current: NaN })).toThrow();
  });
  it("links multiple tasks to one book idempotently", () => {
    const one = linkReadingTask(library(), "a", "t1");
    expect(linkReadingTask(one, "a", "t1")).toBe(one);
    expect(linkReadingTask(one, "a", "t2").taskLinks).toHaveLength(2);
    expect(() => linkReadingTask(one, "b", "t1")).toThrow();
    expect(() => linkReadingTask(one, "missing", "t2")).toThrow();
  });
  it("separates planned, actual and weighted minutes and deduplicates records", () => {
    const linked = linkReadingTask(linkReadingTask(library(), "a", "t1"), "b", "t2");
    const r = { ...record("r1", "t1", "completed"), engagement: 50 };
    const t1 = task("t1", [r, r, record("r2", "t1"), record("r3", "t1", "cancelled")]);
    const e = entry("e1", "t1", 20, "r1");
    const entries = [e, e, entry("e2", "t1", 10), entry("e3", "t2", 100)];
    expect(readingTotals(linked, "a", [t1], entries, true)).toEqual({ plannedMinutes: 60, actualMinutes: 30, weightedMinutes: 18, sessions: 2 });
    expect(readingTotals(linked, "a", [t1], entries).weightedMinutes).toBeNull();
  });
  it("attributes retained actual history without a current task", () => {
    const linked = linkReadingTask(library(), "a", "t1");
    expect(readingTotals(linked, "a", [task("t1", [record("r", "t1")])], []).actualMinutes).toBe(0);
    expect(readingTotals(linked, "a", [], [entry("e", "t1", 15)]).actualMinutes).toBe(15);
  });
  it("handles midnight crossing and rejects invalid or skipped intervals", () => {
    const linked = linkReadingTask(library(), "a", "t1");
    const t = task("t1", [
      { ...record("night", "t1"), scheduledStart: "23:45", scheduledEndDate: "2026-11-28", scheduledEnd: "00:15" },
      { ...record("invalid", "t1"), scheduledStart: "25:00" },
      record("skip", "t1", "skipped"),
    ]);
    expect(readingTotals(linked, "a", [t], [entry("bad", "t1", -1)]))
      .toEqual({ plannedMinutes: 30, actualMinutes: 0, weightedMinutes: null, sessions: 0 });
  });
});
