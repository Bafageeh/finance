import { Stack } from 'expo-router';
import { Component, PropsWithChildren } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from '@/contexts/auth-context';

class StartupErrorBoundary extends Component<PropsWithChildren, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <Text style={styles.title}>Finance Mobile</Text>
          <Text style={styles.errorTitle}>تم التقاط خطأ داخل التطبيق</Text>
          <Text style={styles.note}>{this.state.error.message || 'خطأ غير معروف'}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <StartupErrorBoundary>
      <AuthProvider>
        <StatusBar barStyle="dark-content" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#f5f5f3' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="(protected)" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </StartupErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f3',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1a1a18',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#a32d2d',
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6b6b68',
    textAlign: 'center',
  },
});
