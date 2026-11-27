import type { Task, TimeEntry } from "../types";
import { engagementMinutes } from "../utils/engagement";

export type ReadingStatus = "to-read" | "reading" | "finished";
export type ReadingProgress =
  | { unit: "percent"; current: number }
  | { unit: "pages" | "chapters"; current: number; total?: number };
export interface ReadingBook {
  id: string; title: string; author: string; status: ReadingStatus;
  progress: ReadingProgress; createdAt: string; updatedAt: string;
}
export interface ReadingLibrary {
  version: 1;
  books: ReadingBook[];
  taskLinks: { taskId: string; bookId: string }[];
}
export const emptyReadingLibrary = (): ReadingLibrary => ({ version: 1, books: [], taskLinks: [] });

export function validateProgress(progress: ReadingProgress): ReadingProgress {
  const { unit, current } = progress;
  if (!Number.isFinite(current) || current < 0) throw new Error("Invalid reading progress");
  if (unit === "percent") {
    if (current > 100) throw new Error("Percent exceeds 100");
    return { unit, current };
  }
  if (unit !== "pages" && unit !== "chapters") throw new Error("Invalid progress unit");
  const { total } = progress;
  if (!Number.isSafeInteger(current) || (total !== undefined &&
    (!Number.isSafeInteger(total) || total <= 0 || current > total))) throw new Error("Invalid page or chapter count");
  return total === undefined ? { unit, current } : { unit, current, total };
}

export function createBook(library: ReadingLibrary, input: { id: string; title: string; author?: string; now: string }): ReadingLibrary {
  const id = input.id.trim(), title = input.title.trim();
  if (!id || !title || library.books.some(book => book.id === id)) throw new Error("Invalid or duplicate book");
  return { ...library, books: [...library.books, {
    id, title, author: input.author?.trim() ?? "", status: "to-read",
    progress: { unit: "percent", current: 0 }, createdAt: input.now, updatedAt: input.now,
  }] };
}

