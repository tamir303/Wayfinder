import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useTrips } from '../../../src/features/travel/hooks';

export default function Trips() {
  const router = useRouter();
  const result = useTrips();
  return (
    <Screen title="Trips" subtitle="Plan flights, stays and things to do in one place">
      <QueryState query={result}>
        {({ trips }) =>
          trips.length === 0 ? (
            <Text className="text-ink-muted">No trips yet.</Text>
          ) : (
            <View className="gap-3">
              {trips.map((t) => (
                <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`${t.name}, ${t.dates}`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })} className="overflow-hidden rounded-card border border-line bg-surface">
                  <View className="h-24 items-center justify-center bg-brand-soft"><Text className="text-3xl">🧳</Text></View>
                  <View className="gap-0.5 p-3">
                    <Text className="text-lg font-semibold text-ink">{t.name}</Text>
                    <Text className="text-sm text-ink-muted">{t.dates} · {t.itemCount} items</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        }
      </QueryState>
    </Screen>
  );
}
