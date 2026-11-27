import { describe, expect, it } from "vitest";
import { createBook, emptyReadingLibrary, linkReadingTask } from "./model";
import { groupReadingMetrics } from "./ReadingMetrics";
import type { MetricTaskEntry } from "../metrics/timeAllocation";
import type { buildInsights } from "../metrics/insightFacts";

describe("reading Metrics", () => {
  it("groups only linked tasks from filtered Metrics facts and deduplicates repeated entries", () => {
    const now = "2026-11-27T00:00:00Z";
    const library = linkReadingTask(createBook(emptyReadingLibrary(), { id: "book", title: "Book", now }), "book", "reading-task");
    const start = new Date(now), end = new Date(start.getTime() + 30 * 60000);
    const entry: MetricTaskEntry = {
      taskId: "reading-task", recordId: "record", title: "Reading", projectLabel: "", projectColor: "",
      durationMinutes: 30, scheduledStart: start, scheduledEnd: end, completed: true,
    };
    const tracked: ReturnType<typeof buildInsights>["trackedEntries"][number] = {
      id: "entry", taskId: "reading-task", projectId: "__unassigned__", start, end, minutes: 20, source: "timer",
    };
    const rows = groupReadingMetrics(library, { taskEntries: [entry, entry, { ...entry, taskId: "other" }] }, [tracked, tracked, { ...tracked, id: "other", taskId: "other" }]);
    expect(rows).toEqual([{ id: "book", title: "Book", planned: 30, tracked: 20 }]);
    expect(groupReadingMetrics(library, { taskEntries: [] }, [])).toEqual([]);
  });
});
