import i18n from '../i18n';

export const formatDuration = (min: number): string => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;

const SYMBOL: Record<string, string> = { USD: '$', ILS: '₪', EUR: '€', GBP: '£' };
export const formatPrice = (amount: number, currency: string): string =>
  `${SYMBOL[currency] ?? `${currency} `}${amount.toLocaleString('en-US')}`;

export const stopsLabel = (stops: number): string => (stops === 0 ? i18n.t('flights.direct') : i18n.t('flights.stops', { count: stops }));

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
export const defaultTripDate = (): string => isoDate(new Date(Date.now() + 30 * 86_400_000));
export const isValidFutureDate = (s: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && s >= isoDate(new Date());

/** Adds (or subtracts) days from a YYYY-MM-DD date, in UTC so DST never shifts the result. */
export const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
};
