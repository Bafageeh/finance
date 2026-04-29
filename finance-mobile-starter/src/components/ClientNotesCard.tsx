import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { Client } from '@/types/api';
import { colors } from '@/utils/theme';

interface ClientNotesCardProps {
  client: Client;
}

export function ClientNotesCard({ client }: ClientNotesCardProps) {
  const notes = client.notes?.trim();

  return (
    <AppCard title="ملاحظات العميل">
      <View style={styles.cardBody}>
        <View style={styles.iconWrap}>
          <Ionicons name="reader-outline" size={18} color={notes ? colors.info : colors.textMuted} />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.noteText}>{notes || 'لا توجد ملاحظات مسجلة لهذا العميل.'}</Text>
          {!notes ? <Text style={styles.hintText}>يمكن إضافة الملاحظات من زر تعديل العميل أعلى الصفحة.</Text> : null}
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 6,
  },
  noteText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'right',
    fontWeight: '700',
  },
  hintText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
});
