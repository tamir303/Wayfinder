import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { formatPrice } from '../../lib/format';
import { projectPins } from './map';
import type { StaysMapProps } from './StaysMap.types';

// Used until a tile provider is configured, on native until the MapLibre dev client is verified, and as a
// fallback if the real map cannot start. Pins are projected from the stays' real coordinates.
export const StaysMapPlaceholder = ({ stays, selectedId, onSelect }: Omit<StaysMapProps, 'styleUrl'>) => {
  const { t } = useTranslation();
  const pins = Object.fromEntries(projectPins(stays).map((p) => [p.id, p]));
  return (
    <View accessibilityLabel={t('stays.map')} className="relative h-56 overflow-hidden rounded-card bg-brand-soft">
      <View className="absolute left-[10%] top-0 h-full w-1 bg-surface" />
      <View className="absolute left-[55%] top-0 h-full w-2 bg-surface" />
      <View className="absolute left-0 top-[45%] h-2 w-full bg-surface" />
      {stays.map((s) => {
        const on = s.id === selectedId;
        const pin = pins[s.id]!;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={t('stays.pin', { name: s.name, price: formatPrice(s.pricePerNight, s.currency) })}
            onPress={() => onSelect(s)}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            className={`absolute rounded-full border px-2.5 py-1 ${on ? 'border-brand-dark bg-brand' : 'border-line bg-surface'}`}
          >
            <Text className={`text-sm font-bold ${on ? 'text-white' : 'text-ink'}`}>{formatPrice(s.pricePerNight, s.currency)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};
