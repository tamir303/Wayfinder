import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { addItem, type TripItem, type TripItemKind } from '../../src/features/trips/model';
import { NewTripForm } from '../../src/features/trips/NewTripForm';
import { tripActions, useTripStore } from '../../src/features/trips/store';

const KINDS: TripItemKind[] = ['flight', 'stay', 'attraction'];

// Reached from the flight, stay and attraction pages: the item arrives as route params.
export default function AddToTrip() {
  const { t } = useTranslation();
  const router = useRouter();
  const p = useLocalSearchParams<Record<string, string>>();
  const { trips } = useTripStore();
  const kind = KINDS.find((k) => k === p.kind);
  if (!kind || !p.id || !p.title) return <Screen title={t('trips.addTitle')}><Text className="text-danger">{t('trips.notFound')}</Text></Screen>;
  const price = p.price === undefined ? NaN : Number(p.price);
  const item: TripItem = { id: `${kind}:${p.id}`, kind, title: p.title, meta: p.meta ?? '', day: null, ...(Number.isFinite(price) && p.currency ? { price, currency: p.currency } : {}) };
  const finish = (tripId: string) => router.replace({ pathname: '/trip/[id]', params: { id: tripId } });
  return (
    <Screen title={t('trips.addTitle')} subtitle={item.title}>
      <Button label={t('attraction.back')} variant="secondary" onPress={() => router.back()} />
      <View className="gap-2">
        {trips.map((trip) => (
          <Button key={trip.id} label={t('trips.addTo', { title: item.title, trip: trip.name })} onPress={() => { tripActions.update(trip.id, (x) => addItem(x, item)); finish(trip.id); }} />
        ))}
      </View>
      <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('trips.newTrip')}</Text>
      <NewTripForm onCreate={(name, days) => { const trip = tripActions.create(name, days); tripActions.update(trip.id, (x) => addItem(x, item)); finish(trip.id); }} />
    </Screen>
  );
}
