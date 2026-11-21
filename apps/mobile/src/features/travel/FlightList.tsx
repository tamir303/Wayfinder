import type { FlightOffer, FlightSearchResponse } from '@wayfinder/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { FlightCard } from '../../components/cards';
import { FlightViewBar } from '../../components/FlightViewBar';
import { formatPrice } from '../../lib/format';
import { applyFlightView, type FlightViewOptions } from './flight-view';

type Props = {
  data: FlightSearchResponse;
  roundTrip: boolean;
  onSelect: (offer: FlightOffer) => void;
};

// Shared by the results and return-flight screens: price insight, sort/filter bar, best vs other groups.
export const FlightList = ({ data, roundTrip, onSelect }: Props) => {
  const { t } = useTranslation();
  const [view, setView] = useState<FlightViewOptions>({ sort: 'best', directOnly: false });

  if (data.offers.length === 0) return <Text className="py-4 text-ink-muted">{t('flights.none')}</Text>;

  const shown = applyFlightView(data.offers, view);
  const grouped = view.sort === 'best';
  const best = grouped ? shown.filter((o) => o.group === 'best') : [];
  const other = grouped ? shown.filter((o) => o.group !== 'best') : shown;
  const card = (o: FlightOffer) => <FlightCard key={o.id} offer={o} roundTrip={roundTrip} onPress={() => onSelect(o)} />;

  return (
    <View className="gap-3">
      {data.insights ? (
        <View className="rounded-card bg-brand-soft p-3" accessibilityLabel={t('flights.insightLabel')}>
          <Text className="text-sm text-ink">
            {t('flights.insight', { level: t(`flights.level.${data.insights.level}`), price: formatPrice(data.insights.lowestPrice, data.offers[0]!.currency) })}
          </Text>
        </View>
      ) : null}
      <FlightViewBar value={view} onChange={setView} />
      {shown.length === 0 ? <Text className="py-2 text-ink-muted">{t('flights.noMatch')}</Text> : null}
      {best.length ? <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('flights.best')}</Text> : null}
      {best.map(card)}
      {grouped && other.length ? <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('flights.other')}</Text> : null}
      {other.map(card)}
    </View>
  );
};
