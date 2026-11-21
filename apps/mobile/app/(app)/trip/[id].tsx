import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { Chip } from '../../../src/components/Chip';
import { Screen } from '../../../src/components/Screen';
import { estimate, itemsOfDay, moveItem, removeItem, setItemDay, type LocalTrip, type TripItem } from '../../../src/features/trips/model';
import { tripActions, useTripStore } from '../../../src/features/trips/store';
import { formatPrice } from '../../../src/lib/format';

const Small = ({ label, text, onPress }: { label: string; text: string; onPress: () => void }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="rounded-full border border-line px-2.5 py-1">
    <Text className="text-xs font-medium text-ink">{text}</Text>
  </Pressable>
);

function Row({ trip, item, first, last }: { trip: LocalTrip; item: TripItem; first: boolean; last: boolean }) {
  const { t } = useTranslation();
  const edit = (fn: (x: LocalTrip) => LocalTrip) => tripActions.update(trip.id, fn);
  const days = Array.from({ length: trip.dayCount }, (_, i) => i).filter((d) => d !== item.day);
  return (
    <View className="gap-2 rounded-card bg-surface-muted p-3">
      <Text className="text-xs font-semibold text-brand">{t(`trips.kinds.${item.kind}`)}</Text>
      <Text className="text-base font-semibold text-ink">{item.title}</Text>
      {item.meta ? <Text className="text-sm text-ink-muted">{item.meta}</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        {item.day !== null && !first ? <Small label={t('trips.up', { title: item.title })} text="↑" onPress={() => edit((x) => moveItem(x, item.id, 'up'))} /> : null}
        {item.day !== null && !last ? <Small label={t('trips.down', { title: item.title })} text="↓" onPress={() => edit((x) => moveItem(x, item.id, 'down'))} /> : null}
        {days.map((d) => (
          <Small key={d} label={t('trips.moveTo', { title: item.title, day: t('trips.day', { n: d + 1 }) })} text={t('trips.day', { n: d + 1 })} onPress={() => edit((x) => setItemDay(x, item.id, d))} />
        ))}
        <Small label={t('trips.remove', { title: item.title })} text="✕" onPress={() => edit((x) => removeItem(x, item.id))} />
      </View>
    </View>
  );
}

export default function TripDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, ready } = useTripStore();
  const [day, setDay] = useState<number | null>(0);
  const trip = trips.find((x) => x.id === id);
  if (!ready) return <Screen title={t('trips.overview')}><Text className="text-ink-muted">{t('common.loading')}</Text></Screen>;
  if (!trip) return <Screen title={t('trips.overview')}><Button label={t('trips.back')} variant="secondary" onPress={() => router.replace('/trips')} /><Text className="text-ink-muted">{t('trips.notFound')}</Text></Screen>;

  const shown = itemsOfDay(trip, day);
  const unscheduled = itemsOfDay(trip, null).length;
  const totals = estimate(trip);
  return (
    <Screen title={trip.name}>
      <Button label={t('trips.back')} variant="secondary" onPress={() => router.replace('/trips')} />
      <Text className="text-ink-muted">{t('trips.meta', { days: trip.dayCount, count: trip.items.length })}</Text>
      {totals.length ? (
        <View className="gap-0.5 rounded-card border border-line p-3">
          <Text className="text-sm font-semibold text-ink">{t('trips.estimate')}</Text>
          {totals.map((x) => <Text key={x.currency} className="text-lg font-bold text-brand-dark">{formatPrice(x.total, x.currency)}</Text>)}
          <Text className="text-xs text-ink-muted">{t('trips.estimateNote')}</Text>
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {Array.from({ length: trip.dayCount }, (_, i) => <Chip key={i} label={t('trips.day', { n: i + 1 })} selected={day === i} onPress={() => setDay(i)} />)}
        <Chip label={`${t('trips.unscheduled')} (${unscheduled})`} selected={day === null} onPress={() => setDay(null)} />
      </View>
      {shown.length === 0 ? <Text className="py-3 text-ink-muted">{t('trips.empty')}</Text> : null}
      {shown.map((item, i) => <Row key={item.id} trip={trip} item={item} first={i === 0} last={i === shown.length - 1} />)}
      <Button label={t('trips.deleteTrip')} variant="secondary" onPress={() => { tripActions.remove(trip.id); router.replace('/trips'); }} />
    </Screen>
  );
}
