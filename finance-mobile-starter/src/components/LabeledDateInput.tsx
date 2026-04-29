import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/utils/theme';

interface LabeledDateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return new Date();
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function LabeledDateInput({ label, value, onChange, hint }: LabeledDateInputProps) {
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const selectedDate = useMemo(() => parseDate(value), [value]);

  function handlePickedDate(_: DateTimePickerEvent, pickedDate?: Date) {
    if (pickedDate) {
      onChange(formatDate(pickedDate));
    }
  }

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        is24Hour: true,
        onChange: handlePickedDate,
      });
      return;
    }

    setShowIOSPicker((current) => !current);
  }

  function useToday() {
    onChange(formatDate(new Date()));
    if (Platform.OS === 'ios') {
      setShowIOSPicker(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <Pressable style={styles.field} onPress={openPicker}>
        <View style={styles.fieldContent}>
          <Text style={styles.fieldTitle}>{value || 'اختر التاريخ'}</Text>
          <Text style={styles.fieldSubtitle}>فتح التقويم</Text>
        </View>
        <Text style={styles.calendarIcon}>📅</Text>
      </Pressable>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {Platform.OS === 'ios' && showIOSPicker ? (
        <View style={styles.pickerCard}>
          <DateTimePicker value={selectedDate} mode="date" display="spinner" onChange={handlePickedDate} />

          <View style={styles.pickerActions}>
            <TouchableOpacity style={styles.secondaryAction} onPress={useToday}>
              <Text style={styles.secondaryActionText}>اليوم</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryAction} onPress={() => setShowIOSPicker(false)}>
              <Text style={styles.primaryActionText}>تم</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  field: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldContent: {
    flex: 1,
    gap: 4,
  },
  fieldTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  fieldSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  calendarIcon: {
    fontSize: 20,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  pickerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  pickerActions: {
    flexDirection: 'row-reverse',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: colors.infoSoft,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: colors.info,
    fontWeight: '800',
  },
});
