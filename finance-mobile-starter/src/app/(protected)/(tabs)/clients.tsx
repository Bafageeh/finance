import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClientListItem } from '@/components/ClientListItem';
import { ClientFilterDropdown } from '@/components/ClientFilterDropdown';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { Screen } from '@/components/Screen';
import { getClients } from '@/services/api';
import { Client, ClientFilter } from '@/types/api';
import { clientMatchesSearch } from '@/utils/format';
import { getClientAlertInfo } from '@/utils/finance';
import { colors } from '@/utils/theme';

const CLIENTS_PAGE_SIZE = 5;
const LOAD_MORE_DISTANCE = 220;

export default function ClientsScreen() {
  const isFocused = useIsFocused();
  const loadMoreLockRef = useRef(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [showDoneClients, setShowDoneClients] = useState(false);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(CLIENTS_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(silent = false, customFilter = filter) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const requestFilter = customFilter === 'late' ? 'all' : customFilter;
      const data = await getClients(requestFilter);
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل العملاء.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      void loadData(false, filter);
    }
  }, [isFocused, filter]);

  const filteredClients = useMemo(
    () =>
      clients.filter((client) => {
        if (!clientMatchesSearch(client, query)) return false;
        if (filter === 'late') return getClientAlertInfo(client).overdueCount > 0;
        return true;
      }),
    [clients, filter, query],
  );

  const sortedFilteredClients = useMemo(
    () =>
      [...filteredClients].sort((a, b) => {
        const getTime = (client: typeof filteredClients[number]) => {
          const source = client as unknown as Record<string, unknown>;
          const raw = source.contract_date ?? source.created_at ?? source.updated_at;

          if (typeof raw === 'string' && raw.trim().length > 0) {
            const timestamp = Date.parse(raw);
            if (Number.isFinite(timestamp)) return timestamp;
          }

          const id = source.id;
          if (typeof id === 'number') return id;
          if (typeof id === 'string') {
            const numericId = Number(id);
            if (Number.isFinite(numericId)) return numericId;
          }

          return 0;
        };

        return getTime(b) - getTime(a);
      }),
    [filteredClients],
  );

  const completedClients = useMemo(
    () => sortedFilteredClients.filter((client) => client.status === 'done'),
    [sortedFilteredClients],
  );

  const displayClients = useMemo(
    () => {
      if (filter === 'done' || showDoneClients) return sortedFilteredClients;
      return sortedFilteredClients.filter((client) => client.status !== 'done');
    },
    [filter, showDoneClients, sortedFilteredClients],
  );

  useEffect(() => {
    loadMoreLockRef.current = false;
    setVisibleCount(CLIENTS_PAGE_SIZE);
  }, [clients, filter, query, showDoneClients]);

  const visibleClients = useMemo(
    () => displayClients.slice(0, visibleCount),
    [displayClients, visibleCount],
  );

  const hasMoreClients = visibleClients.length < displayClients.length;

  const loadMoreClients = useCallback(() => {
    if (loadMoreLockRef.current) return;

    setVisibleCount((current) => {
      if (current >= displayClients.length) return current;

      loadMoreLockRef.current = true;
      setTimeout(() => {
        loadMoreLockRef.current = false;
      }, 180);

      return Math.min(current + CLIENTS_PAGE_SIZE, displayClients.length);
    });
  }, [displayClients.length]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasMoreClients) return;

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const reachedBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - LOAD_MORE_DISTANCE;

      if (reachedBottom) {
        loadMoreClients();
      }
    },
    [hasMoreClients, loadMoreClients],
  );

  const listHeader = (
    <View style={styles.headerStack}>
      <View style={styles.searchRow}>
        <ClientFilterDropdown value={filter} onChange={setFilter} />

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={22} color="#6f6962" />
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="بحث باسم العميل أو الجوال"
            placeholderTextColor="#a09990"
            textAlign="right"
            returnKeyType="search"
          />
          {query ? (
            <Ionicons
              name="close-circle"
              size={18}
              color="#9c9387"
              onPress={() => setQuery('')}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>إجمالي {clients.length}</Text>
        <View style={styles.dot} />
        <Text style={styles.summaryText}>ظاهر {displayClients.length}</Text>
        <View style={styles.dot} />
        <Text style={styles.summaryText}>محمل {visibleClients.length}</Text>
      </View>
    </View>
  );

  const listFooter = hasMoreClients ? (
    <View style={styles.loadMoreHint}>
      <Text style={styles.loadMoreText}>انزل لأسفل لتحميل ٥ عملاء إضافيين</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.loadMoreButton}
        onPress={loadMoreClients}
      >
        <Ionicons name="chevron-down" size={16} color="#111" />
        <Text style={styles.loadMoreButtonText}>تحميل المزيد الآن</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <Screen
      title="العملاء"
      actionLabel="إضافة عميل"
      actionMode="icon"
      actionIcon="add"
      onActionPress={() => router.push('/clients/form')}
      scrollable={false}
      compactHeader
      rightSlot={
        <View style={styles.headerAvatar}>
          <Ionicons name="people" size={18} color="#0b6d3b" />
        </View>
      }
    >
      {loading ? <LoadingBlock /> : null}

      {!loading && error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>تعذر تحميل العملاء</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        <FlatList
          data={visibleClients}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ClientListItem
              client={item}
              onPress={() => router.push(`/clients/${item.id}`)}
            />
          )}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              title="لا توجد نتائج"
              description="جرّب تغيير الفلتر أو تعديل عبارة البحث."
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setVisibleCount(CLIENTS_PAGE_SIZE);
                void loadData(true);
              }}
            />
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={loadMoreClients}
          onEndReachedThreshold={0.08}
          initialNumToRender={CLIENTS_PAGE_SIZE}
          maxToRenderPerBatch={CLIENTS_PAGE_SIZE}
          windowSize={5}
          updateCellsBatchingPeriod={80}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  completedAccordion: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E0D8',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  completedAccordionContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  completedAccordionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'right',
  },
  completedAccordionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#7A746C',
    textAlign: 'right',
  },
  completedAccordionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4F1ED',
    color: '#111111',
    fontSize: 24,
    lineHeight: 40,
    textAlign: 'center',
    overflow: 'hidden',
    marginLeft: 12,
  },

  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ea',
    borderWidth: 1,
    borderColor: '#e5e1d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStack: {
    gap: 10,
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    minHeight: 50,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e7e1d8',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  search: {
    flex: 1,
    color: '#222',
    fontSize: 15,
    paddingVertical: 0,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  summaryText: {
    color: '#6b645c',
    fontSize: 13,
    fontWeight: '800',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#b8afa4',
  },
  listContent: {
    paddingBottom: 90,
  },
  loadMoreHint: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  loadMoreText: {
    color: '#8d8579',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadMoreButton: {
    minHeight: 40,
    borderRadius: 18,
    backgroundColor: '#f4f1ed',
    borderWidth: 1,
    borderColor: '#e0d9cf',
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  loadMoreButtonText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '800',
  },
  separator: {
    height: 10,
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ece6dd',
    padding: 14,
    gap: 6,
  },
  errorTitle: {
    color: colors.text,
    textAlign: 'right',
    fontWeight: '800',
    fontSize: 15,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 22,
  },
});
