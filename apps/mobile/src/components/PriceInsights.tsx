import type { FlightInsights } from '@wayfinder/shared';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { sparklinePoints } from '../features/travel/sparkline';
import i18n from '../i18n';
import { formatPrice } from '../lib/format';

type Props = { insights: FlightInsights; currency: string; asOf: string };

const W = 280;
const H = 48;

export const PriceInsights = ({ insights, currency, asOf }: Props) => {
  const { t } = useTranslation();
  const prices = insights.history.map((h) => h.price);
  const asOfText = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(asOf));
  return (
    <View className="gap-2 rounded-card bg-brand-soft p-3" accessibilityLabel={t('flights.insightLabel')}>
      <Text className="text-sm text-ink">
        {t('flights.insight', { level: t(`flights.level.${insights.level}`), price: formatPrice(insights.lowestPrice, currency) })}
      </Text>
      {insights.typicalRange ? (
        <Text className="text-sm text-ink-muted">
          {t('flights.typicalRange', { low: formatPrice(insights.typicalRange.low, currency), high: formatPrice(insights.typicalRange.high, currency) })}
        </Text>
      ) : null}
      {prices.length > 1 ? (
        <View accessibilityLabel={t('flights.priceHistory', { days: prices.length, min: formatPrice(Math.min(...prices), currency), max: formatPrice(Math.max(...prices), currency) })}>
          <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <Polyline points={sparklinePoints(prices, W, H - 4)} fill="none" stroke="#0B6BCB" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" transform="translate(0 2)" />
          </Svg>
        </View>
      ) : null}
      <Text className="text-xs text-ink-muted">{t('flights.asOf', { time: asOfText })}</Text>
    </View>
  );
};
