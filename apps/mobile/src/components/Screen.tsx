import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isRtl } from '../i18n';

// `dir` is honoured by react-native-web (and RN >= 0.71) but is missing from the TextProps typings.
const dirProps = (): object => ({ dir: isRtl() ? 'rtl' : 'ltr', style: { writingDirection: isRtl() ? 'rtl' : 'ltr' } });

type Props = { title?: string; subtitle?: string; children: ReactNode; scroll?: boolean };

export const Screen = ({ title, subtitle, children, scroll = true }: Props) => {
  const body = (
    <View className="w-full max-w-[720px] gap-3 self-center px-gutter pb-6">
      {title ? (
        <View className="gap-1 pt-4">
          <Text accessibilityRole="header" {...dirProps()} className="text-2xl font-bold text-brand">{title}</Text>
          {subtitle ? <Text {...dirProps()} className="text-sm text-ink-muted">{subtitle}</Text> : null}
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
