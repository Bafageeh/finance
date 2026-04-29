import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/utils/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: '#fff',
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size, focused }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            index: focused ? 'wallet' : 'wallet-outline',
            clients: focused ? 'people' : 'people-outline',
            stats: focused ? 'bar-chart' : 'bar-chart-outline',
            account: focused ? 'person-circle' : 'person-circle-outline',
          };

          return <Ionicons name={iconMap[route.name] || 'ellipse-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'التمويل' }} />
      <Tabs.Screen name="clients" options={{ title: 'العملاء' }} />
      <Tabs.Screen name="stats" options={{ title: 'الإحصائيات' }} />
      <Tabs.Screen name="account" options={{ title: 'الحساب' }} />
    
      <Tabs.Screen
        name="reports"
        options={{
          title: 'التقارير',
          tabBarLabel: 'التقارير',
        }}
      />
    </Tabs>
  );
}
