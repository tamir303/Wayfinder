import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { log } from '../src/lib/logger';
import { SessionProvider } from '../src/lib/session';

// Rendered by Expo Router when a screen throws. Logs through the env-aware logger (redacted in prod).
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  log.error('screen crashed', { message: error.message });
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface px-gutter">
      <Text accessibilityRole="header" className="text-2xl font-bold text-ink">Something went wrong</Text>
      <Text className="text-center text-ink-muted">Please try again.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={() => void retry()} className="rounded-card bg-brand px-6 py-3">
        <Text className="font-semibold text-white">Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        {/* On web, keep the phone layout centred instead of stretching across the window. */}
        <View className="w-full max-w-[480px] flex-1 self-center bg-surface">
          <Slot />
        </View>
      </QueryClientProvider>
    </SessionProvider>
  );
}
