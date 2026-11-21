import { FlightSearchQuerySchema } from '@wayfinder/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { FlightCard } from '../../../src/components/cards';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { Button } from '../../../src/components/Button';
import { useFlightSearch } from '../../../src/features/travel/hooks';
import { formatPrice } from '../../../src/lib/format';

export default function FlightResults() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = FlightSearchQuerySchema.safeParse(params);
  if (!parsed.success) {
    return (
      <Screen title="Flights">
        <Text className="text-danger">That search is not valid.</Text>
        <Button label="Back to search" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  return <Results query={parsed.data} />;
}

function Results({ query }: { query: ReturnType<typeof FlightSearchQuerySchema.parse> }) {
  const router = useRouter();
  const result = useFlightSearch(query);
  const open = (id: string) => router.push({ pathname: '/flights/detail', params: { ...query, adults: String(query.adults), id } });
  return (
    <Screen title={`${query.from} → ${query.to}`} subtitle={`${query.date} · ${query.adults} adult${query.adults > 1 ? 's' : ''} · ${query.cabin}`}>
      <Button label="Change search" variant="secondary" onPress={() => router.replace('/')} />
      <QueryState query={result}>
        {(data) => {
          if (data.offers.length === 0) return <Text className="py-4 text-ink-muted">No flights found for this search.</Text>;
          const best = data.offers.filter((o) => o.group === 'best');
          const other = data.offers.filter((o) => o.group === 'other');
          return (
            <View className="gap-3">
              {data.insights ? (
                <View className="rounded-card bg-brand-soft p-3" accessibilityLabel="Price insight">
                  <Text className="text-sm text-ink">Prices are <Text className="font-bold">{data.insights.level}</Text> for this route. Lowest: {formatPrice(data.insights.lowestPrice, data.offers[0].currency)}</Text>
                </View>
              ) : null}
              <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">Best flights</Text>
              {best.map((o) => <FlightCard key={o.id} offer={o} onPress={() => open(o.id)} />)}
              {other.length ? <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">Other flights</Text> : null}
              {other.map((o) => <FlightCard key={o.id} offer={o} onPress={() => open(o.id)} />)}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}
