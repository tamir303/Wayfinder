import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../../src/components/Icon';
import { Screen } from '../../../src/components/Screen';
import { NewTripForm } from '../../../src/features/trips/NewTripForm';
import { tripActions, useTripStore } from '../../../src/features/trips/store';

export default function Trips() {
  const { t } = useTranslation();
  const router = useRouter();
  const { trips } = useTripStore();
  return (
    <Screen title={t('trips.title')} subtitle={t('trips.subtitle')}>
      <NewTripForm onCreate={(name, days) => router.push({ pathname: '/trip/[id]', params: { id: tripActions.create(name, days).id } })} />
      {trips.length === 0 ? <Text className="text-ink-muted">{t('trips.none')}</Text> : null}
      <View className="gap-3">
        {trips.map((trip) => (
          <Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={trip.name} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })} className="overflow-hidden rounded-card border border-line bg-surface">
            <View className="h-16 items-center justify-center bg-brand-soft"><Icon name="briefcase" size={28} color="#0B6BCB" /></View>
            <View className="gap-0.5 p-3">
              <Text className="text-lg font-semibold text-ink">{trip.name}</Text>
              <Text className="text-sm text-ink-muted">{t('trips.meta', { days: trip.dayCount, count: trip.items.length })}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Text className="text-xs text-ink-muted">{t('trips.offline')}</Text>
    </Screen>
  );
}
