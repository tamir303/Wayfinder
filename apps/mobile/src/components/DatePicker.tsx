import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import i18n, { isRtl } from '../i18n';
import { monthGrid } from '../lib/calendar';

type Props = {
  label: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (iso: string) => void;
  /** Days before this (YYYY-MM-DD) are disabled. */
  minDate?: string;
  /** Days after this are disabled. */
  maxDate?: string;
  testID: string;
};

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(i18n.language, { ...opts, timeZone: 'UTC' });

// A small month calendar that opens under the field. Works the same on iOS, Android and web.
export const DatePicker = ({ label, value, onChange, minDate, maxDate, testID }: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const [month, setMonth] = useState(Number(value.slice(5, 7)) - 1);

  const shift = (by: number) => {
    const d = new Date(Date.UTC(year, month + by, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  };
  const rtl = isRtl();
  const weekStart = i18n.language === 'he' ? 0 : 1; // Israel's week starts on Sunday; ISO weeks on Monday
  const grid = monthGrid(year, month, weekStart as 0 | 1);
  const weekdayFmt = fmt({ weekday: 'narrow' });
  const headers = grid[0]!.map((d) => weekdayFmt.format(new Date(`${d.iso}T00:00:00Z`)));
  const disabled = (d: string) => (minDate !== undefined && d < minDate) || (maxDate !== undefined && d > maxDate);

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-ink-muted">{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          if (!open) {
            setYear(Number(value.slice(0, 4)));
            setMonth(Number(value.slice(5, 7)) - 1);
          }
          setOpen(!open);
        }}
        className="rounded-card border border-line bg-surface px-gutter py-3"
      >
        <Text className="text-base text-ink">{value}</Text>
      </Pressable>
      {open ? (
        <View className="gap-2 rounded-card border border-line bg-surface p-3">
          <View className="flex-row items-center justify-between">
            <Pressable testID={`${testID}-prev`} accessibilityRole="button" accessibilityLabel={t('common.prevMonth')} onPress={() => shift(-1)} className="h-9 w-9 items-center justify-center"><Text className="text-xl text-brand">{rtl ? '›' : '‹'}</Text></Pressable>
            <Text accessibilityRole="header" className="text-base font-semibold text-ink">{fmt({ month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month, 1)))}</Text>
            <Pressable testID={`${testID}-next`} accessibilityRole="button" accessibilityLabel={t('common.nextMonth')} onPress={() => shift(1)} className="h-9 w-9 items-center justify-center"><Text className="text-xl text-brand">{rtl ? '‹' : '›'}</Text></Pressable>
          </View>
          <View className="flex-row">
            {headers.map((h, i) => (
              <Text key={i} className="flex-1 text-center text-xs text-ink-muted">{h}</Text>
            ))}
          </View>
          {grid.map((week, wi) => (
            <View key={wi} className="flex-row">
              {week.map((d) => {
                const off = disabled(d.iso);
                const on = d.iso === value;
                return (
                  <Pressable
                    key={d.iso}
                    testID={`${testID}-day-${d.iso}`}
                    accessibilityRole="button"
                    accessibilityLabel={fmt({ dateStyle: 'full' }).format(new Date(`${d.iso}T00:00:00Z`))}
                    accessibilityState={{ disabled: off, selected: on }}
                    disabled={off}
                    onPress={() => {
                      onChange(d.iso);
                      setOpen(false);
                    }}
                    className={`m-0.5 h-9 flex-1 items-center justify-center rounded-full ${on ? 'bg-brand' : ''}`}
                  >
                    <Text className={`text-sm ${on ? 'font-bold text-white' : off ? 'text-line' : d.inMonth ? 'text-ink' : 'text-ink-muted'}`}>{Number(d.iso.slice(8))}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};
