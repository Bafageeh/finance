import { registerRootComponent } from 'expo';
import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';

function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>Finance Diagnostic</Text>
      <Text style={styles.success}>Standalone APK فتح بنجاح</Text>
      <Text style={styles.note}>هذه النسخة تتجاوز expo-router بالكامل لاختبار طبقة تشغيل Android.</Text>
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

registerRootComponent(App);
