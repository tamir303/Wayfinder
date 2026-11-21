import { FlightSearchQuerySchema } from '@wayfinder/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { QueryState } from '../../../src/components/QueryState';
import { FlightListSkeleton } from '../../../src/components/Skeleton';
import { Screen } from '../../../src/components/Screen';
import { FlightList } from '../../../src/features/travel/FlightList';
import { sameSearch, useDeleteSavedSearch, useSavedSearches, useSaveSearch } from '../../../src/features/flights/saved';
import { useFlightOffers } from '../../../src/features/travel/hooks';
import { arrow } from '../../../src/i18n';

type Query = ReturnType<typeof FlightSearchQuerySchema.parse>;

export default function FlightResults() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = FlightSearchQuerySchema.safeParse(params);
  if (!parsed.success) {
    return (
      <Screen title={t('flights.title')}>
        <Text className="text-danger">{t('flights.invalidSearch')}</Text>
        <Button label={t('flights.backToSearch')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  return <Results query={parsed.data} />;
}

const toParams = (q: Query, extra: Record<string, string> = {}): Record<string, string> => ({
  from: q.from,
  to: q.to,
  date: q.date,
  ...(q.returnDate ? { returnDate: q.returnDate } : {}),
  adults: String(q.adults),
  cabin: q.cabin,
  ...extra,
});

function Results({ query }: { query: Query }) {
  const { t } = useTranslation();
  const router = useRouter();
  const result = useFlightOffers(query);
  const saved = useSavedSearches();
  const save = useSaveSearch();
  const remove = useDeleteSavedSearch();
  const existing = (saved.data?.searches ?? []).find((s) => sameSearch(s, query));
  const roundTrip = !!query.returnDate;
  const cabin = t(`flights.cabin.${query.cabin}`);
  const subtitle = t('flights.summary', { date: roundTrip ? `${query.date} – ${query.returnDate}` : query.date, count: query.adults, cabin });

  return (
    <Screen title={`${query.from} ${arrow()} ${query.to}`} subtitle={subtitle}>
      <View className="flex-row gap-2">
        <View className="flex-1"><Button label={t('flights.changeSearch')} variant="secondary" onPress={() => router.replace('/')} /></View>
        <View className="flex-1"><Button label={t('flights.flexible')} variant="secondary" onPress={() => router.push({ pathname: '/flights/calendar', params: toParams(query) })} /></View>
      </View>
      {roundTrip ? null : (
        <Button
          label={existing ? t('flights.unsaveSearch') : t('flights.saveSearch')}
          variant="secondary"
          busy={save.isPending || remove.isPending}
          onPress={() => (existing ? remove.mutate(existing.id) : save.mutate({ from: query.from, to: query.to, date: query.date, adults: query.adults, cabin: query.cabin }))}
        />
      )}
      {roundTrip ? <Text accessibilityRole="header" className="text-base font-semibold text-ink">{t('flights.chooseOutbound')}</Text> : null}
      <QueryState query={result} skeleton={<FlightListSkeleton />}>
        {(data) => (
          <FlightList
            data={data}
            roundTrip={roundTrip}
            onSelect={(o) =>
              roundTrip
                ? router.push({ pathname: '/flights/return', params: toParams(query, { token: o.returnToken ?? '' }) })
                : router.push({ pathname: '/flights/detail', params: toParams(query, { id: o.id }) })
            }
          />
        )}
      </QueryState>
    </Screen>
  );
}
