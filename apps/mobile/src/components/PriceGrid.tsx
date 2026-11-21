import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { formatPrice } from '../lib/format';

type Props = { prices: { date: string; price: number }[]; currency: string; onPick: (date: string) => void };

// A price per day, the lowest highlighted. Shared by the flight and stay calendars.
export const PriceGrid = ({ prices, currency, onPick }: Props) => {
  const { t } = useTranslation();
  const lowest = Math.min(...prices.map((p) => p.price));
  return (
    <View className="flex-row flex-wrap gap-2">
      {prices.map((p) => {
        const cheap = p.price === lowest;
        return (
          <Pressable
            key={p.date}
            accessibilityRole="button"
            accessibilityLabel={`${p.date}, ${formatPrice(p.price, currency)}${cheap ? `, ${t('flights.lowest')}` : ''}`}
            onPress={() => onPick(p.date)}
            className={`w-[23%] items-center rounded-card border py-2 ${cheap ? 'border-brand bg-brand-soft' : 'border-line bg-surface'}`}
          >
            <Text className="text-xs text-ink-muted">{p.date.slice(5)}</Text>
            <Text className={`text-base font-bold ${cheap ? 'text-brand-dark' : 'text-ink'}`}>{formatPrice(p.price, currency)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};
