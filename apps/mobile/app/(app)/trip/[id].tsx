import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { ItineraryItem } from '../../../src/components/cards';
import { Chip } from '../../../src/components/Chip';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useTrips } from '../../../src/features/travel/hooks';

export default function TripDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useTrips();
  const [day, setDay] = useState(0);
  return (
    <Screen title="Itinerary">
      <Button label="Back to trips" variant="secondary" onPress={() => router.replace('/trips')} />
      <QueryState query={result}>
        {({ trips }) => {
          const trip = trips.find((t) => t.id === id);
          if (!trip) return <Text className="text-ink-muted">Trip not found.</Text>;
          const current = trip.days[Math.min(day, trip.days.length - 1)];
          return (
            <View className="gap-3">
              <Text className="text-xl font-semibold text-ink">{trip.name}</Text>
              <Text className="text-ink-muted">{trip.dates}</Text>
              <View className="flex-row flex-wrap gap-2">
                {trip.days.map((d, i) => <Chip key={d.label} label={d.label} selected={i === day} onPress={() => setDay(i)} />)}
              </View>
              {current.stops.length === 0 ? <Text className="py-3 text-ink-muted">Nothing planned for this day yet.</Text> : null}
              {current.stops.map((s) => <ItineraryItem key={s.time + s.title} {...s} />)}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}