/** Reaching 100% and completing a reading task never implicitly mark a book finished. */
export function updateBook(library: ReadingLibrary, bookId: string, patch: {
  title?: string; author?: string; status?: ReadingStatus; progress?: ReadingProgress;
}, now: string): ReadingLibrary {
  if (!library.books.some(book => book.id === bookId)) throw new Error("Unknown book");
  const title = patch.title?.trim();
  if (title !== undefined && !title) throw new Error("Book title is required");
  if (patch.status !== undefined && !["to-read", "reading", "finished"].includes(patch.status)) throw new Error("Invalid reading status");
  const progress = patch.progress === undefined ? undefined : validateProgress(patch.progress);
  return { ...library, books: library.books.map(book => book.id !== bookId ? book : {
    ...book,
    ...(title !== undefined ? { title } : {}),
    ...(patch.author !== undefined ? { author: patch.author.trim() } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(progress !== undefined ? { progress } : {}),
    updatedAt: now,
  }) };
}

/** A task may have many schedule records but belongs to one book.
 * Retain links after task completion/deletion to attribute retained execution history.
 */
export function linkReadingTask(library: ReadingLibrary, bookId: string, taskId: string): ReadingLibrary {
  if (!taskId.trim() || !library.books.some(book => book.id === bookId)) throw new Error("Unknown book or task");
  const existing = library.taskLinks.find(link => link.taskId === taskId);
  if (existing?.bookId === bookId) return library;
  if (existing) throw new Error("Reading task already belongs to another book");
  return { ...library, taskLinks: [...library.taskLinks, { bookId, taskId }] };
}

export function groupReadingBooks(library: ReadingLibrary): Record<ReadingStatus, ReadingBook[]> {
  const groups: Record<ReadingStatus, ReadingBook[]> = { "to-read": [], reading: [], finished: [] };
  for (const book of library.books) groups[book.status].push(book);
  return groups;
}

/** Calendar wall-clock duration; never infer an overnight interval without an end date. */
function wallMinutes(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const ms = Date.parse(date + "T" + time + ":00Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 16) !== date + "T" + time) return NaN;
  return ms / 60_000;
}
export interface ReadingTotals {
  plannedMinutes: number; actualMinutes: number; weightedMinutes: number | null; sessions: number;
}

/** Read the existing schedule and timer ledgers; do not maintain a second time ledger. */
export function readingTotals(
  library: ReadingLibrary, bookId: string,
  tasks: readonly Task[], entries: readonly TimeEntry[], engagementEnabled = false,
): ReadingTotals {
  const taskIds = new Set(library.taskLinks.filter(link => link.bookId === bookId).map(link => link.taskId));
  const linkedTasks = tasks.filter(task => taskIds.has(task.id));
  const taskById = new Map(linkedTasks.map(task => [task.id, task]));
  const seenRecords = new Set<string>();
  let plannedMinutes = 0, actualMinutes = 0, weightedMinutes = 0, sessions = 0;
  for (const task of linkedTasks) for (const record of task.timelineRecords ?? []) {
    const key = JSON.stringify([task.id, record.id]);
    if (seenRecords.has(key) || record.taskId !== task.id || record.executionStatus === "cancelled" || record.executionStatus === "skipped") continue;
    const start = wallMinutes(record.scheduledDate, record.scheduledStart);
    const end = wallMinutes(record.scheduledEndDate || record.scheduledDate, record.scheduledEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    seenRecords.add(key);
    plannedMinutes += end - start;
  }
  const seenEntries = new Set<string>();
  for (const entry of entries) {
    if (!taskIds.has(entry.taskId) || !entry.id || seenEntries.has(entry.id) ||
      !Number.isFinite(entry.durationMinutes) || entry.durationMinutes <= 0) continue;
    seenEntries.add(entry.id);
    actualMinutes += entry.durationMinutes;
    sessions++;
    if (engagementEnabled) {
      const task = taskById.get(entry.taskId);
      const record = task?.timelineRecords?.find(item => item.id === entry.timelineRecordId && item.taskId === entry.taskId);
      const value = record ? record.engagement : task?.engagement;
      weightedMinutes += engagementMinutes(entry.durationMinutes, value);
    }
  }
  return { plannedMinutes, actualMinutes, weightedMinutes: engagementEnabled ? weightedMinutes : null, sessions };
}

/** Reject corrupted or unsupported persisted data, rather than overwriting it. */
export function decodeReadingLibrary(value: unknown): ReadingLibrary {
  if (value === null) return emptyReadingLibrary();
  if (typeof value !== "object" || !value || Array.isArray(value)) throw new Error("Invalid reading library");
  const library = value as ReadingLibrary;
  if (library.version !== 1 || !Array.isArray(library.books) || !Array.isArray(library.taskLinks)) throw new Error("Unsupported reading library");
  const ids = new Set<string>(), tasks = new Set<string>();
  for (const book of library.books) {
    if (!book || typeof book.id !== "string" || !book.id.trim() || ids.has(book.id) ||
      typeof book.title !== "string" || !book.title.trim() || typeof book.author !== "string" ||
      !["to-read", "reading", "finished"].includes(book.status) ||
      !book.progress || typeof book.createdAt !== "string" || typeof book.updatedAt !== "string") throw new Error("Invalid reading book");
    validateProgress(book.progress);
    ids.add(book.id);
  }
  for (const link of library.taskLinks) {
    if (!link || typeof link.taskId !== "string" || !link.taskId.trim() || tasks.has(link.taskId) || !ids.has(link.bookId)) throw new Error("Invalid reading task link");
    tasks.add(link.taskId);
  }
  return library;
}

/** Undo a book edit only if that exact saved state still exists.
 * Never remove a book with linked tasks or revert an unrelated book.
 */
export function undoReadingBookChange(library: ReadingLibrary, before: ReadingBook | undefined, after: ReadingBook): ReadingLibrary {
  const existing = library.books.find(book => book.id === after.id);
  if (!existing || JSON.stringify(existing) !== JSON.stringify(after)) throw new Error("Book has changed");
  if (before && before.id !== after.id) throw new Error("Book identity changed");
  if (!before && library.taskLinks.some(link => link.bookId === after.id)) throw new Error("Book has linked tasks");
  return { ...library, books: before
    ? library.books.map(book => book.id === after.id ? before : book)
    : library.books.filter(book => book.id !== after.id) };
}
