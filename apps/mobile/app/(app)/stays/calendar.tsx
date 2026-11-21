import { StayDetailQuerySchema } from '@wayfinder/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { Button } from '../../../src/components/Button';
import { PriceGrid } from '../../../src/components/PriceGrid';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useStayCalendar } from '../../../src/features/stays/hooks';
import { addDays, nightsBetween } from '../../../src/lib/format';

const WINDOW_DAYS = 30;

export default function StayCalendar() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = StayDetailQuerySchema.safeParse(params);
  if (!parsed.success || !params.id) return <Screen title={t('stays.calendarTitle')}><Text className="text-danger">{t('stays.unavailable')}</Text></Screen>;
  const { q, checkIn, checkOut, adults } = parsed.data;
  return <Calendar id={params.id} start={checkIn} adults={adults} nights={nightsBetween(checkIn, checkOut)} q={q} onBack={() => router.back()} onPick={(date, nights) => router.replace({ pathname: '/stays/detail', params: { id: params.id!, q, checkIn: date, checkOut: addDays(date, nights), adults: String(adults) } })} />;
}

function Calendar({ id, start, adults, nights, q, onBack, onPick }: { id: string; start: string; adults: number; nights: number; q: string; onBack: () => void; onPick: (date: string, nights: number) => void }) {
  const { t } = useTranslation();
  const result = useStayCalendar(id, { start, end: addDays(start, WINDOW_DAYS), adults });
  return (
    <Screen title={q} subtitle={t('stays.calendarHint')}>
      <Button label={t('stays.back')} variant="secondary" onPress={onBack} />
      <QueryState query={result}>
        {(data) =>
          data.prices.length === 0 ? (
            <Text className="py-4 text-ink-muted">{t('stays.none')}</Text>
          ) : (
            <PriceGrid prices={data.prices.map((p) => ({ date: p.date, price: p.pricePerNight }))} currency={data.currency} onPick={(date) => onPick(date, Math.max(1, nights))} />
          )
        }
      </QueryState>
    </Screen>
  );
}
