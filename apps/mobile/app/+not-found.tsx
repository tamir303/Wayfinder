import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface px-gutter">
      <Text accessibilityRole="header" className="text-2xl font-bold text-ink">Page not found</Text>
      <Text className="text-center text-ink-muted">That page does not exist or has moved.</Text>
      <Link href="/" className="text-base font-semibold text-brand">Go to Flights</Link>
    </View>
  );
}
