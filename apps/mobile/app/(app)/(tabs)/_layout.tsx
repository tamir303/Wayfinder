import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const glyph = (g: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{g}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0B6BCB', tabBarInactiveTintColor: '#5B6B7B' }}>
      <Tabs.Screen name="index" options={{ title: 'Flights', tabBarIcon: glyph('✈️') }} />
      <Tabs.Screen name="stays" options={{ title: 'Stays', tabBarIcon: glyph('🛏') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: glyph('🧭') }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: glyph('🧳') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: glyph('👤') }} />
    </Tabs>
  );
}
