import { FlightSearchQuerySchema } from '@wayfinder/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useFlightCalendar } from '../../../src/features/travel/hooks';
import { arrow } from '../../../src/i18n';
import { addDays, formatPrice } from '../../../src/lib/format';

const WINDOW_DAYS = 30;

export default function FlightCalendar() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = FlightSearchQuerySchema.safeParse(params);
  if (!parsed.success) return <Screen title={t('flights.calendarTitle')}><Text className="text-danger">{t('flights.invalidSearch')}</Text></Screen>;
  const q = parsed.data;

  const pick = (date: string) => {
    // Keep the trip length when a return date is set.
    const shift = (Date.parse(date) - Date.parse(q.date)) / 86_400_000;
    router.replace({
      pathname: '/flights/results',
      params: { from: q.from, to: q.to, date, ...(q.returnDate ? { returnDate: addDays(q.returnDate, shift) } : {}), adults: String(q.adults), cabin: q.cabin },
    });
  };
  return <Calendar from={q.from} to={q.to} start={q.date} onPick={pick} onBack={() => router.back()} />;
}

function Calendar({ from, to, start, onPick, onBack }: { from: string; to: string; start: string; onPick: (d: string) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const result = useFlightCalendar({ from, to, start, end: addDays(start, WINDOW_DAYS) });
  return (
    <Screen title={`${from} ${arrow()} ${to}`} subtitle={t('flights.calendarHint')}>
      <Button label={t('flights.backToResults')} variant="secondary" onPress={onBack} />
      <QueryState query={result}>
        {(data) => {
          if (data.prices.length === 0) return <Text className="py-4 text-ink-muted">{t('flights.none')}</Text>;
          const lowest = Math.min(...data.prices.map((p) => p.price));
          return (
            <View className="flex-row flex-wrap gap-2">
              {data.prices.map((p) => {
                const cheap = p.price === lowest;
                return (
                  <Pressable
                    key={p.date}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.date}, ${formatPrice(p.price, data.currency)}${cheap ? `, ${t('flights.lowest')}` : ''}`}
                    onPress={() => onPick(p.date)}
                    className={`w-[23%] items-center rounded-card border py-2 ${cheap ? 'border-brand bg-brand-soft' : 'border-line bg-surface'}`}
                  >
                    <Text className="text-xs text-ink-muted">{p.date.slice(5)}</Text>
                    <Text className={`text-base font-bold ${cheap ? 'text-brand-dark' : 'text-ink'}`}>{formatPrice(p.price, data.currency)}</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}
