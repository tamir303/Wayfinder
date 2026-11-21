import { FlightSearchQuerySchema } from '@wayfinder/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useFlightSearch } from '../../../src/features/travel/hooks';
import { arrow } from '../../../src/i18n';
import { formatDuration, formatPrice, stopsLabel } from '../../../src/lib/format';

export default function FlightDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const parsed = FlightSearchQuerySchema.safeParse(params);
  if (!parsed.success) return <Screen title={t('flights.detailsTitle')}><Text className="text-danger">{t('flights.unavailable')}</Text></Screen>;
  return <Detail query={parsed.data} id={params.id} onBack={() => router.back()} />;
}

function Detail({ query, id, onBack }: { query: ReturnType<typeof FlightSearchQuerySchema.parse>; id?: string; onBack: () => void }) {
  const { t } = useTranslation();
  const result = useFlightSearch(query);
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
              <Text className="text-ink-muted">{offer.airline} · {stopsLabel(offer.stops)} · {formatDuration(offer.totalDurationMin)}</Text>
              {offer.legs.map((leg) => (
                <View key={leg.flightNumber} className="gap-1 rounded-card border border-line p-4">
                  <Text className="text-base font-semibold text-ink">{leg.fromCode} {arrow()} {leg.toCode}</Text>
                  <Text className="text-ink">{leg.departTime} {arrow()} {leg.arriveTime.slice(-5)}</Text>
                  <Text className="text-sm text-ink-muted">{leg.airline} {leg.flightNumber} · {formatDuration(leg.durationMin)}</Text>
                </View>
              ))}
              {offer.handoffUrl ? <Button label={t('flights.continueProvider')} onPress={() => void Linking.openURL(offer.handoffUrl as string)} /> : null}
              <Text className="text-xs text-ink-muted">{t('flights.noPayments')}</Text>
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}
