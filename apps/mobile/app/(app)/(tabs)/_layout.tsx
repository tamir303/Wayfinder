import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

const glyph = (g: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{g}</Text>
);

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0B6BCB', tabBarInactiveTintColor: '#5B6B7B' }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.flights'), tabBarIcon: glyph('✈️') }} />
      <Tabs.Screen name="stays" options={{ title: t('tabs.stays'), tabBarIcon: glyph('🛏') }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore'), tabBarIcon: glyph('🧭') }} />
      <Tabs.Screen name="trips" options={{ title: t('tabs.trips'), tabBarIcon: glyph('🧳') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: glyph('👤') }} />
    </Tabs>
  );
}
