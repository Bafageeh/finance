import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/utils/theme';

export function LoadingBlock() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
