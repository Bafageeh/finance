import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/utils/theme';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionMode?: 'text' | 'icon';
  scrollable?: boolean;
  rightSlot?: ReactNode;
  compactHeader?: boolean;
}

export function Screen({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  actionIcon = 'add',
  actionMode = 'text',
  scrollable = true,
  rightSlot,
  compactHeader = false,
  children,
}: ScreenProps) {
  const content = (
    <>
      <View style={[styles.header, compactHeader && styles.headerCompact]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerText}>
            <Text style={[styles.title, compactHeader && styles.titleCompact]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, compactHeader && styles.subtitleCompact]}>{subtitle}</Text> : null}
          </View>

          <View style={styles.headerActions}>
            {rightSlot ? rightSlot : null}
            {actionLabel && onActionPress ? (
              actionMode === 'icon' ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={actionLabel}
                  style={[styles.iconActionButton, compactHeader && styles.iconActionButtonCompact]}
                  onPress={onActionPress}
                >
                  <Ionicons name={actionIcon} size={compactHeader ? 18 : 20} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.actionButton} onPress={onActionPress}>
                  <Text style={styles.actionText}>{actionLabel}</Text>
                </TouchableOpacity>
              )
            ) : null}
          </View>
        </View>
      </View>
      {children}
    </>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {scrollable ? (
        <ScrollView contentContainerStyle={styles.content}>{content}</ScrollView>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 16,
  },
  headerCompact: {
    marginBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  titleCompact: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 22,
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
  },
  iconActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  iconActionButtonCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
});
