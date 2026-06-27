import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { useSession } from '@/contexts/auth-context';
import { requestCreateUserOtp, verifyCreateUserOtp } from '@/services/api';
import { colors } from '@/utils/theme';

function onlyDigits(value: string) {
  return value.replace(/\D+/g, '');
}

export default function CreateUserScreen() {
  const { session } = useSession();
  const userRole = session?.user?.role || '';
  const isAdmin = String(userRole).toLowerCase() === 'admin'
    || String(session?.user?.username || '').toLowerCase() === 'admin'
    || String(session?.user?.email || '').toLowerCase() === 'admin@pm.sa';

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sanitizedPhone = onlyDigits(phone);
  const sanitizedOtp = onlyDigits(otp).slice(0, 6);

  function validateBaseFields() {
    if (!name.trim()) return 'أدخل اسم المستخدم.';
    if (!username.trim()) return 'أدخل اسم الدخول.';
    if (sanitizedPhone.length < 9) return 'أدخل رقم جوال صحيح.';
    if (password.length < 6) return 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.';
    if (password !== passwordConfirmation) return 'تأكيد كلمة المرور غير مطابق.';
    return null;
  }

  async function handleSendOtp() {
    const validationError = validateBaseFields();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSendingOtp(true);
      setError(null);
      await requestCreateUserOtp({ phone: sanitizedPhone, username: username.trim() });
      setOtpSent(true);
      Alert.alert('تم', 'تم إرسال رمز التحقق إلى رقم الجوال.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر إرسال رمز التحقق.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleCreateUser() {
    const validationError = validateBaseFields();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (sanitizedOtp.length !== 6) {
      setError('أدخل رمز التحقق المكوّن من ٦ أرقام.');
      return;
    }

    try {
      setCreatingUser(true);
      setError(null);
      const created = await verifyCreateUserOtp({
        name: name.trim(),
        username: username.trim(),
        email: email.trim() || undefined,
        phone: sanitizedPhone,
        password,
        password_confirmation: passwordConfirmation,
        otp: sanitizedOtp,
      });
      Alert.alert('تم إنشاء المستخدم', `تم إنشاء ${created.name} بنجاح.`, [
        { text: 'حسنًا', onPress: () => router.back() },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر إنشاء المستخدم.');
    } finally {
      setCreatingUser(false);
    }
  }

  if (!isAdmin) {
    return (
      <Screen
        title="مستخدم جديد"
        subtitle="هذه الصلاحية متاحة للمدير فقط."
        rightSlot={<IconButton icon="arrow-forward" accessibilityLabel="رجوع" onPress={() => router.back()} />}
      >
        <AppCard title="غير مصرح">
          <Text style={styles.errorText}>لا يمكن إنشاء مستخدم جديد من هذا الحساب.</Text>
        </AppCard>
      </Screen>
    );
  }

  return (
    <Screen
      title="مستخدم جديد"
      subtitle="أنشئ مستخدمًا جديدًا بعد التحقق من رقم الجوال."
      rightSlot={<IconButton icon="arrow-forward" accessibilityLabel="رجوع" onPress={() => router.back()} />}
    >
      <AppCard title="بيانات المستخدم">
        <View style={styles.fieldsStack}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>اسم المستخدم</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="مثال: أحمد محمد"
              placeholderTextColor="#a09a91"
              textAlign="right"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>اسم الدخول</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={(value) => setUsername(value.trim())}
              placeholder="مثال: ahmed"
              placeholderTextColor="#a09a91"
              autoCapitalize="none"
              textAlign="right"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>رقم الجوال</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="05xxxxxxxx"
              placeholderTextColor="#a09a91"
              keyboardType="phone-pad"
              textAlign="right"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>البريد الإلكتروني اختياري</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor="#a09a91"
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="right"
            />
          </View>
        </View>
      </AppCard>

      <AppCard title="كلمة المرور">
        <View style={styles.fieldsStack}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="٦ أحرف على الأقل"
              placeholderTextColor="#a09a91"
              secureTextEntry
              textAlign="right"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>تأكيد كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={passwordConfirmation}
              onChangeText={setPasswordConfirmation}
              placeholder="أعد كتابة كلمة المرور"
              placeholderTextColor="#a09a91"
              secureTextEntry
              textAlign="right"
            />
          </View>
        </View>
      </AppCard>

      <AppCard title="التحقق من الجوال">
        <View style={styles.otpInfoRow}>
          <View style={[styles.otpIcon, otpSent && styles.otpIconSuccess]}>
            <Ionicons name={otpSent ? 'checkmark' : 'chatbubble-ellipses-outline'} size={20} color={otpSent ? colors.success : colors.primary} />
          </View>
          <View style={styles.otpTextWrap}>
            <Text style={styles.otpTitle}>{otpSent ? 'تم إرسال الرمز' : 'أرسل رمز التحقق'}</Text>
            <Text style={styles.otpText}>سيصل الرمز إلى رقم الجوال، ثم أدخله هنا لإكمال إنشاء المستخدم.</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.secondaryButton, sendingOtp && styles.disabledButton]}
          activeOpacity={0.88}
          disabled={sendingOtp || creatingUser}
          onPress={() => void handleSendOtp()}
        >
          {sendingOtp ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="send-outline" size={17} color={colors.text} />}
          <Text style={styles.secondaryButtonText}>{otpSent ? 'إعادة إرسال الرمز' : 'إرسال رمز التحقق'}</Text>
        </TouchableOpacity>

        {otpSent ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>رمز التحقق</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={sanitizedOtp}
              onChangeText={setOtp}
              placeholder="000000"
              placeholderTextColor="#a09a91"
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />
          </View>
        ) : null}
      </AppCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryButton, (!otpSent || creatingUser) && styles.disabledButton]}
        activeOpacity={0.9}
        disabled={!otpSent || creatingUser || sendingOtp}
        onPress={() => void handleCreateUser()}
      >
        {creatingUser ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="person-add-outline" size={18} color="#fff" />}
        <Text style={styles.primaryButtonText}>{creatingUser ? 'جاري الإنشاء' : 'إنشاء المستخدم'}</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldsStack: {
    gap: 12,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
  },
  otpInput: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 7,
  },
  otpInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  otpIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpIconSuccess: {
    backgroundColor: colors.successSoft,
  },
  otpTextWrap: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  otpTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  otpText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.primary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.58,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'right',
    fontWeight: '700',
  },
});
