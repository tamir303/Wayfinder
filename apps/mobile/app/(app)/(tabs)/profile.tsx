import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useUsage } from '../../../src/features/travel/hooks';
import { config } from '../../../src/config/app-config';
import { auth } from '../../../src/lib/auth';
import { useSession } from '../../../src/lib/session';

export default function Profile() {
  const { t } = useTranslation();
  const { session } = useSession();
  const usage = useUsage();
  return (
    <Screen title={t('profile.title')}>
      <View className="gap-1 rounded-card border border-line p-4">
        <Text className="text-sm text-ink-muted">{t('profile.signedInAs')}</Text>
        <Text accessibilityLabel={t('profile.email')} className="text-base font-semibold text-ink">{session?.email}</Text>
      </View>
      <View className="gap-2 rounded-card border border-line p-4">
        <Text className="text-sm text-ink-muted">{t('profile.daily')}</Text>
        <QueryState query={usage}>
          {({ used, cap }) => (
            <View className="gap-2">
              <View className="h-2 overflow-hidden rounded-full bg-surface-muted" accessibilityLabel={t('profile.usageLabel', { used, cap })}>
                <View style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} className="h-2 bg-brand" />
              </View>
              <Text className="text-ink">{t('profile.usage', { used, cap })}</Text>
            </View>
          )}
        </QueryState>
      </View>
      <Text accessibilityLabel={t('profile.environment', { env: config.appEnv })} className="text-xs text-ink-muted">
        {t('profile.environment', { env: config.appEnv })}{config.useMocks ? t('profile.mock') : ''}
      </Text>
      <Button label={t('common.signOut')} variant="secondary" onPress={() => void auth.signOut()} />
    </Screen>
  );
}
