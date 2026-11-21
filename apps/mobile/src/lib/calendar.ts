export type CalendarDay = { iso: string; inMonth: boolean };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Six weeks covering a month, as ISO dates, starting on `weekStart` (0 = Sunday, 1 = Monday). UTC throughout. */
export const monthGrid = (year: number, month0: number, weekStart: 0 | 1 = 0): CalendarDay[][] => {
  const first = new Date(Date.UTC(year, month0, 1));
  const offset = (first.getUTCDay() - weekStart + 7) % 7;
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(Date.UTC(year, month0, 1 - offset + w * 7 + d));
      week.push({ iso: iso(day), inMonth: day.getUTCMonth() === month0 });
    }
    weeks.push(week);
  }
  return weeks;
};
