import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';
import { Icon, type IconName } from '../../../src/components/Icon';

const icon = (name: IconName) => ({ color }: { color: unknown }) => <Icon name={name} size={24} color={String(color)} />;

// From this width up (web) the tab bar becomes a left sidebar.
export const WIDE_BREAKPOINT = 900;

export default function TabsLayout() {
  const { t } = useTranslation();
  const wide = useWindowDimensions().width >= WIDE_BREAKPOINT;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0B6BCB', tabBarInactiveTintColor: '#5B6B7B', tabBarPosition: wide ? 'left' : 'bottom' }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.flights'), tabBarIcon: icon('plane') }} />
      <Tabs.Screen name="stays" options={{ title: t('tabs.stays'), tabBarIcon: icon('bed') }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore'), tabBarIcon: icon('compass') }} />
      <Tabs.Screen name="trips" options={{ title: t('tabs.trips'), tabBarIcon: icon('briefcase') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
