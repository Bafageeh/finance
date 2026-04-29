import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@/utils/theme';

interface BottomSheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
}

export function BottomSheet({ visible, onClose, title, subtitle, footer, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.closeButton} accessibilityLabel="إغلاق" onPress={onClose}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    maxHeight: '88%',
    minHeight: 260,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d5d1c8',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 12,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
