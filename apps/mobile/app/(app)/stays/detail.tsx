import { StayDetailQuerySchema, type StayDetail } from '@wayfinder/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useFavorites, useStayDetail, useStayReviews, useToggleFavorite, type StayTrip } from '../../../src/features/stays/hooks';
import { formatPrice, nightsBetween } from '../../../src/lib/format';

export default function StayDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = StayDetailQuerySchema.safeParse(params);
  if (!parsed.success || !params.id) return <Screen title={t('stays.detailsTitle')}><Text className="text-danger">{t('stays.unavailable')}</Text></Screen>;
  const trip: StayTrip = { q: parsed.data.q, checkIn: parsed.data.checkIn, checkOut: parsed.data.checkOut, adults: parsed.data.adults };
  return <Detail id={params.id} trip={trip} onBack={() => router.back()} onCalendar={() => router.push({ pathname: '/stays/calendar', params: { id: params.id!, q: trip.q, checkIn: trip.checkIn, checkOut: trip.checkOut, adults: String(trip.adults) } })} />;
}

function Reviews({ id }: { id: string }) {
  const { t } = useTranslation();
  const reviews = useStayReviews(id);
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('stays.reviews')}</Text>
      {reviews.isPending ? <Text className="text-ink-muted">{t('common.loading')}</Text> : null}
      {reviews.data && reviews.data.pages.every((p) => p.reviews.length === 0) ? <Text className="text-ink-muted">{t('stays.noReviews')}</Text> : null}
      {reviews.data?.pages.flatMap((p) => p.reviews).map((r, i) => (
        <View key={`${r.author}-${i}`} className="gap-1 rounded-card border border-line p-3">
          <Text className="text-sm font-semibold text-ink">{r.author} · {r.source}{r.date ? ` · ${r.date}` : ''}</Text>
          <Text className="text-sm text-brand-dark">★ {r.rating.toFixed(1)}</Text>
          <Text className="text-sm text-ink">{r.text}</Text>
        </View>
      ))}
      {reviews.hasNextPage ? <Button label={t('stays.moreReviews')} variant="secondary" busy={reviews.isFetchingNextPage} onPress={() => void reviews.fetchNextPage()} /> : null}
    </View>
  );
}

function Body({ d, trip, onCalendar }: { d: StayDetail; trip: StayTrip; onCalendar: () => void }) {
  const { t } = useTranslation();
  const nights = nightsBetween(trip.checkIn, trip.checkOut);
  const maxCount = Math.max(1, ...d.ratingBreakdown.map((r) => r.count));
  return (
    <View className="gap-3">
      {d.rating !== null ? <Text className="text-base text-ink">★ {d.rating.toFixed(1)} · {t('stays.reviewCount', { count: d.reviewCount })}</Text> : null}
      {d.address ? <Text className="text-ink-muted">{d.address}</Text> : null}
      {d.checkInTime && d.checkOutTime ? <Text className="text-sm text-ink-muted">{t('stays.times', { in: d.checkInTime, out: d.checkOutTime })}</Text> : null}
      {d.deal ? <Text className="text-sm font-semibold text-brand-dark">{d.deal}</Text> : null}
      {d.typicalPriceRange ? <Text className="text-sm text-ink-muted">{t('stays.typical', { low: formatPrice(d.typicalPriceRange.low, d.currency), high: formatPrice(d.typicalPriceRange.high, d.currency) })}</Text> : null}
      {d.description ? <Text className="text-ink">{d.description}</Text> : null}

      <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('stays.prices')}</Text>
      {d.offers.map((o) => (
        <View key={o.provider} className="gap-2 rounded-card border border-line p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-ink">{o.provider}</Text>
            <Text className="text-base font-bold text-brand-dark">{t('stays.perNight', { price: formatPrice(o.pricePerNight, d.currency) })}</Text>
          </View>
          {o.official ? <Text className="text-xs text-ink-muted">{t('stays.official')}</Text> : null}
          {nights > 0 && o.totalPrice !== null ? <Text className="text-xs text-ink-muted">{t('stays.total', { price: formatPrice(o.totalPrice, d.currency) })} · {t('stays.nights', { count: nights })}</Text> : null}
          <Button label={`${t('stays.viewDeal')} · ${o.provider}`} variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(o.dealUrl)} />
        </View>
      ))}
      <Button label={t('stays.calendar')} variant="secondary" onPress={onCalendar} />

      {d.amenities.length ? (
        <View className="gap-2">
          <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('stays.amenities')}</Text>
          <Text className="text-ink">{d.amenities.join(' · ')}</Text>
        </View>
      ) : null}

      {d.ratingBreakdown.length ? (
        <View className="gap-1">
          <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('stays.ratings')}</Text>
          {d.ratingBreakdown.map((r) => (
            <View key={r.stars} className="flex-row items-center gap-2">
              <Text className="w-6 text-sm text-ink">{r.stars}★</Text>
              <View className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"><View style={{ width: `${(r.count / maxCount) * 100}%` }} className="h-2 bg-brand" /></View>
              <Text className="w-10 text-right text-xs text-ink-muted">{r.count}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {d.nearby.length ? (
        <View className="gap-1">
          <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('stays.nearby')}</Text>
          {d.nearby.map((n) => (
            <Text key={n.name} className="text-sm text-ink">{n.name}{n.transport[0] ? ` · ${n.transport[0].type} ${n.transport[0].duration}` : ''}</Text>
          ))}
        </View>
      ) : null}

      <Reviews id={d.id} />
    </View>
  );
}

function Detail({ id, trip, onBack, onCalendar }: { id: string; trip: StayTrip; onBack: () => void; onCalendar: () => void }) {
  const { t } = useTranslation();
  const result = useStayDetail(id, trip);
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const isFavorite = (favorites.data?.favorites ?? []).some((f) => f.id === id);
  return (
    <Screen title={result.data?.name ?? t('stays.detailsTitle')}>
      <View className="flex-row gap-2">
        <View className="flex-1"><Button label={t('stays.back')} variant="secondary" onPress={onBack} /></View>
        {result.data ? (
          <View className="flex-row items-center">
            <Button
              label={t(isFavorite ? 'stays.unsave' : 'stays.save', { name: result.data.name })}
              variant="secondary"
              onPress={() => {
                const d = result.data!;
                toggle.mutate({ stay: { id: d.id, name: d.name, thumbnail: d.images[0] ?? null, stars: d.stars, rating: d.rating, lat: d.lat, lng: d.lng }, on: !isFavorite });
              }}
            />
          </View>
        ) : null}
      </View>
      <QueryState query={result}>{(d) => <Body d={d} trip={trip} onCalendar={onCalendar} />}</QueryState>
    </Screen>
  );
}
