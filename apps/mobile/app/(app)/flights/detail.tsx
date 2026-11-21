import { FlightSearchQuerySchema, type FlightOffer } from '@wayfinder/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useFlightOffers } from '../../../src/features/travel/hooks';
import { arrow } from '../../../src/i18n';
import { formatDuration, formatPrice, stopsLabel } from '../../../src/lib/format';

type Query = ReturnType<typeof FlightSearchQuerySchema.parse>;

export default function FlightDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = FlightSearchQuerySchema.safeParse(params);
  if (!parsed.success) return <Screen title={t('flights.detailsTitle')}><Text className="text-danger">{t('flights.unavailable')}</Text></Screen>;
  return <Detail query={parsed.data} id={params.id} token={params.token} onBack={() => router.back()} />;
}

const emissionsLine = (t: ReturnType<typeof useTranslation>['t'], e: NonNullable<FlightOffer['emissions']>) => {
  const kg = Math.round(e.grams / 1000);
  const pct = Math.abs(e.diffPercent);
  if (e.diffPercent < 0) return t('flights.emissionsBelow', { kg, pct });
  if (e.diffPercent > 0) return t('flights.emissionsAbove', { kg, pct });
  return t('flights.emissionsTypical', { kg });
};

function Detail({ query, id, token, onBack }: { query: Query; id?: string | undefined; token?: string | undefined; onBack: () => void }) {
  const { t } = useTranslation();
  const result = useFlightOffers(token ? { ...query, token } : query);
  const roundTrip = !!query.returnDate;
  return (
    <Screen title={t('flights.detailsTitle')}>
      <Button label={t('flights.backToResults')} variant="secondary" onPress={onBack} />
      <QueryState query={result}>
        {(data) => {
          const offer = data.offers.find((o) => o.id === id);
          if (!offer) return <Text className="text-ink-muted">{t('flights.unavailable')}</Text>;
          return (
            <View className="gap-3">
              <Text className="text-3xl font-bold text-brand-dark">{formatPrice(offer.price, offer.currency)}</Text>
              {roundTrip ? <Text className="text-xs text-ink-muted">{t('flights.roundTripTotal')}</Text> : null}
              <Text className="text-ink-muted">{offer.airline} · {stopsLabel(offer.stops)} · {formatDuration(offer.totalDurationMin)}</Text>
              {offer.legs.map((leg, i) => (
                <View key={leg.flightNumber}>
                  <View className="gap-1 rounded-card border border-line p-4">
                    <Text className="text-base font-semibold text-ink">{leg.fromCode} {arrow()} {leg.toCode}</Text>
                    <Text className="text-ink">{leg.departTime} {arrow()} {leg.arriveTime.slice(-5)}</Text>
                    <Text className="text-sm text-ink-muted">{leg.airline} {leg.flightNumber} · {formatDuration(leg.durationMin)}</Text>
                  </View>
                  {offer.layovers[i] ? (
                    <Text className="px-2 py-2 text-sm text-ink-muted">{t('flights.layover', { duration: formatDuration(offer.layovers[i]!.durationMin), place: `${offer.layovers[i]!.name} (${offer.layovers[i]!.code})` })}</Text>
                  ) : null}
                </View>
              ))}
              {offer.emissions ? <Text accessibilityLabel="Emissions" className="text-sm text-ink-muted">{emissionsLine(t, offer.emissions)}</Text> : null}
              {offer.handoffUrl ? (
                <Button label={t('flights.continueProvider')} onPress={() => void WebBrowser.openBrowserAsync(offer.handoffUrl as string)} />
              ) : null}
              <Text className="text-xs text-ink-muted">{t('flights.noPayments')}</Text>
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}
