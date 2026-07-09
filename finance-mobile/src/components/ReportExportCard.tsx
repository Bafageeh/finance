import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ReportDocument } from '@/types/report';
import { colors } from '@/utils/theme';

interface ReportExportCardProps {
  report: ReportDocument;
  onExportPdf: () => void;
  onExportExcel: () => void;
}

export function ReportExportCard({ report, onExportPdf, onExportExcel }: ReportExportCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={report.kind === 'smart_collection' ? 'sparkles-outline' : 'document-text-outline'} size={20} color={colors.primary} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.subtitle}>{report.subtitle}</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        {report.summary.slice(0, 3).map((item) => (
          <View key={`${report.kind}-${item.label}`} style={styles.summaryItem}>
            <Text style={styles.summaryValue} numberOfLines={1}>{item.value}</Text>
            <Text style={styles.summaryLabel} numberOfLines={1}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.rowsText}>{report.rows.length} سجل</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.button, styles.pdfButton]} onPress={onExportPdf} activeOpacity={0.88}>
            <Ionicons name="document-outline" size={15} color="#fff" />
            <Text style={styles.buttonText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.excelButton]} onPress={onExportExcel} activeOpacity={0.88}>
            <Ionicons name="grid-outline" size={15} color="#fff" />
            <Text style={styles.buttonText}>Excel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'right',
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 3,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'right',
  },
  footerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  button: {
    minHeight: 36,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  pdfButton: {
    backgroundColor: colors.danger,
  },
  excelButton: {
    backgroundColor: colors.success,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
});
