import { monthGrid } from './calendar';

describe('monthGrid', () => {
  it('builds six weeks of seven days, starting on the chosen weekday', () => {
    // 1 March 2027 is a Monday.
    const sunday = monthGrid(2027, 2, 0);
    expect(sunday).toHaveLength(6);
    expect(sunday.every((w) => w.length === 7)).toBe(true);
    expect(sunday[0]![0]!.iso).toBe('2027-02-28');
    expect(sunday[0]![1]!.iso).toBe('2027-03-01');

    const monday = monthGrid(2027, 2, 1);
    expect(monday[0]![0]!.iso).toBe('2027-03-01');
  });

  it('marks exactly the days of the month as in-month, each once, in order', () => {
    const days = monthGrid(2027, 2, 0).flat();
    const inMonth = days.filter((d) => d.inMonth).map((d) => d.iso);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0]).toBe('2027-03-01');
    expect(inMonth.at(-1)).toBe('2027-03-31');
    expect(new Set(days.map((d) => d.iso)).size).toBe(42);
  });

  it('handles February in a leap year and a December to January boundary', () => {
    expect(monthGrid(2028, 1, 0).flat().filter((d) => d.inMonth)).toHaveLength(29);
    const dec = monthGrid(2027, 11, 0).flat();
    expect(dec.filter((d) => d.inMonth)).toHaveLength(31);
    expect(dec.some((d) => d.iso.startsWith('2028-01'))).toBe(true);
  });
});
