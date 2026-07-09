import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { clientFilterOrder } from '@/constants/finance';
import { ClientFilter } from '@/types/api';
import { colors } from '@/utils/theme';

interface ClientFilterDropdownProps {
  value: ClientFilter;
  onChange: (next: ClientFilter) => void;
}

type AnchorState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const labelByFilter: Record<ClientFilter, string> = {
  all: 'الكل',
  active: 'نشط',
  late: 'متأخر',
  stuck: 'متعثر',
  court: 'قضية',
  done: 'منتهي',
};

const iconByFilter: Record<ClientFilter, keyof typeof Ionicons.glyphMap> = {
  all: 'grid-outline',
  active: 'checkmark-circle',
  late: 'time-outline',
  stuck: 'warning',
  court: 'document-text-outline',
  done: 'flag-outline',
};

const iconColorByFilter: Record<ClientFilter, string> = {
  all: '#0f6d3e',
  active: '#17854a',
  late: '#B45309',
  stuck: '#ef8f00',
  court: '#2f6dff',
  done: '#d83a2e',
};

export function ClientFilterDropdown({ value, onChange }: ClientFilterDropdownProps) {
  const triggerRef = useRef<View>(null);
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<AnchorState>({
    x: 16,
    y: 100,
    width: 120,
    height: 46,
  });

  const options = useMemo(
    () =>
      clientFilterOrder.map((filter) => ({
        value: filter,
        label: labelByFilter[filter],
      })),
    [],
  );

  const activeLabel = labelByFilter[value];

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  };

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <TouchableOpacity style={styles.trigger} activeOpacity={0.92} onPress={openMenu}>
          <Ionicons name="chevron-down" size={16} color="#fff" />
          <Text style={styles.triggerText} numberOfLines={1}>
            {activeLabel}
          </Text>
          <Ionicons name={iconByFilter[value]} size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable
            style={[
              styles.menu,
              {
                top: anchor.y + anchor.height + 8,
                left: anchor.x,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {options.map((option, index) => {
              const active = option.value === value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    index < options.length - 1 && styles.optionBorder,
                    active && styles.optionActive,
                  ]}
                  activeOpacity={0.9}
                  onPress={() => {
                    onChange(option.value);
                    setVisible(false);
                  }}
                >
                  <View style={styles.optionLeft}>
                    {active ? (
                      <View style={styles.checkWrap}>
                        <Ionicons name="checkmark" size={15} color="#17854a" />
                      </View>
                    ) : (
                      <View style={styles.checkPlaceholder} />
                    )}
                  </View>

                  <View style={styles.optionRight}>
                    <Ionicons
                      name={iconByFilter[option.value]}
                      size={20}
                      color={iconColorByFilter[option.value]}
                    />
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {option.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.footerDivider} />

            <View style={styles.footerRow}>
              <Ionicons name="options-outline" size={18} color={colors.textMuted} />
              <Text style={styles.footerText}>فلترة العملاء</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 114,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#121212',
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  triggerText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  menu: {
    position: 'absolute',
    width: 230,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ebe6de',
    paddingTop: 8,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  option: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionActive: {
    backgroundColor: '#f7f8f5',
  },
  optionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1ede6',
  },
  optionLeft: {
    width: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  optionRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2d2926',
    textAlign: 'right',
  },
  optionTextActive: {
    color: '#111',
  },
  checkWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e9f6ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPlaceholder: {
    width: 26,
    height: 26,
  },
  footerDivider: {
    height: 1,
    backgroundColor: '#f1ede6',
    marginTop: 6,
    marginBottom: 8,
    marginHorizontal: 14,
  },
  footerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    minHeight: 38,
  },
  footerText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 14,
  },
});