import { StatusBar, StyleSheet, Text, View } from 'react-native';

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>Finance Mobile</Text>
      <Text style={styles.subtitle}>APK Diagnostic</Text>
      <Text style={styles.success}>فتح APK بنجاح</Text>
      <Text style={styles.note}>هذه نسخة اختبار APK فقط. إذا فتحت هذه الشاشة، فالمشكلة داخل شاشات التطبيق الحقيقي وليست في ملف APK أو الجهاز.</Text>
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
    fontSize: 30,
    fontWeight: '900',
    color: '#1a1a18',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#185fa5',
    textAlign: 'center',
  },
  success: {
    fontSize: 20,
    fontWeight: '900',
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
