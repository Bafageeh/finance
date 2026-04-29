import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession } from '@/contexts/auth-context';
import { colors } from '@/utils/theme';

export default function IndexScreen() {
  const { isLoading, isAuthenticated } = useSession();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(protected)/(tabs)' : '/sign-in'} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
