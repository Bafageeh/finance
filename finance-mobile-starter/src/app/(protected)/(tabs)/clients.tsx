import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View, TouchableOpacity} from 'react-native';
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

export default function ClientsScreen() {
  const isFocused = useIsFocused();

  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [showDoneClients, setShowDoneClients] = useState(false);
  const [query, setQuery] = useState('');
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
          const source = client as unknown as unknown as Record<string, unknown>;
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
      </View>
    </View>
  );

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
          data={displayClients}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ClientListItem
              client={item}
              onPress={() => router.push(`/clients/${item.id}`)}
            />
          )}
          ListHeaderComponent={listHeader}
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
                void loadData(true);
              }}
            />
          }
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