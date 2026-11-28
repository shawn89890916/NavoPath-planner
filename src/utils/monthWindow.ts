const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date);
}

export function startOfCalendarWeek(value: string, weekStartsOn: 0 | 1 = 0) {
  const date = new Date(`${value}T00:00:00`);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - offset);
  return iso(date);
}

export function buildWeekWindow(anchor: string, before = 16, after = 24, weekStartsOn: 0 | 1 = 0) {
  const first = addIsoDays(startOfCalendarWeek(anchor, weekStartsOn), -before * 7);
  return Array.from({ length: before + after + 1 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addIsoDays(first, week * 7 + day)),
  );
}

export function layoutMonthWeeks(weeks: string[][], taskCount: (date: string) => number, compact: boolean) {
  let totalHeight = 0;
  const rows = weeks.map((dates, index) => {
    const height = 72 + Math.max(1, ...dates.map(taskCount)) * (compact ? 50 : 46);
    const row = { dates, index, top: totalHeight, height };
    totalHeight += height;
    return row;
  });
  return { rows, totalHeight };
}

type MonthWeekRow = ReturnType<typeof layoutMonthWeeks>["rows"][number];

export function monthWeekAtOffset(rows: MonthWeekRow[], offset: number) {
  // Rows are contiguous and sorted by top. Preserve boundary/clamping
  // semantics while making repeated scroll probes logarithmic.
  let low = 0, high = rows.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const { top, height } = rows[middle];
    if (top + height > offset) high = middle;
    else low = middle + 1;
  }
  return Math.min(low, rows.length - 1);
}

export function visibleMonthWeekRange(rows: MonthWeekRow[], scrollTop: number, viewportHeight: number) {
  const overscan = 256;
  return {
    first: Math.max(0, monthWeekAtOffset(rows, scrollTop - overscan)),
    last: monthWeekAtOffset(rows, scrollTop + viewportHeight + overscan),
  };
}

export function monthScrollTopForDate(rows: MonthWeekRow[], date: string, viewportOffset: number) {
  const row = rows.find(({ dates }) => dates.includes(date));
  return row ? Math.max(0, row.top - viewportOffset) : undefined;
}
