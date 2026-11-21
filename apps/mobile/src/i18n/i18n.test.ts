import i18n, { arrow, isRtlLanguage } from './index';
import { en } from './en';
import { he } from './he';

const keys = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe('i18n', () => {
  it('Hebrew has exactly the same keys as English', () => {
    expect(keys(he).sort()).toEqual(keys(en).sort());
  });
  it('resolves plurals and interpolation', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('flights.stops', { count: 1 })).toBe('1 stop');
    expect(i18n.t('flights.stops', { count: 3 })).toBe('3 stops');
    expect(i18n.t('profile.usage', { used: 12, cap: 200 })).toBe('12 of 200 used today');
    await i18n.changeLanguage('he');
    expect(i18n.t('flights.stops', { count: 3 })).toBe('3 עצירות');
    await i18n.changeLanguage('en');
  });
  it('knows which languages are RTL and mirrors the arrow', async () => {
    expect(isRtlLanguage('he')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
    await i18n.changeLanguage('en');
    expect(arrow()).toBe('→');
    await i18n.changeLanguage('he');
    expect(arrow()).toBe('←');
    await i18n.changeLanguage('en');
  });
});
