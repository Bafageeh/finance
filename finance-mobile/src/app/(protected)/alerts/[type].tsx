import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { alertTypeMeta, AlertRouteType } from '@/constants/alerts';
import { AlertItemCard } from '@/components/AlertItemCard';
import { LateClientCard } from '@/components/LateClientCard';
import { IconButton } from '@/components/IconButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { Screen } from '@/components/Screen';
import { getClients } from '@/services/api';
import { Client } from '@/types/api';
import { AlertEntry, buildAlertEntries, filterAlertEntries } from '@/utils/alerts';
import { getClientAlertInfo, getOverdueScheduleItems } from '@/utils/finance';
import { formatCurrency } from '@/utils/format';
import { colors } from '@/utils/theme';

type SortMode = 'amount' | 'oldest' | 'name';
type SummaryTone = 'info' | 'warning' | 'danger';

const compactSubtitles: Record<AlertRouteType, string> = {
  court: 'العملاء المرتبطون بمتابعة قضائية.',
  late: 'الأقساط المتأخرة المستحقة حتى اليوم.',
  warn: 'الأقساط القادمة خلال 7 أيام.',
  stuck: 'الحالات المتعثرة قبل التحويل القضائي.',
};

const summaryPalette: Record<SummaryTone, { backgroundColor: string; color: string }> = {
  info: { backgroundColor: colors.infoSoft, color: colors.info },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
};

const sortOptions: { key: SortMode; title: string }[] = [
  { key: 'amount', title: 'الأعلى مبلغاً' },
  { key: 'oldest', title: 'الأقدم استحقاقاً' },
  { key: 'name', title: 'الاسم' },
];

