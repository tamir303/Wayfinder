import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Input } from '../../components/Input';

const DAY_CHOICES = [1, 2, 3, 4, 5, 7, 10, 14];

export const NewTripForm = ({ onCreate }: { onCreate: (name: string, days: number) => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [days, setDays] = useState(3);
  return (
    <View className="gap-3">
      <Input label={t('trips.nameLabel')} accessibilityLabel={t('trips.nameLabel')} value={name} onChangeText={setName} placeholder={t('trips.namePlaceholder')} />
      <Text className="text-sm font-medium text-ink-muted">{t('trips.daysLabel')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {DAY_CHOICES.map((n) => <Chip key={n} label={t('trips.dayCount', { count: n })} selected={n === days} onPress={() => setDays(n)} />)}
      </ScrollView>
      <Button label={t('trips.create')} disabled={name.trim().length === 0} onPress={() => { onCreate(name, days); setName(''); }} />
    </View>
  );
};
