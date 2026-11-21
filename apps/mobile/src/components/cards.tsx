import type { Attraction, FlightOffer, Stay } from '@wayfinder/shared';
import { Pressable, Text, View } from 'react-native';
import { formatDuration, formatPrice, stopsLabel } from '../lib/format';

const card = 'rounded-card border border-line bg-surface';
const timeOf = (s: string) => s.slice(-5);

export const FlightCard = ({ offer, onPress }: { offer: FlightOffer; onPress: () => void }) => {
  const first = offer.legs[0];
  const last = offer.legs[offer.legs.length - 1];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${offer.airline}, ${timeOf(first.departTime)} to ${timeOf(last.arriveTime)}, ${stopsLabel(offer.stops)}, ${formatPrice(offer.price, offer.currency)}`}
      onPress={onPress}
      className={`${card} gap-3 p-4`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-ink-muted">{offer.airline} · {stopsLabel(offer.stops)}</Text>
        {offer.group === 'best' ? (
          <View className="rounded-full bg-brand-soft px-2 py-0.5"><Text className="text-xs font-semibold text-brand-dark">Best</Text></View>
        ) : null}
      </View>
      <View className="flex-row items-center gap-3">
        <View>
          <Text className="text-2xl font-bold text-ink">{timeOf(first.departTime)}</Text>
          <Text className="text-sm text-ink-muted">{first.fromCode}</Text>
        </View>
        <View className="flex-1 items-center gap-1">
          <Text className="text-xs text-ink-muted">{formatDuration(offer.totalDurationMin)}</Text>
          <View className="h-px w-full bg-line" />
        </View>
        <View className="items-end">
          <Text className="text-2xl font-bold text-ink">{timeOf(last.arriveTime)}</Text>
          <Text className="text-sm text-ink-muted">{last.toCode}</Text>
        </View>
      </View>
      <View className="flex-row items-end justify-between">
        <Text className="text-2xl font-bold text-brand-dark">{formatPrice(offer.price, offer.currency)}</Text>
        <Text className="text-xs text-ink-muted">one way</Text>
      </View>
    </Pressable>
  );
};

export const StayCard = ({ stay, selected, onPress }: { stay: Stay; selected?: boolean; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected: !!selected }}
    accessibilityLabel={`${stay.name}, ${formatPrice(stay.pricePerNight, stay.currency)} per night`}
    onPress={onPress}
    className={`flex-row gap-3 rounded-card border bg-surface p-3 ${selected ? 'border-brand' : 'border-line'}`}
  >
    <View className="h-24 w-24 items-center justify-center rounded-card bg-brand-soft"><Text className="text-3xl">🛏</Text></View>
    <View className="flex-1 gap-1">
      <Text className="text-base font-semibold text-ink">{stay.name}</Text>
      <Text className="text-sm text-ink">★ {stay.rating} · {stay.ratingLabel}</Text>
      <Text className="text-sm text-ink-muted">{stay.distance}</Text>
      <Text className="text-base font-bold text-brand-dark">{formatPrice(stay.pricePerNight, stay.currency)} / night</Text>
    </View>
  </Pressable>
);

export const AttractionCard = ({ item }: { item: Attraction }) => (
  <View className={`${card} overflow-hidden`} accessibilityLabel={item.name}>
    <View className="h-32 items-center justify-center bg-brand-soft"><Text className="text-4xl">🧭</Text></View>
    <View className="gap-1 p-3">
      <Text className="text-lg font-semibold text-ink">{item.name}</Text>
      <Text className="text-sm text-ink-muted">{item.category} · ★ {item.rating} ({item.reviews})</Text>
      <Text className="text-sm text-ink">{item.blurb}</Text>
      <Text className="text-xs text-ink-muted">{item.hours}</Text>
    </View>
  </View>
);

export const ItineraryItem = ({ time, title, meta }: { time: string; title: string; meta: string }) => (
  <View className="flex-row gap-3">
    <Text className="w-12 pt-3 text-sm font-semibold text-brand">{time}</Text>
    <View className="flex-1 gap-0.5 rounded-card bg-surface-muted p-3">
      <Text className="text-base font-semibold text-ink">{title}</Text>
      <Text className="text-sm text-ink-muted">{meta}</Text>
    </View>
  </View>
);
