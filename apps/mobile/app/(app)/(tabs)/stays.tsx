import type { Stay } from '@wayfinder/shared';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { StayCard } from '../../../src/components/cards';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useStays } from '../../../src/features/travel/hooks';
import { formatPrice } from '../../../src/lib/format';

// Map placeholder: pins are positioned by percentage until a real map component is added.
const MapPlaceholder = ({ stays, selectedId, onSelect }: { stays: Stay[]; selectedId?: string; onSelect: (s: Stay) => void }) => (
  <View accessibilityLabel="Map of stays" className="relative h-56 overflow-hidden rounded-card bg-brand-soft">
    <View className="absolute left-[10%] top-0 h-full w-1 bg-surface" />
    <View className="absolute left-[55%] top-0 h-full w-2 bg-surface" />
    <View className="absolute left-0 top-[45%] h-2 w-full bg-surface" />
    {stays.map((s) => {
      const on = s.id === selectedId;
      return (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          accessibilityLabel={`Map pin ${s.name} ${formatPrice(s.pricePerNight, s.currency)}`}
          onPress={() => onSelect(s)}
          style={{ left: `${s.mapX}%`, top: `${s.mapY}%` }}
          className={`absolute rounded-full border px-2.5 py-1 ${on ? 'border-brand-dark bg-brand' : 'border-line bg-surface'}`}
        >
          <Text className={`text-sm font-bold ${on ? 'text-white' : 'text-ink'}`}>{formatPrice(s.pricePerNight, s.currency)}</Text>
        </Pressable>
      );
    })}
  </View>
);

export default function Stays() {
  const result = useStays();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  return (
    <Screen title="Stays" subtitle="Compare stays on the map. Booking happens on the provider's site.">
      <QueryState query={result}>
        {({ stays }) => {
          const selected = stays.find((s) => s.id === selectedId);
          return (
            <View className="gap-3">
              <MapPlaceholder stays={stays} selectedId={selectedId} onSelect={(s) => setSelectedId(s.id)} />
              {selected ? (
                <View className="gap-2 rounded-card border border-brand p-4" accessibilityLabel={`Selected stay ${selected.name}`}>
                  <Text className="text-lg font-semibold text-ink">{selected.name}</Text>
                  <Text className="text-ink-muted">{selected.amenities.join(' · ')}</Text>
                  <Button label="View deal" onPress={() => void Linking.openURL(selected.dealUrl)} />
                </View>
              ) : null}
              {stays.map((s) => <StayCard key={s.id} stay={s} selected={s.id === selectedId} onPress={() => setSelectedId(s.id)} />)}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}
