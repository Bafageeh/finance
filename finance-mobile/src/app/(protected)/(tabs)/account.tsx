import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AccordionSection } from '@/components/AccordionSection';
import { Screen } from '@/components/Screen';
import { useSession } from '@/contexts/auth-context';
import { AdminAccountSummary, changePassword, getAdminAccounts } from '@/services/api';
import { colors } from '@/utils/theme';

interface AccountActionRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function AccountActionRow({ icon, title, description, onPress, disabled, destructive }: AccountActionRowProps) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, disabled && styles.actionDisabled]}
      activeOpacity={0.86}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
    >
      <View style={[styles.actionIcon, destructive && styles.actionIconDanger]}>
        <Ionicons name={icon} size={19} color={destructive ? colors.danger : colors.text} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, destructive && styles.actionTitleDanger]}>{title}</Text>
        {description ? <Text style={styles.actionDescription}>{description}</Text> : null}
      </View>
      <Ionicons name="chevron-back-outline" size={16} color={destructive ? colors.danger : colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function AccountScreen() {
  const { session, signOut, deleteAccount, refreshProfile, isGuestSession } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSheetVisible, setPasswordSheetVisible] = useState(false);
  const [accountsSheetVisible, setAccountsSheetVisible] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AdminAccountSummary[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const userRole = session?.user?.role || (isGuestSession ? 'live-api' : 'غير محدد');
  const isAdmin = String(userRole).toLowerCase() === 'admin'
    || String(session?.user?.username || '').toLowerCase() === 'admin'
    || String(session?.user?.email || '').toLowerCase() === 'admin@pm.sa';
  const firstLetter = session?.user?.name?.trim()?.slice(0, 1) || 'م';
  const displayName = session?.user?.name?.trim() || 'مستخدم التمويل';
  const identifier = session?.user?.username || session?.user?.email || '';
  const accountName = session?.user?.account_name;
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  function resetPasswordForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  }

  function openPasswordSheet() {
    resetPasswordForm();
    setPasswordSheetVisible(true);
  }

  function closePasswordSheet() {
    if (changingPassword) return;
    setPasswordSheetVisible(false);
    resetPasswordForm();
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await refreshProfile();
      Alert.alert('تم', isGuestSession ? 'تم تحديث حالة الاتصال بالتطبيق.' : 'تم تحديث بيانات الحساب.');
    } catch (error) {
      Alert.alert('تعذر التحديث', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOut();
      Alert.alert('تم', isGuestSession ? 'تمت إعادة تهيئة الجلسة المحلية.' : 'تم تسجيل الخروج.');
    } catch (error) {
      Alert.alert('تعذر تنفيذ العملية', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    } finally {
      setSigningOut(false);
    }
  }

  function confirmDeleteAccount() {
    if (isGuestSession || deletingAccount) return;

    Alert.alert(
      'حذف الحساب',
      'سيتم حذف حساب المستخدم الحالي نهائيًا من التطبيق وتسجيل الخروج من هذا الجهاز. لا يؤثر ذلك على سجلات العملاء والتمويل الخاصة بالمنشأة.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'متابعة',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'تأكيد الحذف النهائي',
              'هل تريد حذف هذا الحساب الآن؟ لا يمكن التراجع عن هذه العملية.',
              [
                { text: 'إلغاء', style: 'cancel' },
                { text: 'حذف الحساب', style: 'destructive', onPress: () => void handleDeleteAccount() },
              ],
            );
          },
        },
      ],
    );
  }

  async function handleDeleteAccount() {
    try {
      setDeletingAccount(true);
      await deleteAccount();
      Alert.alert('تم', 'تم حذف الحساب وتسجيل الخروج.');
    } catch (error) {
      Alert.alert('تعذر حذف الحساب', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    } finally {
      setDeletingAccount(false);
    }
  }

  async function handleChangePassword() {
    const current = currentPassword.trim();
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (!current) return setPasswordError('أدخل كلمة المرور الحالية.');
    if (next.length < 6) return setPasswordError('كلمة المرور الجديدة يجب أن تكون ٦ أحرف على الأقل.');
    if (next !== confirm) return setPasswordError('تأكيد كلمة المرور غير مطابق.');

    try {
      setChangingPassword(true);
      setPasswordError(null);
      await changePassword({ current_password: current, password: next, password_confirmation: confirm });
      setPasswordSheetVisible(false);
      resetPasswordForm();
      Alert.alert('تم', 'تم تغيير الرقم السري بنجاح.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'تعذر تغيير الرقم السري.');
    } finally {
      setChangingPassword(false);
    }
  }

  async function openAccountsSheet() {
    if (!isAdmin) return;
    setAccountsSheetVisible(true);
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      setAccounts(await getAdminAccounts());
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : 'تعذر تحميل الحسابات الأخرى.');
    } finally {
      setLoadingAccounts(false);
    }
  }

  return (
    <Screen title="حسابي" subtitle="إدارة معلوماتك وأمان حسابك" compactHeader>
      <View style={styles.profileCard}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}><Text style={styles.avatarLetter}>{firstLetter}</Text></View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName} numberOfLines={2}>{displayName}</Text>
            {identifier ? <Text style={styles.profileIdentifier} numberOfLines={1}>{identifier}</Text> : null}
            <View style={styles.profileBadgeRow}>
              <View style={styles.roleBadge}>
                <Ionicons name={isAdmin ? 'shield-checkmark-outline' : 'person-outline'} size={13} color="#fff" />
                <Text style={styles.roleBadgeText}>{isAdmin ? 'مدير التطبيق' : 'مستخدم'}</Text>
              </View>
              {accountName ? <Text style={styles.profileAccountName} numberOfLines={1}>{accountName}</Text> : null}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>إعدادات الحساب</Text>
        <AccountActionRow
          icon="key-outline"
          title="تغيير كلمة المرور"
          description="تحديث كلمة المرور المستخدمة لتسجيل الدخول"
          onPress={openPasswordSheet}
          disabled={isGuestSession || changingPassword}
        />
        <View style={styles.rowDivider} />
        <AccountActionRow
          icon="refresh-outline"
          title={refreshing ? 'جارٍ تحديث الحساب...' : 'تحديث بيانات الحساب'}
          description="تحديث معلومات المستخدم من السيرفر"
          onPress={() => void handleRefresh()}
          disabled={refreshing}
        />
      </View>

      {isAdmin ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>الإدارة</Text>
          <AccountActionRow
            icon="person-add-outline"
            title="إضافة مستخدم"
            description="إنشاء حساب جديد وتحديد بيانات دخوله"
            onPress={() => router.push('/account/create-user')}
          />
          <View style={styles.rowDivider} />
          <AccountActionRow
            icon="people-outline"
            title="إدارة الحسابات"
            description="عرض الحسابات المرتبطة ومستخدميها"
            onPress={() => void openAccountsSheet()}
            disabled={loadingAccounts}
          />
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>الجلسة والأمان</Text>
        <AccountActionRow
          icon="log-out-outline"
          title={signingOut ? 'جارٍ تسجيل الخروج...' : 'تسجيل الخروج'}
          description="إنهاء الجلسة الحالية على هذا الجهاز"
          onPress={() => void handleSignOut()}
          disabled={signingOut}
        />
      </View>

      {!isGuestSession ? (
        <AccordionSection
          title="حذف الحساب نهائيًا"
          subtitle="إجراء اختياري لا يمكن التراجع عنه"
          expanded={showDeleteAccount}
          onToggle={() => setShowDeleteAccount((current) => !current)}
        >
          <Text style={styles.deleteHelp}>
            يؤدي حذف الحساب إلى إزالة حساب المستخدم نهائيًا وتسجيل الخروج. لا تُحذف سجلات العملاء أو عقود التمويل الخاصة بالمنشأة.
          </Text>
          <AccountActionRow
            icon="trash-outline"
            title={deletingAccount ? 'جارٍ حذف الحساب...' : 'حذف حسابي'}
            description="يتطلب تأكيدين قبل التنفيذ"
            onPress={confirmDeleteAccount}
            disabled={deletingAccount}
            destructive
          />
        </AccordionSection>
      ) : null}

      {(refreshing || signingOut || deletingAccount || changingPassword || loadingAccounts) ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loaderText}>جارٍ تنفيذ العملية...</Text>
        </View>
      ) : null}

      <Modal visible={passwordSheetVisible} transparent animationType="fade" onRequestClose={closePasswordSheet}>
        <View style={styles.modalBackdrop}>
          <View style={styles.passwordSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={closePasswordSheet} disabled={changingPassword} activeOpacity={0.85}><Ionicons name="close" size={18} color={colors.text} /></TouchableOpacity>
              <View style={styles.sheetTitleWrap}><Text style={styles.sheetTitle}>تغيير الرقم السري</Text><Text style={styles.sheetSubtitle}>أدخل كلمة المرور الحالية ثم الرقم السري الجديد.</Text></View>
            </View>
            <View style={styles.passwordFields}>
              <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>كلمة المرور الحالية</Text><TextInput style={styles.passwordInput} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry textAlign="right" placeholder="••••••" placeholderTextColor="#a09a91" /></View>
              <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>الرقم السري الجديد</Text><TextInput style={styles.passwordInput} value={newPassword} onChangeText={setNewPassword} secureTextEntry textAlign="right" placeholder="٦ أحرف على الأقل" placeholderTextColor="#a09a91" /></View>
              <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>تأكيد الرقم السري الجديد</Text><TextInput style={styles.passwordInput} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry textAlign="right" placeholder="أعد كتابة الرقم السري" placeholderTextColor="#a09a91" /></View>
            </View>
            {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closePasswordSheet} disabled={changingPassword} activeOpacity={0.85}><Text style={styles.cancelButtonText}>إلغاء</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, changingPassword && styles.disabledButton]} onPress={() => void handleChangePassword()} disabled={changingPassword} activeOpacity={0.9}>{changingPassword ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="save-outline" size={17} color="#fff" />}<Text style={styles.saveButtonText}>{changingPassword ? 'جارٍ الحفظ' : 'حفظ الرقم السري'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={accountsSheetVisible} transparent animationType="slide" onRequestClose={() => setAccountsSheetVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.accountsSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setAccountsSheetVisible(false)} activeOpacity={0.85}><Ionicons name="close" size={18} color={colors.text} /></TouchableOpacity>
              <View style={styles.sheetTitleWrap}><Text style={styles.sheetTitle}>الحسابات الأخرى</Text><Text style={styles.sheetSubtitle}>تظهر هذه الشاشة للمدير فقط.</Text></View>
            </View>

            {loadingAccounts ? (
              <View style={styles.accountsLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.loaderText}>جاري تحميل الحسابات...</Text></View>
            ) : accountsError ? (
              <Text style={styles.passwordError}>{accountsError}</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.accountsList} showsVerticalScrollIndicator={false}>
                {accounts.length ? accounts.map((account) => (
                  <View key={String(account.id)} style={styles.accountItem}>
                    <View style={styles.accountTopRow}>
                      <View style={styles.accountBadge}><Text style={styles.accountBadgeText}>{String(account.name || 'ح').slice(0, 1)}</Text></View>
                      <View style={styles.accountTitleWrap}>
                        <Text style={styles.accountName}>{account.name}</Text>
                        <Text style={styles.accountSlug}>{account.slug || 'بدون اختصار'} · {account.status || 'active'}</Text>
                      </View>
                    </View>
                    <View style={styles.accountStatsRow}>
                      <View style={styles.accountMiniStat}><Text style={styles.accountMiniValue}>{account.users_count}</Text><Text style={styles.accountMiniLabel}>مستخدمين</Text></View>
                      <View style={styles.accountMiniStat}><Text style={styles.accountMiniValue}>{account.clients_count}</Text><Text style={styles.accountMiniLabel}>عملاء</Text></View>
                    </View>
                    {account.users?.length ? (
                      <View style={styles.usersList}>
                        {account.users.map((user) => <Text key={String(user.id)} style={styles.userLine}>• {user.name} {user.username ? `(${user.username})` : ''}</Text>)}
                      </View>
                    ) : null}
                  </View>
                )) : <Text style={styles.emptyAccounts}>لا توجد حسابات أخرى حالياً.</Text>}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 17,
    marginBottom: 14,
  },
  profileTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 13 },
  avatar: {
    width: 58, height: 58, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.23)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 24, fontWeight: '900', color: '#fff' },
  profileDetails: { flex: 1, minWidth: 0, gap: 6 },
  profileName: { fontSize: 19, fontWeight: '900', color: '#fff', textAlign: 'right' },
  profileIdentifier: { fontSize: 12, color: 'rgba(255,255,255,0.76)', textAlign: 'right' },
  profileBadgeRow: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  roleBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 15,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  profileAccountName: { flexShrink: 1, fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 5,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '900', color: colors.text,
    textAlign: 'right', marginBottom: 8,
  },
  actionRow: {
    minHeight: 62,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
  },
  actionDisabled: { opacity: 0.55 },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  actionIconDanger: { backgroundColor: colors.dangerSoft },
  actionText: { flex: 1, minWidth: 0, gap: 3 },
  actionTitle: { fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'right' },
  actionTitleDanger: { color: colors.danger },
  actionDescription: { fontSize: 11, lineHeight: 17, color: colors.textMuted, textAlign: 'right' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginRight: 51 },
  deleteHelp: { fontSize: 12, lineHeight: 21, color: colors.textMuted, textAlign: 'right' },
  loaderRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 8 },
  loaderText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'center', padding: 22 },
  passwordSheet: { backgroundColor: colors.background, borderRadius: 26, padding: 18, gap: 14, borderWidth: 1, borderColor: colors.border },
  accountsSheet: { maxHeight: '82%', backgroundColor: colors.background, borderRadius: 26, padding: 18, gap: 14, borderWidth: 1, borderColor: colors.border },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#ded8cf' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  sheetTitleWrap: { flex: 1, alignItems: 'flex-end', gap: 4 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' },
  sheetSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 19, textAlign: 'right' },
  passwordFields: { gap: 10 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  passwordInput: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.text, fontSize: 15 },
  passwordError: { color: colors.danger, fontSize: 13, fontWeight: '700', lineHeight: 21, textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  saveButton: { flex: 1.2, minHeight: 48, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disabledButton: { opacity: 0.65 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  accountsLoading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 10 },
  accountsList: { gap: 10, paddingBottom: 8 },
  accountItem: { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  accountTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  accountBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  accountBadgeText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  accountTitleWrap: { flex: 1, alignItems: 'flex-end', gap: 3 },
  accountName: { color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  accountSlug: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  accountStatsRow: { flexDirection: 'row-reverse', gap: 8 },
  accountMiniStat: { flex: 1, borderRadius: 14, backgroundColor: colors.surfaceMuted, padding: 10, alignItems: 'center' },
  accountMiniValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  accountMiniLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  usersList: { gap: 4, paddingTop: 2 },
  userLine: { color: colors.textMuted, fontSize: 12, textAlign: 'right', lineHeight: 19 },
  emptyAccounts: { color: colors.textMuted, textAlign: 'center', paddingVertical: 30, fontWeight: '800' },
});
