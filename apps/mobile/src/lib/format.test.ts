import { formatDuration, formatPrice, isValidFutureDate, stopsLabel } from './format';

describe('format', () => {
  it('formats durations, prices and stops', () => {
    expect(formatDuration(310)).toBe('5h 10m');
    expect(formatDuration(65)).toBe('1h 05m');
    expect(formatPrice(1240, 'USD')).toBe('$1,240');
    expect(formatPrice(540, 'ILS')).toBe('₪540');
    expect(stopsLabel(0)).toBe('Direct');
    expect(stopsLabel(2)).toBe('2 stops');
  });
  it('validates future ISO dates', () => {
    expect(isValidFutureDate('2099-01-01')).toBe(true);
    expect(isValidFutureDate('2001-01-01')).toBe(false);
    expect(isValidFutureDate('tomorrow')).toBe(false);
    expect(isValidFutureDate('2099-13-45')).toBe(false);
  });
});
