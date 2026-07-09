import { StyleSheet, Text, View } from 'react-native';
import { Client } from '@/types/api';
import { formatCurrency } from '@/utils/format';
import { colors } from '@/utils/theme';

interface ClientFinancedAmountCardProps {
  client: Client;
}

function money(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric * 100) / 100) : 0;
}

function CalculationRow({ label, value, helper }: { label: string; value: number; helper?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {helper ? <Text style={styles.rowHelper}>{helper}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{formatCurrency(value)}</Text>
    </View>
  );
}

export function ClientFinancedAmountCard({ client }: ClientFinancedAmountCardProps) {
  const summary = client.summary;
  const purchaseCost = money(summary.purchase_cost ?? client.cost);
  const bondCost = money(summary.bond_cost_value ?? client.bond_cost);
  const aliProfit = money(summary.ali_profit_component ?? summary.ali_total);
  const fullFinancedAmount = money(
    summary.full_financed_amount ?? summary.financed_amount ?? purchaseCost + bondCost + aliProfit,
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>المبلغ الممول بالكامل</Text>
          <Text style={styles.subtitle}>معلومة ضمن إحصائيات العميل فقط، ولا تُستخدم حاليًا في حساب الأقساط أو المتبقي.</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>إحصائية</Text>
        </View>
      </View>

      <View style={styles.totalBox}>
        <Text style={styles.totalValue}>{formatCurrency(fullFinancedAmount)}</Text>
        <Text style={styles.totalLabel}>تكلفة الشراء + تكلفة السند + ربح علي إن وجد</Text>
      </View>

      <View style={styles.rowsWrap}>
        <CalculationRow label="تكلفة الشراء" value={purchaseCost} helper="سعر شراء الأصل/السلعة فعليًا." />
        <CalculationRow label="تكلفة السند" value={bondCost} helper="رسوم إنشاء السند أو مجموعة السندات." />
        <CalculationRow label="ربح علي" value={aliProfit} helper="يكون صفرًا إذا كان توزيع الربح لأحمد فقط." />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleWrap: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'right',
  },
  badge: {
    backgroundColor: colors.infoSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.info,
    fontSize: 11,
    fontWeight: '900',
  },
  totalBox: {
    backgroundColor: '#eef7e8',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 5,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.success,
    textAlign: 'right',
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  rowsWrap: {
    gap: 8,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  rowHelper: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'right',
  },
  rowValue: {
    minWidth: 96,
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'left',
  },
});
