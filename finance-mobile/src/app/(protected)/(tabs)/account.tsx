import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { ActionTile } from '@/components/ActionTile';
import { AppCard } from '@/components/AppCard';
import { InfoPill } from '@/components/InfoPill';
import { Screen } from '@/components/Screen';
import { useSession } from '@/contexts/auth-context';
import { AdminAccountSummary, apiConfig, changePassword, getAdminAccounts } from '@/services/api';
import { colors } from '@/utils/theme';

function maskToken(token?: string) {
  if (!token) return 'لا يوجد';
  if (token.length <= 18) return token;
  return `${token.slice(0, 8)}...${token.slice(-6)}`;
}

export default function AccountScreen() {
  const { session, signOut, refreshProfile, isGuestSession } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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
  const [openSection, setOpenSection] = useState<'session' | 'connection' | null>(null);

  const userRole = session?.user?.role || (isGuestSession ? 'live-api' : 'غير محدد');
  const isAdmin = String(userRole).toLowerCase() === 'admin'
    || String(session?.user?.username || '').toLowerCase() === 'admin'
    || String(session?.user?.email || '').toLowerCase() === 'admin@pm.sa';
  const firstLetter = session?.user?.name?.trim()?.slice(0, 1) || 'م';
  const statusTone = isGuestSession ? 'success' : 'info';
  const statusLabel = isGuestSession ? 'جلسة مباشرة' : 'جلسة موثقة';
  const issuedDate = session?.issued_at?.slice(0, 10) || '--';

  const topBadges = useMemo(
    () => [
      { label: 'الوضع', value: apiConfig.useMocks ? 'تجريبي' : 'حي', tone: apiConfig.useMocks ? 'warning' as const : 'success' as const },
      { label: 'الجلسة', value: statusLabel, tone: statusTone as 'success' | 'info' },
    ],
    [statusLabel, statusTone],
  );

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
    <Screen title={isGuestSession ? 'الاتصال والحساب' : 'الحساب'} subtitle="إدارة الحساب والجلسة والصلاحيات.">
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.avatarWrap}><Text style={styles.avatarText}>{firstLetter}</Text></View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{session?.user?.name || 'مستخدم النظام'}</Text>
            <Text style={styles.heroSubtitle}>{session?.user?.email || (isGuestSession ? 'ربط مباشر بدون بريد حساب' : 'لا يوجد بريد')}</Text>
            <Text style={styles.heroMeta}>الصلاحية: {userRole}</Text>
          </View>
        </View>

        <View style={styles.heroBadgesRow}>
          {topBadges.map((badge) => <InfoPill key={`${badge.label}-${badge.value}`} compact tone={badge.tone} label={badge.label} value={badge.value} />)}
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatBox}><Text style={styles.heroStatValue}>{issuedDate}</Text><Text style={styles.heroStatLabel}>آخر تهيئة</Text></View>
          <View style={styles.heroStatBox}><Text style={styles.heroStatValue}>{apiConfig.useMocks ? 'Mock' : 'Live'}</Text><Text style={styles.heroStatLabel}>المصدر</Text></View>
          <View style={styles.heroStatBox}><Text style={styles.heroStatValue}>{session?.token ? 'موجود' : 'محلي'}</Text><Text style={styles.heroStatLabel}>التوكن</Text></View>
        </View>
      </View>

      <AppCard title="إجراءات الحساب" style={styles.actionsCard}>
        <View style={styles.primaryActionsRow}>
          <ActionTile
            label={refreshing ? 'جارٍ التحديث' : isGuestSession ? 'تحديث الاتصال' : 'تحديث الحساب'}
            icon={refreshing ? 'sync-outline' : 'refresh-outline'}
            onPress={() => void handleRefresh()}
            tone="default"
            disabled={refreshing}
            style={styles.halfAction}
          />
          <ActionTile
            label={changingPassword ? 'جارٍ التغيير' : 'تغيير الرقم السري'}
            icon="key-outline"
            onPress={openPasswordSheet}
            tone="primary"
            disabled={isGuestSession || changingPassword}
            style={styles.halfAction}
          />
        </View>

        {isAdmin ? (
          <View style={styles.primaryActionsRow}>
            <ActionTile
              label="مستخدم جديد"
              icon="person-add-outline"
              onPress={() => router.push('/account/create-user')}
              tone="primary"
              style={styles.halfAction}
            />
            <ActionTile
              label="الحسابات الأخرى"
              icon="people-circle-outline"
              onPress={() => void openAccountsSheet()}
              tone="default"
              disabled={loadingAccounts}
              style={styles.halfAction}
            />
          </View>
        ) : null}

        <ActionTile
          label={signingOut ? 'جارٍ التنفيذ' : isGuestSession ? 'إعادة الجلسة' : 'تسجيل الخروج'}
          icon={isGuestSession ? 'reload-outline' : 'log-out-outline'}
          onPress={() => void handleSignOut()}
          tone="danger"
          disabled={signingOut}
          style={styles.fullAction}
        />

        {(refreshing || signingOut || changingPassword || loadingAccounts) ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loaderText}>يتم تنفيذ العملية الحالية...</Text>
          </View>
        ) : null}
      </AppCard>

      {isAdmin ? (
        <AppCard title="صلاحيات المدير" style={styles.actionsCard}>
          <View style={styles.adminHintRow}>
            <View style={styles.adminIcon}><Ionicons name="shield-checkmark-outline" size={20} color={colors.success} /></View>
            <View style={styles.adminHintTextWrap}>
              <Text style={styles.adminHintTitle}>إنشاء المستخدمين وعرض الحسابات متاح للمدير فقط</Text>
              <Text style={styles.adminHintText}>يمكن إنشاء مستخدم جديد بعد التحقق من رقم الجوال، أو عرض الحسابات المرتبطة وعدد المستخدمين والعملاء.</Text>
            </View>
          </View>
          <View style={styles.adminButtonsRow}>
            <TouchableOpacity style={styles.adminOpenButton} onPress={() => router.push('/account/create-user')} activeOpacity={0.88}>
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.adminOpenText}>إنشاء مستخدم</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminSecondaryButton} onPress={() => void openAccountsSheet()} activeOpacity={0.88}>
              <Ionicons name="open-outline" size={16} color={colors.text} />
              <Text style={styles.adminSecondaryText}>الحسابات الأخرى</Text>
            </TouchableOpacity>
          </View>
        </AppCard>
      ) : null}

      <AccordionSection
        title="معلومات الجلسة"
        subtitle="التوكن والحالة الحالية للجلسة"
        expanded={openSection === 'session'}
        onToggle={() => setOpenSection((prev) => (prev === 'session' ? null : 'session'))}
      >
        <View style={styles.infoList}>
          <View style={styles.infoRow}><Text style={styles.infoValue}>{statusLabel}</Text><Text style={styles.infoLabel}>نوع الجلسة</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoValue}>{issuedDate}</Text><Text style={styles.infoLabel}>وقت التهيئة</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoValue}>{maskToken(session?.token)}</Text><Text style={styles.infoLabel}>التوكن</Text></View>
        </View>
      </AccordionSection>

      <AccordionSection
        title="بيانات الربط"
        subtitle="الخادم والوضع الحالي"
        expanded={openSection === 'connection'}
        onToggle={() => setOpenSection((prev) => (prev === 'connection' ? null : 'connection'))}
      >
        <View style={styles.pillsWrap}>
          <InfoPill compact tone={apiConfig.useMocks ? 'warning' : 'success'} label="بيئة العمل" value={apiConfig.useMocks ? 'تجريبية' : 'حية'} icon={<Ionicons name={apiConfig.useMocks ? 'flask-outline' : 'cloud-done-outline'} size={15} color={apiConfig.useMocks ? colors.warning : colors.success} />} />
          <InfoPill compact tone="info" label="التطبيق" value="Expo Router" icon={<Ionicons name="phone-portrait-outline" size={15} color={colors.info} />} />
        </View>
        <View style={styles.connectionBox}><Text style={styles.connectionLabel}>عنوان الـ API</Text><Text style={styles.connectionValue}>{apiConfig.baseUrl}</Text></View>
      </AccordionSection>

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
  heroCard: { backgroundColor: colors.primary, borderRadius: 28, padding: 18, marginBottom: 12, gap: 14 },
  heroTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  avatarWrap: { width: 62, height: 62, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroTextWrap: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'right' },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.82)', textAlign: 'right' },
  heroMeta: { fontSize: 12, color: 'rgba(255,255,255,0.68)', textAlign: 'right' },
  heroBadgesRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  heroStatsRow: { flexDirection: 'row-reverse', gap: 10 },
  heroStatBox: { flex: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 4 },
  heroStatValue: { fontSize: 13, fontWeight: '900', color: '#fff', textAlign: 'center' },
  heroStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.72)', textAlign: 'center', fontWeight: '700' },
  actionsCard: { marginBottom: 12 },
  primaryActionsRow: { flexDirection: 'row-reverse', gap: 10 },
  halfAction: { flex: 1 },
  fullAction: { width: '100%' },
  loaderRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loaderText: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  adminHintRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  adminIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  adminHintTextWrap: { flex: 1, alignItems: 'flex-end', gap: 4 },
  adminHintTitle: { color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  adminHintText: { color: colors.textMuted, fontSize: 12, lineHeight: 19, textAlign: 'right' },
  adminButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  adminOpenButton: { flex: 1, minHeight: 44, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  adminOpenText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  adminSecondaryButton: { flex: 1, minHeight: 44, borderRadius: 16, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  adminSecondaryText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  infoList: { gap: 12 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  infoValue: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '800', textAlign: 'left' },
  pillsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  connectionBox: { borderRadius: 18, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  connectionLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'right', fontWeight: '700' },
  connectionValue: { fontSize: 13, color: colors.text, textAlign: 'left', fontWeight: '800' },
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
