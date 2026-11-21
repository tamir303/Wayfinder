import { Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useUsage } from '../../../src/features/travel/hooks';
import { config } from '../../../src/config/app-config';
import { auth } from '../../../src/lib/auth';
import { useSession } from '../../../src/lib/session';

export default function Profile() {
  const { session } = useSession();
  const usage = useUsage();
  return (
    <Screen title="Profile">
      <View className="gap-1 rounded-card border border-line p-4">
        <Text className="text-sm text-ink-muted">Signed in as</Text>
        <Text accessibilityLabel="Account email" className="text-base font-semibold text-ink">{session?.email}</Text>
      </View>
      <View className="gap-2 rounded-card border border-line p-4">
        <Text className="text-sm text-ink-muted">Daily searches</Text>
        <QueryState query={usage}>
          {({ used, cap }) => (
            <View className="gap-2">
              <View className="h-2 overflow-hidden rounded-full bg-surface-muted" accessibilityLabel={`${used} of ${cap} searches used`}>
                <View style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} className="h-2 bg-brand" />
              </View>
              <Text className="text-ink">{used} of {cap} used today</Text>
            </View>
          )}
        </QueryState>
      </View>
      <Text accessibilityLabel="Environment" className="text-xs text-ink-muted">
        Environment: {config.appEnv}{config.useMocks ? ' (mock data)' : ''}
      </Text>
      <Button label="Sign out" variant="secondary" onPress={() => void auth.signOut()} />
    </Screen>
  );
}
