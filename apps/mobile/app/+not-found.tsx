import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface px-gutter">
      <Text accessibilityRole="header" className="text-2xl font-bold text-ink">{t('errors.notFoundTitle')}</Text>
      <Text className="text-center text-ink-muted">{t('errors.notFoundBody')}</Text>
      <Link href="/" className="text-base font-semibold text-brand">{t('errors.goHome')}</Link>
    </View>
  );
}
