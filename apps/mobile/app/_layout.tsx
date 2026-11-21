import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { SessionProvider } from '../src/lib/session';

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
