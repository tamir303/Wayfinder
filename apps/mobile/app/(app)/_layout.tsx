import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../src/lib/session';

export default function AppLayout() {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
