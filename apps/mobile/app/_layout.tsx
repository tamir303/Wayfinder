import '../global.css';
import i18n from '../src/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { log } from '../src/lib/logger';
import { SessionProvider } from '../src/lib/session';

// Rendered by Expo Router when a screen throws. Logs through the env-aware logger (redacted in prod).
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  log.error('screen crashed', { message: error.message });
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface px-gutter">
      <Text accessibilityRole="header" className="text-2xl font-bold text-ink">{i18n.t('errors.crashTitle')}</Text>
      <Text className="text-center text-ink-muted">{i18n.t('errors.crashBody')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={i18n.t('common.tryAgain')} onPress={() => void retry()} className="rounded-card bg-brand px-6 py-3">
        <Text className="font-semibold text-white">{i18n.t('common.tryAgain')}</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  // Phone layout up to 900px, then a wider frame so the tab sidebar and content both fit.
  const maxWidth = useWindowDimensions().width >= 900 ? 1100 : 480;
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        {/* On web, keep the phone layout centred instead of stretching across the window. */}
        <View style={{ maxWidth }} className="w-full flex-1 self-center bg-surface">
          <Slot />
        </View>
      </QueryClientProvider>
    </SessionProvider>
  );
}
