import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useAttractions } from '../../../src/features/travel/hooks';

export default function AttractionDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useAttractions();
  return (
    <Screen title={t('attraction.title')}>
      <Button label={t('attraction.back')} variant="secondary" onPress={() => router.back()} />
      <QueryState query={result}>
        {({ attractions }) => {
          const a = attractions.find((x) => x.id === id);
          if (!a) return <Text className="text-ink-muted">{t('attraction.notFound')}</Text>;
          return (
            <View className="gap-3">
              <Text accessibilityRole="header" className="text-2xl font-bold text-ink">{a.name}</Text>
              <Text className="text-ink-muted">{a.category} · ★ {a.rating} ({a.reviews})</Text>
              <Text className="text-ink">{a.blurb}</Text>
              <Text className="text-sm font-semibold text-ink">{t('attraction.hours')}</Text>
              <Text className="text-ink-muted">{a.hours}</Text>
              <Button label={t('trips.addButton')} onPress={() => router.push({ pathname: '/add-to-trip', params: { kind: 'attraction', id: a.id, title: a.name, meta: `${a.category} · ${a.hours}` } })} />
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}
