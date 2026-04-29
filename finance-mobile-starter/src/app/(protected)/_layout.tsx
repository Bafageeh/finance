import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession } from '@/contexts/auth-context';
import { colors } from '@/utils/theme';

export default function ProtectedLayout() {
  const { isLoading, isAuthenticated } = useSession();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="clients/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="clients/form" options={{ presentation: 'card' }} />
      <Stack.Screen name="alerts/[type]" options={{ presentation: 'card' }} />
      <Stack.Screen name="collections/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="stats/details" options={{ presentation: 'card' }} />
      <Stack.Screen name="cases/index" options={{ presentation: 'card' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
