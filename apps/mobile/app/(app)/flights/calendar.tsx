import { FlightSearchQuerySchema } from '@wayfinder/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { Button } from '../../../src/components/Button';
import { PriceGrid } from '../../../src/components/PriceGrid';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useFlightCalendar } from '../../../src/features/travel/hooks';
import { arrow } from '../../../src/i18n';
import { addDays } from '../../../src/lib/format';

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
          return <PriceGrid prices={data.prices} currency={data.currency} onPick={onPick} />;
        }}
      </QueryState>
    </Screen>
  );
}
