import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { addOneMonthToDateOnly, formatDateOnly, isDateOnlyBefore } from '../../../utils/financeDateRules';
import { Ionicons } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { bondOptions, profitShareOptions } from '@/constants/finance';
import { AccordionSection } from '@/components/AccordionSection';
import { IconButton } from '@/components/IconButton';
import { LabeledDateInput } from '@/components/LabeledDateInput';
import { LabeledInput } from '@/components/LabeledInput';
import { LoadingBlock } from '@/components/LoadingBlock';
import { Screen } from '@/components/Screen';
import { createClient, getClient, updateClient } from '@/services/api';
import { ProfitShare } from '@/types/api';
import { computeBondTotal, computeMonthlyInstallment, getProfitSharePercentages } from '@/utils/finance';
import { formatCurrency, profitShareLabel } from '@/utils/format';
import { colors } from '@/utils/theme';
function clientDateOnly(value?: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(String(value).slice(0, 10));

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addOneMonthDateString(value?: string | null): string {
  const normalized = clientDateOnly(value);
  const base = normalized ? new Date(normalized) : new Date();

  if (Number.isNaN(base.getTime())) {
    return '';
  }

  const day = base.getDate();
  base.setHours(0, 0, 0, 0);
  base.setDate(1);
  base.setMonth(base.getMonth() + 1);
  base.setDate(Math.min(day, 28));

  return clientDateOnly(base.toISOString());
}

function isDateBefore(left?: string | null, right?: string | null): boolean {
  const normalizedLeft = clientDateOnly(left);
  const normalizedRight = clientDateOnly(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft < normalizedRight;
}

function normalizeFirstInstallmentForForm(contractDate?: string | null, firstInstallmentDate?: string | null): string {
  const contract = clientDateOnly(contractDate);
  const first = clientDateOnly(firstInstallmentDate);

  if (!contract) {
    return first;
  }

  if (!first || isDateBefore(first, contract)) {
    return addOneMonthDateString(contract);
  }

  return first;
}

const today = new Date().toISOString().slice(0, 10);

type SectionKey = 'basic' | 'finance' | 'profit' | 'preview';

type BondCostMode = 'preset' | 'custom';

function parseBondCostAmount(value: string | number | null | undefined): number {
  const amount = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function isSameBondCost(value: string | number | null | undefined, expected: number): boolean {
  return Math.abs(parseBondCostAmount(value) - expected) < 0.01;
}

function resolveBondCostMode(value: string | number | null | undefined): BondCostMode {
  const amount = parseBondCostAmount(value);
  return [0, 74.75, 126.5].some((preset) => Math.abs(amount - preset) < 0.01) ? 'preset' : 'custom';
}

export default function ClientFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const isEdit = Boolean(params.id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [asset, setAsset] = useState('');
  const [contractDate, setContractDate] = useState(today);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState('');
  const [cost, setCost] = useState('0');
  // finance-date-isolation-v17-start
  const handleContractDateChange = (value: string | Date) => {
    const nextContractDate = formatDateOnly(value);

    if (!nextContractDate) {
      return;
    }

    setContractDate(nextContractDate);

    setFirstInstallmentDate((currentValue) => {
      const currentFirstInstallmentDate = formatDateOnly(currentValue || '');

      if (!isEdit) {
        return addOneMonthToDateOnly(nextContractDate);
      }

      if (!currentFirstInstallmentDate || isDateOnlyBefore(currentFirstInstallmentDate, nextContractDate)) {
        return addOneMonthToDateOnly(nextContractDate);
      }

      return currentFirstInstallmentDate;
    });
  };

  const handleFirstInstallmentDateChange = (value: string | Date) => {
    const nextFirstInstallmentDate = formatDateOnly(value);
    const currentContractDate = formatDateOnly(contractDate || '');

    if (!nextFirstInstallmentDate) {
      return;
    }

    if (currentContractDate && isDateOnlyBefore(nextFirstInstallmentDate, currentContractDate)) {
      Alert.alert('تنبيه', 'تاريخ أول قسط لا يمكن أن يكون أقدم من تاريخ العقد.');
      return;
    }

    setFirstInstallmentDate(nextFirstInstallmentDate);
  };
  // finance-date-isolation-v17-end

  // finance-first-installment-persist-v19-start
  React.useEffect(() => {
    if (!isEdit || loading) {
      return;
    }

    const normalizedContractDate = formatDateOnly(contractDate || '');

    if (!firstInstallmentDate && normalizedContractDate) {
      setFirstInstallmentDate(addOneMonthToDateOnly(normalizedContractDate));
    }
  }, [isEdit, loading, contractDate, firstInstallmentDate]);
  // finance-first-installment-persist-v19-end

  const [principal, setPrincipal] = useState('0');
  const [rate, setRate] = useState('0');
  const [months, setMonths] = useState('12');
  const [bondCost, setBondCost] = useState('74.75');
  const [bondCostMode, setBondCostMode] = useState<BondCostMode>('preset');
  const [bondTotal, setBondTotal] = useState('');
  const [profitShare, setProfitShare] = useState<ProfitShare>('shared');
  const [status, setStatus] = useState<'active' | 'stuck' | 'done'>('active');
  const [hasCourt, setHasCourt] = useState(false);
  const [courtNote, setCourtNote] = useState('');
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    basic: true,
    finance: true,
    profit: false,
    preview: true,
  });

  useEffect(() => {
    async function loadClient() {
      if (!isEdit || !params.id) return;

      try {
        setLoading(true);
        const client = await getClient(params.id);
        setName(client.name);
        setIdNumber(client.id_number || '');
        setPhone(client.phone || '');
        setAsset(client.asset || '');
        setContractDate(client.contract_date?.slice(0, 10) || today);
        const loadedFirstInstallmentDateV19 = formatDateOnly((client as any).first_installment_date || (client as any).firstInstallmentDate || '');
        setFirstInstallmentDate(
          loadedFirstInstallmentDateV19 ||
            addOneMonthToDateOnly(formatDateOnly((client as any).contract_date || contractDate || today))
        );
        setCost(String(client.cost || 0));
        setPrincipal(String(client.principal || client.cost || 0));
        setRate(String(client.rate || 0));
        setMonths(String(client.months || 12));
        const loadedBondCost = String(client.bond_cost ?? 74.75);
        setBondCost(loadedBondCost);
        setBondCostMode(resolveBondCostMode(loadedBondCost));
        setBondTotal(client.bond_total ? String(client.bond_total) : '');
        setProfitShare(client.profit_share || 'shared');
        setStatus(client.status);
        setHasCourt(client.has_court);
        setCourtNote(client.court_note || '');
        setNotes(client.notes || '');
      } catch (err) {
        Alert.alert('تعذر تحميل العميل', err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
      } finally {
        setLoading(false);
      }
    }

    if (isFocused) {
      void loadClient();
    }
  }, [isFocused, isEdit, params.id]);
  const numericValues = useMemo(() => {
    const parsedCost = Number(cost) || 0;
    const parsedPrincipal = Number(principal) || parsedCost;
    const parsedRate = Number(rate) || 0;
    const parsedMonths = Number(months) || 0;
    const parsedBondCost = parseBondCostAmount(bondCost);
    const parsedBondTotal = bondTotal.trim() ? Number(bondTotal) : null;
    const computedBondTotal = computeBondTotal(parsedCost, parsedRate, parsedMonths, parsedBondCost, parsedBondTotal);
    const computedMonthly = computeMonthlyInstallment(parsedCost, parsedRate, parsedMonths, parsedBondCost, parsedBondTotal);
    const totalProfit = Math.max(0, computedBondTotal - parsedCost - parsedBondCost);
    const monthlyProfit = parsedMonths ? totalProfit / parsedMonths : 0;
    const share = getProfitSharePercentages(profitShare);

    return {
      parsedCost,
      parsedPrincipal,
      parsedRate,
      parsedMonths,
      parsedBondCost,
      parsedBondTotal,
      computedBondTotal,
      computedMonthly,
      totalProfit,
      monthlyProfit,
      ahmadTotal: totalProfit * share.ahmadPct,
      aliTotal: totalProfit * share.aliPct,
      ahmadMonthly: monthlyProfit * share.ahmadPct,
      aliMonthly: monthlyProfit * share.aliPct,
      fullFinancedAmount: parsedCost + parsedBondCost + totalProfit * share.aliPct,
    };
  }, [bondCost, bondTotal, cost, months, principal, profitShare, rate]);

  const basicSubtitle = useMemo(() => {
    const parts = [phone.trim() || 'بدون جوال', asset.trim() || 'بدون أصل'];
    return parts.join(' · ');
  }, [asset, phone]);

  const financeSubtitle = useMemo(() => {
    const parts = [
      `${numericValues.parsedMonths || 0} شهر`,
      `${numericValues.parsedRate || 0}%`,
      formatCurrency(numericValues.computedMonthly),
    ];
    return parts.join(' · ');
  }, [numericValues.computedMonthly, numericValues.parsedMonths, numericValues.parsedRate]);

  const profitSubtitle = useMemo(() => {
    const courtState = hasCourt ? 'قضية مفعلة' : 'بدون قضية';
    return `${profitShareLabel(profitShare)} · ${courtState}`;
  }, [hasCourt, profitShare]);

  function toggleSection(key: SectionKey) {
    setExpanded((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('حقل مطلوب', 'اسم العميل مطلوب.');
      return;
    }

    if (!contractDate.trim()) {
      Alert.alert('حقل مطلوب', 'تاريخ العقد مطلوب.');
      return;
    }

    if (!firstInstallmentDate.trim()) {
      Alert.alert('حقل مطلوب', 'تاريخ أول قسط مطلوب.');
      return;
    }

    if (isDateBefore(firstInstallmentDate.trim(), contractDate.trim())) {
      Alert.alert('تاريخ غير صحيح', 'تاريخ أول قسط لا يمكن أن يكون أقدم من تاريخ العقد.');
      return;
    }

    if (!numericValues.parsedMonths || numericValues.parsedMonths < 1) {
      Alert.alert('قيمة غير صحيحة', 'عدد الأشهر يجب أن يكون 1 أو أكثر.');
      return;
    }

    if (bondCostMode === 'custom' && !bondCost.trim()) {
      Alert.alert('حقل مطلوب', 'أدخل مبلغ رسوم السند أو اختر بدون.');
      return;
    }

    if (numericValues.parsedBondCost < 0) {
      Alert.alert('قيمة غير صحيحة', 'رسوم السند لا يمكن أن تكون سالبة.');
      return;
    }

    const payload = {
      name: name.trim(),
      id_number: idNumber.trim(),
      phone: phone.trim(),
      asset: asset.trim(),
      contract_date: contractDate.trim(),
      first_installment_date: firstInstallmentDate.trim() || addOneMonthDateString(contractDate.trim()),
      cost: numericValues.parsedCost,
      principal: numericValues.parsedCost,
      rate: numericValues.parsedRate,
      months: numericValues.parsedMonths,
      bond_cost: numericValues.parsedBondCost,
      bond_total: numericValues.parsedBondTotal,
      profit_share: profitShare,
      status,
      has_court: hasCourt,
      court_note: courtNote.trim(),
      notes: notes.trim(),
    };

    try {
      setSaving(true);
      if (isEdit && params.id) {
        await updateClient(params.id, payload);
      } else {
        await createClient(payload);
      }
      router.back();
    } catch (err) {
      Alert.alert('تعذر الحفظ', err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      title={isEdit ? 'تعديل العميل' : 'عميل جديد'}
      subtitle={isEdit ? 'تحديث البيانات بسرعة مع معاينة الحسابات أثناء الكتابة.' : 'إضافة عميل جديد بخطوات مرتبة وواجهة مختصرة.'}
      scrollable={false}
      compactHeader
      rightSlot={
        <View style={styles.headerActions}>
          <IconButton icon="arrow-forward" accessibilityLabel="رجوع" onPress={() => router.back()} />
          <IconButton
            icon={saving ? 'hourglass-outline' : 'checkmark-outline'}
            accessibilityLabel={saving ? 'جارٍ الحفظ' : 'حفظ'}
            variant="primary"
            onPress={() => void handleSave()}
            disabled={saving}
          />
        </View>
      }
    >
      {loading ? <LoadingBlock /> : null}

      {!loading ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarText}>{(name.trim()[0] || 'ع').toUpperCase()}</Text>
              </View>

              <View style={styles.heroMain}>
                <Text style={styles.heroName}>{name.trim() || (isEdit ? 'العميل' : 'عميل جديد')}</Text>
                <Text style={styles.heroSubline}>{asset.trim() || 'أصل / سلعة غير محددة'} · {contractDate}</Text>
              </View>
            </View>

            <View style={styles.heroMetrics}>
              <View style={[styles.heroMetric, styles.heroMetricPrimary]}>
                <Text style={styles.heroMetricValuePrimary}>{formatCurrency(numericValues.computedMonthly)}</Text>
                <Text style={styles.heroMetricLabelPrimary}>القسط الشهري</Text>
              </View>

              <View style={styles.heroMetricRow}>
                <View style={styles.heroMetricSmall}>
                  <Text style={styles.heroMetricValue}>{numericValues.parsedMonths || 0}</Text>
                  <Text style={styles.heroMetricLabel}>الأشهر</Text>
                </View>
                <View style={styles.heroMetricSmall}>
                  <Text style={styles.heroMetricValue}>{numericValues.parsedRate || 0}%</Text>
                  <Text style={styles.heroMetricLabel}>الربح</Text>
                </View>
                <View style={styles.heroMetricSmall}>
                  <Text style={styles.heroMetricValue}>{status === 'active' ? 'نشط' : status === 'stuck' ? 'متعثر' : 'منتهي'}</Text>
                  <Text style={styles.heroMetricLabel}>الحالة</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroFooter}>
              <View style={styles.heroPill}>
                <Ionicons name="document-text-outline" size={14} color={colors.info} />
                <Text style={styles.heroPillText}>{formatCurrency(numericValues.computedBondTotal)}</Text>
                <Text style={styles.heroPillLabel}>قيمة السند</Text>
              </View>
              <View style={styles.heroPill}>
                <Ionicons name="cash-outline" size={14} color={colors.success} />
                <Text style={styles.heroPillText}>{formatCurrency(numericValues.totalProfit)}</Text>
                <Text style={styles.heroPillLabel}>الربح الكلي</Text>
              </View>
            </View>
          </View>

          <AccordionSection
            title="البيانات الأساسية"
            subtitle={basicSubtitle}
            expanded={expanded.basic}
            onToggle={() => toggleSection('basic')}
          >
            <LabeledInput label="اسم العميل" value={name} onChangeText={setName} placeholder="مثال: سالم العتيبي" />

            <View style={styles.twoCols}>
              <View style={styles.col}>
                <LabeledInput label="رقم الهوية" value={idNumber} onChangeText={setIdNumber} keyboardType="number-pad" />
              </View>
              <View style={styles.col}>
                <LabeledInput label="الجوال" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </View>
            </View>

            <LabeledInput label="الأصل / السلعة" value={asset} onChangeText={setAsset} placeholder="مثال: كامري 2024" />
            <LabeledDateInput

              label="تاريخ العقد"

              value={contractDate}

              onChange={handleContractDateChange}

            />
<LabeledDateInput

  label="تاريخ أول قسط"

  value={firstInstallmentDate}

  onChange={handleFirstInstallmentDateChange}

/>
            <LabeledInput label="ملاحظات العميل" value={notes} onChangeText={setNotes} multiline style={styles.multiline} placeholder="اكتب أي ملاحظة عامة عن العميل" />
          </AccordionSection>

          <AccordionSection
            title="الهيكل المالي"
            subtitle={financeSubtitle}
            expanded={expanded.finance}
            onToggle={() => toggleSection('finance')}
          >
            <View style={styles.inlineSectionLabel}>
              <Text style={styles.inlineSectionText}>رسوم السند</Text>
            </View>

            <View style={styles.pillsWrap}>
              {bondOptions.map((option) => {
                const isCustomOption = option.value === 'custom';
                const optionAmount = typeof option.value === 'number' ? option.value : null;
                const active = isCustomOption
                  ? bondCostMode === 'custom'
                  : bondCostMode === 'preset' && optionAmount !== null && isSameBondCost(bondCost, optionAmount);
                const metaText = isCustomOption
                  ? bondCostMode === 'custom' && bondCost.trim()
                    ? formatCurrency(parseBondCostAmount(bondCost))
                    : 'تحديد مبلغ مختلف'
                  : formatCurrency(optionAmount ?? 0);

                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.compactPill, active && styles.compactPillActive]}
                    onPress={() => {
                      if (isCustomOption) {
                        setBondCostMode('custom');
                        if (bondCostMode !== 'custom') {
                          setBondCost('');
                        }
                        return;
                      }

                      if (optionAmount !== null) {
                        setBondCostMode('preset');
                        setBondCost(String(optionAmount));
                      }
                    }}
                  >
                    <Text style={[styles.compactPillTitle, active && styles.compactPillTitleActive]}>{option.title}</Text>
                    <Text style={[styles.compactPillMeta, active && styles.compactPillMetaActive]}>{metaText}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {bondCostMode === 'custom' ? (
              <LabeledInput
                label="مبلغ رسوم السند"
                value={bondCost}
                onChangeText={setBondCost}
                keyboardType="decimal-pad"
                hint="أدخل مبلغًا مختلفًا لرسوم السند."
              />
            ) : null}

            <View style={styles.twoCols}>
              <View style={styles.col}>
                <LabeledInput
                  label="تكلفة الشراء"
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="decimal-pad"
                  hint="سعر شراء الأصل فعليًا. يدخل في معادلة المبلغ الممول بالكامل."
                />
              </View>
              <View style={styles.col}>
              </View>
            </View>

            <View style={styles.twoCols}>
              <View style={styles.col}>
                <LabeledInput label="نسبة الربح الشهرية %" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
              </View>
              <View style={styles.col}>
                <LabeledInput label="عدد الأشهر" value={months} onChangeText={setMonths} keyboardType="number-pad" />
              </View>
            </View>

            <LabeledInput
              label="قيمة السند الكاملة (اختياري)"
              value={bondTotal}
              onChangeText={setBondTotal}
              keyboardType="decimal-pad"
              hint="اتركه فارغًا ليتم حسابه تلقائيًا من النسبة."
            />
          </AccordionSection>

          <AccordionSection
            title="الأرباح والمتابعة"
            subtitle={profitSubtitle}
            expanded={expanded.profit}
            onToggle={() => toggleSection('profit')}
          >
            <View style={styles.inlineSectionLabel}>
              <Text style={styles.inlineSectionText}>توزيع الأرباح</Text>
            </View>

            <View style={styles.pillsWrap}>
              {profitShareOptions.map((option) => {
                const active = option.value === profitShare;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.compactPillLarge, active && styles.compactPillActive]}
                    onPress={() => setProfitShare(option.value)}
                  >
                    <Text style={[styles.compactPillTitle, active && styles.compactPillTitleActive]}>{option.label}</Text>
                    <Text style={[styles.compactPillMeta, active && styles.compactPillMetaActive]}>{option.subtitle}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.inlineSectionLabel}>
              <Text style={styles.inlineSectionText}>حالة العقد</Text>
            </View>

            <View style={styles.segmentedWrap}>
              {[
                { value: 'active', label: 'نشط' },
                { value: 'stuck', label: 'متعثر' },
                { value: 'done', label: 'منتهي' },
              ].map((item) => {
                const active = item.value === status;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => setStatus(item.value as 'active' | 'stuck' | 'done')}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.switchCard}>
              <Switch value={hasCourt} onValueChange={setHasCourt} />
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchLabel}>يوجد متابعة قضائية</Text>
                <Text style={styles.switchHint}>فعّلها عند فتح ملف قضية لهذا العميل.</Text>
              </View>
            </View>

            <LabeledInput label="ملاحظة القضية" value={courtNote} onChangeText={setCourtNote} multiline style={styles.multiline} />
          </AccordionSection>

          <AccordionSection
            title="المعاينة السريعة"
            subtitle={`${formatCurrency(numericValues.computedMonthly)} · ${profitShareLabel(profitShare)}`}
            expanded={expanded.preview}
            onToggle={() => toggleSection('preview')}
          >
            <View style={styles.previewGrid}>
              <View style={[styles.previewBox, styles.previewBoxPrimary]}>
                <Text style={styles.previewBig}>{formatCurrency(numericValues.computedMonthly)}</Text>
                <Text style={styles.previewSmallPrimary}>القسط الشهري</Text>
              </View>
              <View style={styles.previewBox}>
                <Text style={styles.previewBoxValue}>{formatCurrency(numericValues.fullFinancedAmount)}</Text>
                <Text style={styles.previewBoxLabel}>المبلغ الممول بالكامل</Text>
              </View>
              <View style={styles.previewBox}>
                <Text style={styles.previewBoxValue}>{formatCurrency(numericValues.computedBondTotal)}</Text>
                <Text style={styles.previewBoxLabel}>قيمة السند</Text>
              </View>
              <View style={styles.previewBox}>
                <Text style={styles.previewBoxValue}>{formatCurrency(numericValues.totalProfit)}</Text>
                <Text style={styles.previewBoxLabel}>الربح الكلي</Text>
              </View>
              <View style={styles.previewBox}>
                <Text style={styles.previewBoxValue}>{formatCurrency(numericValues.ahmadMonthly)}</Text>
                <Text style={styles.previewBoxLabel}>أحمد شهريًا</Text>
              </View>
              <View style={styles.previewBox}>
                <Text style={styles.previewBoxValue}>{formatCurrency(numericValues.aliMonthly)}</Text>
                <Text style={styles.previewBoxLabel}>علي شهريًا</Text>
              </View>
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteLine}>المبلغ الممول بالكامل: تكلفة الشراء + تكلفة السند + ربح علي إن وجد = {formatCurrency(numericValues.fullFinancedAmount)}</Text>
              <Text style={styles.noteLine}>نوع التوزيع: {profitShareLabel(profitShare)}</Text>
              <Text style={styles.noteLine}>ربح أحمد الكلي: {formatCurrency(numericValues.ahmadTotal)}</Text>
              <Text style={styles.noteLine}>ربح علي الكلي: {formatCurrency(numericValues.aliTotal)}</Text>
            </View>
          </AccordionSection>

          <TouchableOpacity style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>
            <Ionicons name={saving ? 'hourglass-outline' : 'save-outline'} size={18} color="#fff" />
            <Text style={styles.saveText}>{saving ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة العميل'}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 42,
  },
  headerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
    marginBottom: 12,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  heroAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  heroMain: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  heroSubline: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
  },
  heroMetrics: {
    gap: 10,
  },
  heroMetric: {
    borderRadius: 18,
    padding: 14,
  },
  heroMetricPrimary: {
    backgroundColor: colors.primary,
  },
  heroMetricValuePrimary: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'right',
  },
  heroMetricLabelPrimary: {
    color: '#ded8cd',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  heroMetricRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  heroMetricSmall: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  heroMetricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  heroMetricLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  heroFooter: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  heroPill: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  heroPillText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  heroPillLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  twoCols: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  inlineSectionLabel: {
    marginBottom: 2,
  },
  inlineSectionText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  pillsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactPill: {
    minWidth: '31%',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  compactPillLarge: {
    width: '48.5%',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  compactPillActive: {
    borderColor: colors.info,
    backgroundColor: colors.infoSoft,
  },
  compactPillTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'right',
  },
  compactPillTitleActive: {
    color: '#0c447c',
  },
  compactPillMeta: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
  },
  compactPillMetaActive: {
    color: colors.info,
  },
  segmentedWrap: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.infoSoft,
  },
  segmentText: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: 13,
  },
  segmentTextActive: {
    color: colors.text,
  },
  switchCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  switchTextWrap: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'right',
  },
  switchHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  previewGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewBox: {
    width: '48.5%',
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  previewBoxPrimary: {
    width: '100%',
    backgroundColor: colors.infoSoft,
  },
  previewBig: {
    color: colors.info,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'right',
  },
  previewSmallPrimary: {
    color: '#0c447c',
    fontWeight: '800',
    textAlign: 'right',
  },
  previewBoxValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  previewBoxLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
  },
  noteCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 6,
  },
  noteLine: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  saveButton: {
    flexDirection: 'row-reverse',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 22,
  },
  saveText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
});
