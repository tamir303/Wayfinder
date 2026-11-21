import type { Attraction, FlightOffer, Stay } from '@wayfinder/shared';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { formatDuration, formatPrice, stopsLabel } from '../lib/format';

const card = 'rounded-card border border-line bg-surface';
const timeOf = (s: string) => s.slice(-5);

export const FlightCard = ({ offer, onPress, roundTrip = false }: { offer: FlightOffer; onPress: () => void; roundTrip?: boolean }) => {
  const { t } = useTranslation();
  const first = offer.legs[0];
  const last = offer.legs[offer.legs.length - 1];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('flights.cardLabel', { airline: offer.airline, depart: timeOf(first.departTime), arrive: timeOf(last.arriveTime), stops: stopsLabel(offer.stops), price: formatPrice(offer.price, offer.currency) })}
      onPress={onPress}
      className={`${card} gap-3 p-4`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-ink-muted">{offer.airline} · {stopsLabel(offer.stops)}</Text>
        {offer.group === 'best' ? (
          <View className="rounded-full bg-brand-soft px-2 py-0.5"><Text className="text-xs font-semibold text-brand-dark">{t('flights.bestBadge')}</Text></View>
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
        <Text className="text-xs text-ink-muted">{roundTrip ? t('flights.roundTripTotal') : t('flights.oneWay')}</Text>
      </View>
    </Pressable>
  );
};

type StayCardProps = {
  stay: Stay;
  selected?: boolean;
  onPress: () => void;
  nights?: number;
  favorite?: boolean;
  onToggleFavorite?: () => void;
};

// The card body and the save button are siblings: nested buttons are invalid on the web.
export const StayCard = ({ stay, selected, onPress, nights = 0, favorite = false, onToggleFavorite }: StayCardProps) => {
  const { t } = useTranslation();
  return (
    <View className={`flex-row rounded-card border bg-surface ${selected ? 'border-brand' : 'border-line'}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        accessibilityLabel={t('stays.cardLabel', { name: stay.name, price: formatPrice(stay.pricePerNight, stay.currency) })}
        onPress={onPress}
        className="flex-1 flex-row gap-3 p-3"
      >
        <View className="h-24 w-24 items-center justify-center rounded-card bg-brand-soft"><Icon name="bed" size={32} color="#0B6BCB" /></View>
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-ink">{stay.name}</Text>
          {stay.rating !== null ? (
            <View className="flex-row items-center gap-1">
              <Icon name="star" size={14} color="#0B6BCB" filled />
              <Text className="text-sm text-ink">{t('stays.ratingLine', { rating: stay.rating.toFixed(1), count: stay.reviewCount })}</Text>
            </View>
          ) : null}
          {stay.distance ? <Text className="text-sm text-ink-muted">{stay.distance}</Text> : null}
          <Text className="text-base font-bold text-brand-dark">{t('stays.perNight', { price: formatPrice(stay.pricePerNight, stay.currency) })}</Text>
          {nights > 0 ? <Text className="text-xs text-ink-muted">{t('stays.total', { price: formatPrice(stay.totalPrice ?? stay.pricePerNight * nights, stay.currency) })} · {t('stays.nights', { count: nights })}</Text> : null}
        </View>
      </Pressable>
      {onToggleFavorite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: favorite }}
          accessibilityLabel={t(favorite ? 'stays.unsave' : 'stays.save', { name: stay.name })}
          onPress={onToggleFavorite}
          className="p-3"
        >
          <Icon name="heart" size={22} color="#0B6BCB" filled={favorite} />
        </Pressable>
      ) : null}
    </View>
  );
};

export const AttractionCard = ({ item }: { item: Attraction }) => (
  <View className={`${card} overflow-hidden`} accessibilityLabel={item.name}>
    <View className="h-32 items-center justify-center bg-brand-soft"><Icon name="compass" size={40} color="#0B6BCB" /></View>
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
