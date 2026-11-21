import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = { title?: string; subtitle?: string; children: ReactNode; scroll?: boolean };

export const Screen = ({ title, subtitle, children, scroll = true }: Props) => {
  const body = (
    <View className="gap-3 px-gutter pb-6">
      {title ? (
        <View className="gap-1 pt-4">
          <Text accessibilityRole="header" className="text-2xl font-bold text-brand">{title}</Text>
          {subtitle ? <Text className="text-sm text-ink-muted">{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
};
