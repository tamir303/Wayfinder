import { FlightReturnQuerySchema } from '@wayfinder/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { Button } from '../../../src/components/Button';
import { QueryState } from '../../../src/components/QueryState';
import { FlightListSkeleton } from '../../../src/components/Skeleton';
import { Screen } from '../../../src/components/Screen';
import { FlightList } from '../../../src/features/travel/FlightList';
import { useFlightOffers } from '../../../src/features/travel/hooks';
import { arrow } from '../../../src/i18n';

type Query = ReturnType<typeof FlightReturnQuerySchema.parse>;

export default function ReturnFlights() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = FlightReturnQuerySchema.safeParse(params);
  if (!parsed.success) {
    return (
      <Screen title={t('flights.returnTitle')}>
        <Text className="text-danger">{t('flights.invalidSearch')}</Text>
        <Button label={t('flights.backToSearch')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  return <Return query={parsed.data} />;
}

function Return({ query }: { query: Query }) {
  const { t } = useTranslation();
  const router = useRouter();
  const result = useFlightOffers(query);
  const { token, ...trip } = query;
  return (
    <Screen
      title={`${query.to} ${arrow()} ${query.from}`}
      subtitle={t('flights.summary', { date: query.returnDate, count: query.adults, cabin: t(`flights.cabin.${query.cabin}`) })}
    >
      <Button label={t('flights.backToResults')} variant="secondary" onPress={() => router.back()} />
      <Text accessibilityRole="header" className="text-base font-semibold text-ink">{t('flights.chooseReturn')}</Text>
      <QueryState query={result} skeleton={<FlightListSkeleton />}>
        {(data) => (
          <FlightList
            data={data}
            roundTrip
            onSelect={(o) =>
              router.push({
                pathname: '/flights/detail',
                params: { from: trip.from, to: trip.to, date: trip.date, returnDate: trip.returnDate, adults: String(trip.adults), cabin: trip.cabin, token, id: o.id },
              })
            }
          />
        )}
      </QueryState>
    </Screen>
  );
}
