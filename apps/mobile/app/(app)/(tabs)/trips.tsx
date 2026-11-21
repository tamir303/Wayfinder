import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useTrips } from '../../../src/features/travel/hooks';

export default function Trips() {
  const { t } = useTranslation();
  const router = useRouter();
  const result = useTrips();
  return (
    <Screen title={t('trips.title')} subtitle={t('trips.subtitle')}>
      <QueryState query={result}>
        {({ trips }) =>
          trips.length === 0 ? (
            <Text className="text-ink-muted">{t('trips.none')}</Text>
          ) : (
            <View className="gap-3">
              {trips.map((trip) => (
                <Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={`${trip.name}, ${trip.dates}`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })} className="overflow-hidden rounded-card border border-line bg-surface">
                  <View className="h-24 items-center justify-center bg-brand-soft"><Text className="text-3xl">🧳</Text></View>
                  <View className="gap-0.5 p-3">
                    <Text className="text-lg font-semibold text-ink">{trip.name}</Text>
                    <Text className="text-sm text-ink-muted">{t('trips.meta', { dates: trip.dates, count: trip.itemCount })}</Text>
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
