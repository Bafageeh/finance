import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { clientFilterOrder } from '@/constants/finance';
import { ClientFilter } from '@/types/api';
import { filterLabel } from '@/utils/format';
import { colors } from '@/utils/theme';

interface FilterChipsProps {
  value: ClientFilter;
  onChange: (next: ClientFilter) => void;
  compact?: boolean;
}

export function FilterChips({ value, onChange, compact = false }: FilterChipsProps) {
  const content = (
    <>
      {clientFilterOrder.map((filter) => {
        const isActive = filter === value;
        return (
          <TouchableOpacity
            key={filter}
            style={[styles.chip, compact && styles.compactChip, isActive && styles.activeChip]}
            onPress={() => onChange(filter)}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, compact && styles.compactChipText, isActive && styles.activeChipText]}>
              {filterLabel(filter)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollRow}
        style={styles.scrollView}
      >
        <View style={[styles.row, styles.rowCompact]}>{content}</View>
      </ScrollView>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  scrollView: {
    marginHorizontal: -2,
  },
  scrollRow: {
    paddingHorizontal: 2,
  },
  row: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  rowCompact: {
    gap: 6,
    marginBottom: 0,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surfaceMuted,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  compactChipText: {
    fontSize: 11,
  },
  activeChipText: {
    color: '#fff',
  },
});
