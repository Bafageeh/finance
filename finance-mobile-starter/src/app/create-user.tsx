import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { Screen } from '@/components/Screen';
import { requestCreateUserOtp, verifyCreateUserOtp } from '@/services/api';
import { colors } from '@/utils/theme';

const digits = (value: string) => value.replace(/\D+/g, '');

export default function CreateUserScreen() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanPhone = digits(phone);
  const cleanCode = digits(code).slice(0, 6);

  function validate() {
    if (!name.trim()) return 'أدخل اسم المستخدم.';
    if (!username.trim()) return 'أدخل اسم الدخول.';
    if (cleanPhone.length < 9) return 'أدخل رقم جوال صحيح.';
    if (pass.length < 6) return 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.';
    if (pass !== pass2) return 'تأكيد كلمة المرور غير مطابق.';
    return null;
  }

  async function sendCode() {
    const problem = validate();
    if (problem) return setError(problem);

    try {
      setBusy(true);
      setError(null);
      await requestCreateUserOtp({ phone: cleanPhone, username: username.trim() });
      setSent(true);
      Alert.alert('تم', 'تم إرسال رمز التحقق إلى رقم الجوال.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إرسال رمز التحقق.');
    } finally {
      setBusy(false);
    }
  }

  async function createUser() {
    const problem = validate();
    if (problem) return setError(problem);
    if (cleanCode.length !== 6) return setError('أدخل رمز التحقق المكوّن من ٦ أرقام.');

    try {
      setBusy(true);
      setError(null);
      await verifyCreateUserOtp({
        name: name.trim(),
        username: username.trim(),
        phone: cleanPhone,
        email: email.trim() || undefined,
        password: pass,
        password_confirmation: pass2,
        otp: cleanCode,
      });
      Alert.alert('تم', 'تم إنشاء المستخدم. يمكنك تسجيل الدخول الآن.', [
        { text: 'تسجيل الدخول', onPress: () => router.replace('/sign-in') },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء المستخدم.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="مستخدم جديد" subtitle="أنشئ حسابًا جديدًا بعد التحقق من رقم الجوال." actionLabel="رجوع" actionIcon="arrow-forward" onActionPress={() => router.replace('/sign-in')}>
      <AppCard title="بيانات المستخدم">
        <View style={styles.stack}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="اسم المستخدم" placeholderTextColor="#a09a91" textAlign="right" />
          <TextInput style={styles.input} value={username} onChangeText={(v) => setUsername(v.trim())} placeholder="اسم الدخول" placeholderTextColor="#a09a91" autoCapitalize="none" textAlign="right" />
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="رقم الجوال" placeholderTextColor="#a09a91" keyboardType="phone-pad" textAlign="right" />
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني اختياري" placeholderTextColor="#a09a91" keyboardType="email-address" autoCapitalize="none" textAlign="right" />
          <TextInput style={styles.input} value={pass} onChangeText={setPass} placeholder="كلمة المرور" placeholderTextColor="#a09a91" secureTextEntry textAlign="right" />
          <TextInput style={styles.input} value={pass2} onChangeText={setPass2} placeholder="تأكيد كلمة المرور" placeholderTextColor="#a09a91" secureTextEntry textAlign="right" />
        </View>
      </AppCard>

      <AppCard title="التحقق من الجوال">
        <Text style={styles.hint}>سيصل رمز إلى رقم الجوال، ثم أدخله هنا لإكمال إنشاء المستخدم.</Text>
        <TouchableOpacity style={[styles.secondaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void sendCode()}>
          {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.secondaryText}>{sent ? 'إعادة إرسال الرمز' : 'إرسال رمز التحقق'}</Text>}
        </TouchableOpacity>
        {sent ? <TextInput style={[styles.input, styles.codeInput]} value={cleanCode} onChangeText={setCode} placeholder="000000" placeholderTextColor="#a09a91" keyboardType="number-pad" maxLength={6} textAlign="center" /> : null}
      </AppCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={[styles.primaryButton, (!sent || busy) && styles.disabled]} disabled={!sent || busy} onPress={() => void createUser()}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>إنشاء المستخدم</Text>}
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  input: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.text, fontSize: 15 },
  codeInput: { fontSize: 22, fontWeight: '900', letterSpacing: 7 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 21, textAlign: 'right' },
  secondaryButton: { minHeight: 48, borderRadius: 16, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.text, fontWeight: '900' },
  primaryButton: { minHeight: 54, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  disabled: { opacity: 0.58 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 21, textAlign: 'right', fontWeight: '700' },
});
