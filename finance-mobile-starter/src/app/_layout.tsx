import { StatusBar, StyleSheet, Text, View } from 'react-native';

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>Finance Mobile</Text>
      <Text style={styles.subtitle}>نسخة تشخيصية: التطبيق فتح بنجاح</Text>
      <Text style={styles.note}>إذا ظهرت هذه الشاشة، فسبب الإغلاق من إحدى الشاشات أو مزود الجلسة وليس من APK نفسه.</Text>
    </View>
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
  subtitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1d9e75',
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6b6b68',
    textAlign: 'center',
  },
});
