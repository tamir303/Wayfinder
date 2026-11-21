import type { FlightOffer, FlightSearchResponse } from '@wayfinder/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { FlightCard } from '../../components/cards';
import { FlightViewBar } from '../../components/FlightViewBar';
import { PriceInsights } from '../../components/PriceInsights';
import { airlinesOf, applyFlightView, type FlightViewOptions } from './flight-view';

type Props = {
  data: FlightSearchResponse;
  roundTrip: boolean;
  onSelect: (offer: FlightOffer) => void;
};

// Shared by the results and return-flight screens: price insight, sort/filter bar, best vs other groups.
export const FlightList = ({ data, roundTrip, onSelect }: Props) => {
  const { t } = useTranslation();
  const [view, setView] = useState<FlightViewOptions>({ sort: 'best', directOnly: false, airlines: [] });

  if (data.offers.length === 0) return <Text className="py-4 text-ink-muted">{t('flights.none')}</Text>;

  const airlines = [...new Set(data.offers.flatMap(airlinesOf))].sort();
  const shown = applyFlightView(data.offers, view);
  const grouped = view.sort === 'best';
  const best = grouped ? shown.filter((o) => o.group === 'best') : [];
  const other = grouped ? shown.filter((o) => o.group !== 'best') : shown;
  const card = (o: FlightOffer) => <FlightCard key={o.id} offer={o} roundTrip={roundTrip} onPress={() => onSelect(o)} />;

  return (
    <View className="gap-3">
      {data.insights ? <PriceInsights insights={data.insights} currency={data.offers[0]!.currency} asOf={data.asOf} /> : null}
      <FlightViewBar value={view} onChange={setView} airlines={airlines} />
      {shown.length === 0 ? <Text className="py-2 text-ink-muted">{t('flights.noMatch')}</Text> : null}
      {best.length ? <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('flights.best')}</Text> : null}
      {best.map(card)}
      {grouped && other.length ? <Text accessibilityRole="header" className="pt-2 text-lg font-semibold text-ink">{t('flights.other')}</Text> : null}
      {other.map(card)}
    </View>
  );
};
