import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Client } from '@/types/api';
import { buildClientFinancialAudit, FinancialAuditIssue, FinancialAuditSeverity } from '@/utils/client-audit';
import { formatCurrency, formatDate } from '@/utils/format';
import { colors } from '@/utils/theme';

interface ClientFinancialAuditCardProps {
  client: Client;
  defaultExpanded?: boolean;
}

function severityPalette(severity: FinancialAuditSeverity) {
  if (severity === 'danger') {
    return {
      background: '#fff3f3',
      border: '#f0c6c6',
      text: colors.danger,
      badge: 'خطأ',
    };
  }

  if (severity === 'warning') {
    return {
      background: '#fff8e8',
      border: '#ead7a9',
      text: '#9a6400',
      badge: 'تنبيه',
    };
  }

  return {
    background: '#eef9f1',
    border: '#c8ead2',
    text: colors.success,
    badge: 'سليم',
  };
}

function dateText(value: string | null | undefined): string {
  return value ? formatDate(value) : '—';
}

function MetricBox({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return (
    <View style={[styles.metricBox, tone !== 'default' ? styles[`${tone}Metric` as const] : null]}>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function AuditIssueRow({ issue }: { issue: FinancialAuditIssue }) {
  const palette = severityPalette(issue.severity);

  return (
    <View style={[styles.issueRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.issueBadge}>
        <Text style={[styles.issueBadgeText, { color: palette.text }]}>{palette.badge}</Text>
      </View>
      <View style={styles.issueTextWrap}>
        <Text style={styles.issueTitle}>{issue.title}</Text>
        <Text style={styles.issueDescription}>{issue.description}</Text>
      </View>
    </View>
  );
}

export function ClientFinancialAuditCard({ client, defaultExpanded = false }: ClientFinancialAuditCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const audit = useMemo(() => buildClientFinancialAudit(client), [client]);
  const palette = severityPalette(audit.status);
  const issueCount = audit.issues.length;
  const noteCount = audit.notes.length;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} activeOpacity={0.85} onPress={() => setExpanded((current) => !current)}>
        <View style={[styles.statusBadge, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.statusText, { color: palette.text }]}>{audit.statusLabel}</Text>
        </View>

        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>تدقيق مالي للعميل</Text>
          <Text style={styles.subtitle}>
            {issueCount > 0
              ? `${issueCount} ملاحظة حسابية تحتاج مراجعة`
              : noteCount > 0
                ? `${noteCount} تنبيه تحصيلي بدون خطأ حسابي`
                : 'الأرقام متطابقة مع جدول الأقساط الحالي'}
          </Text>
        </View>

        <View style={styles.chevronCircle}>
          <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          <View style={styles.metricGrid}>
            <MetricBox label="قيمة السند" value={formatCurrency(audit.metrics.bondTotal)} />
            <MetricBox label="المدفوع الفعلي" value={formatCurrency(audit.metrics.schedulePaidAmount)} tone="success" />
            <MetricBox label="المتبقي المعروض" value={formatCurrency(audit.metrics.summaryRemainingAmount)} />
            <MetricBox label="المتبقي المحسوب" value={formatCurrency(audit.metrics.computedRemainingAmount)} tone={Math.abs(audit.metrics.remainingDifference) > 0.05 ? 'danger' : 'success'} />
            <MetricBox label="أول قسط" value={dateText(audit.metrics.firstVisibleDueDate)} />
            <MetricBox label="آخر قسط" value={dateText(audit.metrics.lastVisibleDueDate)} />
          </View>

          <View style={styles.compactStatsRow}>
            <Text style={styles.compactStat}>مدفوع: {audit.metrics.paidCount}/{audit.metrics.expectedMonths}</Text>
            <Text style={styles.compactStat}>جزئي: {audit.metrics.partialCount}</Text>
            <Text style={styles.compactStat}>متأخر: {audit.metrics.overdueCount}</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.auditRows}>
            {audit.issues.length ? (
              audit.issues.map((issue) => <AuditIssueRow key={issue.key} issue={issue} />)
            ) : (
              <AuditIssueRow
                issue={{
                  key: 'clean',
                  severity: 'ok',
                  title: 'لا توجد فروقات حسابية ظاهرة',
                  description: 'المدفوع والمتبقي وبداية جدول الأقساط متطابقة مع البيانات الحالية للعميل.',
                }}
              />
            )}

            {audit.notes.map((issue) => <AuditIssueRow key={issue.key} issue={issue} />)}
          </View>

          <Text style={styles.footnote}>
            هذا التدقيق لا يغير الحسابات، بل يكشف الفروقات بين ملخص العميل وجدول الأقساط الظاهر بعد آخر تحديث.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 19,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  chevronCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f3ef',
  },
  chevron: {
    fontSize: 26,
    color: colors.textMuted,
    lineHeight: 28,
  },
  body: {
    gap: 12,
  },
  metricGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 82,
    borderRadius: 18,
    backgroundColor: '#f8f7f4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 7,
  },
  successMetric: {
    backgroundColor: '#edf8e8',
  },
  warningMetric: {
    backgroundColor: '#fff8e8',
  },
  dangerMetric: {
    backgroundColor: '#fff0f0',
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 17,
  },
  compactStatsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactStat: {
    backgroundColor: '#f6f4ef',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  auditRows: {
    gap: 8,
  },
  issueRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  issueBadge: {
    minWidth: 52,
    alignItems: 'center',
  },
  issueBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  issueTextWrap: {
    flex: 1,
    gap: 4,
  },
  issueTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  issueDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
  },
});