function SummaryMetric({
  label, value, tone, large = false,
}: {
  label: string;
  value: string;
  tone: SummaryTone;
  large?: boolean;
}) {
  const palette = summaryPalette[tone];
  return (
    <View style={[styles.summaryMetric, { backgroundColor: palette.backgroundColor }]}>
      <Text
        style={[styles.summaryMetricValue, large && styles.summaryMetricValueLarge, { color: palette.color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.66}
      >{value}</Text>
      <Text style={styles.summaryMetricLabel}>{label}</Text>
    </View>
  );
}

export default function AlertGroupScreen() {
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ type?: string }>();
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('amount');
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState({ top: 85, left: 12 });
  const filterButtonRef = useRef<View>(null);
  const searchInputRef = useRef<TextInput>(null);
  const { width: viewportWidth } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentType: AlertRouteType = params.type && params.type in alertTypeMeta
    ? (params.type as AlertRouteType)
    : 'late';
  const meta = alertTypeMeta[currentType];

  useEffect(() => {
    if (!showSearch) return;
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [showSearch]);

  function toggleSearch() {
    setFilterOpen(false);
    if (showSearch) {
      Keyboard.dismiss();
      setQuery('');
    }
    setShowSearch((current) => !current);
  }

  function toggleFilter() {
    if (filterOpen) {
      setFilterOpen(false);
      return;
    }
    Keyboard.dismiss();
    filterButtonRef.current?.measureInWindow((x, y, width, height) => {
      setFilterAnchor({
        top: y + height + 6,
        left: Math.max(12, Math.min(x + width - 224, viewportWidth - 236)),
      });
      setFilterOpen(true);
    });
  }

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await getClients('all');
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات المتابعة.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) void loadData();
  }, [isFocused, currentType]);

  const entries = useMemo(() => buildAlertEntries(clients, currentType), [clients, currentType]);

  const lateDetails = useMemo(() => {
    const detail = new Map<number, { count: number; dueDate: string | null }>();
    if (currentType !== 'late') return detail;
    entries.forEach((entry) => {
      const overdueInfo = getClientAlertInfo(entry.client);
      const oldest = getOverdueScheduleItems(entry.client)[0];
      detail.set(entry.client.id, {
        count: overdueInfo.overdueCount,
        dueDate: oldest?.due_date || null,
      });
    });
    return detail;
  }, [entries, currentType]);

  const visibleEntries = useMemo(() => {
    const matching = filterAlertEntries(entries, query);
    if (currentType !== 'late') return matching;
    const sorted = [...matching];
    if (sortMode === 'name') {
      sorted.sort((a, b) => a.client.name.localeCompare(b.client.name, 'ar'));
    } else if (sortMode === 'oldest') {
      sorted.sort((a, b) => {
        const firstA = lateDetails.get(a.client.id)?.dueDate || '9999-12-31';
        const firstB = lateDetails.get(b.client.id)?.dueDate || '9999-12-31';
        return firstA.localeCompare(firstB) || Number(b.amount || 0) - Number(a.amount || 0);
      });
    } else {
      sorted.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    }
    return sorted;
  }, [entries, query, currentType, sortMode, lateDetails]);

  const metrics = useMemo(() => {
    const amountTotal = visibleEntries.reduce((sum, entry) => sum + (entry.amount ?? entry.client.summary.remaining_amount), 0);
    const contractsTotal = visibleEntries.reduce((sum, entry) => sum + Number(entry.client.summary.remaining_amount || 0), 0);
    return { count: visibleEntries.length, amountTotal, contractsTotal };
  }, [visibleEntries]);

  function openClient(entry: AlertEntry) {
    router.push({
      pathname: '/clients/[id]',
      params: {
        id: String(entry.client.id),
        ...(entry.focusPeriod ? { focusPeriod: entry.focusPeriod } : {}),
      },
    });
  }

  return (
    <Screen
      title={meta.title}
      subtitle={compactSubtitles[currentType]}
      scrollable={false}
      compactHeader
      rightSlot={
        <View style={styles.headerTools}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={showSearch ? 'إخفاء البحث' : 'إظهار البحث'}
            accessibilityState={{ expanded: showSearch }}
            style={[styles.headerIcon, showSearch && styles.headerIconSelected]}
            onPress={toggleSearch}
          >
            <Ionicons name="search-outline" size={19} color={showSearch ? colors.info : colors.text} />
          </TouchableOpacity>
          {currentType === 'late' ? (
            <View ref={filterButtonRef} collapsable={false}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="ترتيب المتأخرين"
                accessibilityState={{ expanded: filterOpen }}
                style={[styles.headerIcon, filterOpen && styles.headerIconSelected]}
                onPress={toggleFilter}
              >
                <Ionicons name="options-outline" size={20} color={filterOpen ? colors.info : colors.text} />
              </TouchableOpacity>
            </View>
          ) : null}
          <IconButton icon="arrow-back" accessibilityLabel="رجوع" size="sm" onPress={() => router.back()} />
        </View>
      }
    >
      <View style={styles.body}>
        {showSearch ? (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={19} color={colors.textMuted} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث بالاسم أو الهوية أو الجوال"
              placeholderTextColor="#998d7b"
              textAlign="right"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="مسح البحث"
                onPress={() => setQuery('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={19} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {!loading && !error ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeaderRow}>
              <Text style={styles.summaryTitle}>
                {currentType === 'late' ? 'ملخص المتأخرات' : 'ملخص الحالات'}
              </Text>
              {query.trim() ? (
                <Text style={styles.summaryHint}>يعرض {metrics.count} من {entries.length}</Text>
              ) : null}
            </View>
            <View style={styles.summaryGrid}>
              <SummaryMetric
                label={currentType === 'late' ? 'العملاء المتأخرون' : 'الحالات'}
                value={String(metrics.count)}
                tone="info"
                large
              />
              <SummaryMetric
                label={currentType === 'late' ? 'الأقساط المتأخرة' : 'إجمالي المبالغ'}
                value={formatCurrency(metrics.amountTotal)}
                tone="warning"
              />
            </View>
            <View style={styles.contractsRow}>
              <Text style={styles.contractsLabel}>المتبقي من إجمالي عقود هؤلاء العملاء</Text>
              <Text style={styles.contractsValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {formatCurrency(metrics.contractsTotal)}
              </Text>
            </View>
          </View>
        ) : null}

        {currentType === 'court' ? (
          <TouchableOpacity style={styles.courtLink} onPress={() => router.push('/cases')} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={16} color={colors.court} />
            <Text style={styles.courtLinkText}>فتح مركز القضايا</Text>
          </TouchableOpacity>
        ) : null}

        <FlatList
          style={styles.list}
          data={loading || error ? [] : visibleEntries}
          keyExtractor={(entry) => `${currentType}-${entry.client.id}`}
          renderItem={({ item }) => currentType === 'late' ? (
            <LateClientCard
              entry={item}
              overdueCount={lateDetails.get(item.client.id)?.count || 0}
              firstDueDate={lateDetails.get(item.client.id)?.dueDate}
              onPress={() => openClient(item)}
            />
          ) : (
            <AlertItemCard
              tone={item.tone}
              title={item.title}
              description={item.description}
              amountText={item.amount != null ? formatCurrency(item.amount) : undefined}
              onPress={() => openClient(item)}
            />
          )}
          ListEmptyComponent={loading ? <LoadingBlock /> : error ? (
            <AppCard title="تعذر التحميل"><Text style={styles.errorText}>{error}</Text></AppCard>
          ) : (
            <EmptyState
              title={query.trim() ? 'لا توجد نتائج مطابقة' : meta.emptyTitle}
              description={query.trim() ? 'جرّب اسماً أو رقم هوية أو جوالاً آخر.' : meta.emptyDescription}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} />}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
        <Modal
          visible={filterOpen && currentType === 'late'}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setFilterOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)}>
            <Pressable
              style={[styles.filterMenu, { top: filterAnchor.top, left: filterAnchor.left }]}
              onPress={(event) => event.stopPropagation()}
            >
              <Text style={styles.filterMenuTitle}>ترتيب المتأخرين</Text>
              {sortOptions.map((option) => {
                const selected = sortMode === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.filterMenuItem, selected && styles.filterMenuItemSelected]}
                    onPress={() => {
                      setSortMode(option.key);
                      setFilterOpen(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterMenuText, selected && styles.filterMenuTextSelected]}>
                      {option.title}
                    </Text>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={selected ? colors.info : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0, gap: 10 },
  searchWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 8,
    minHeight: 44,
  },
  clearButton: { padding: 4 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  summaryHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: { color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  summaryHint: { color: colors.textMuted, fontSize: 11 },
  summaryGrid: { flexDirection: 'row-reverse', gap: 9 },
  summaryMetric: {
    flex: 1,
    minWidth: 0,
    minHeight: 69,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 5,
  },
  summaryMetricValue: { fontSize: 17, fontWeight: '900', textAlign: 'right' },
  summaryMetricValueLarge: { fontSize: 23 },
  summaryMetricLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'right' },
  contractsRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  contractsLabel: { flex: 1, textAlign: 'right', color: colors.textMuted, fontSize: 11 },
  contractsValue: { maxWidth: '49%', fontSize: 13, fontWeight: '900', color: colors.danger },
  headerTools: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  headerIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconSelected: { backgroundColor: colors.infoSoft, borderColor: '#bcd5ef' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.12)' },
  filterMenu: {
    position: 'absolute', width: 224,
    backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: 16, padding: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16, shadowRadius: 12,
  },
  filterMenuTitle: {
    fontSize: 12, fontWeight: '800', color: colors.textMuted,
    textAlign: 'right', paddingHorizontal: 10, paddingVertical: 8,
  },
  filterMenuItem: {
    minHeight: 43, flexDirection: 'row-reverse',
    alignItems: 'center', justifyContent: 'space-between',
    gap: 8, borderRadius: 10, paddingHorizontal: 10,
  },
  filterMenuItemSelected: { backgroundColor: colors.infoSoft },
  filterMenuText: { color: colors.text, fontSize: 13, textAlign: 'right', fontWeight: '600' },
  filterMenuTextSelected: { color: colors.info, fontWeight: '800' },
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingBottom: 50, paddingTop: 2, flexGrow: 1 },
  courtLink: {
    backgroundColor: colors.courtSoft,
    borderRadius: 12,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  courtLinkText: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '800', color: colors.court },
  errorText: { color: colors.danger, textAlign: 'right', lineHeight: 24 },
});
