import * as React from 'react';
export type ClientStatus = 'active' | 'stuck' | 'done';
export type ClientFilter = 'all' | ClientStatus | 'court' | 'late';
export type ProfitShare = 'shared' | 'ahmad_only';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface PaymentScheduleItem {
  month: number;
  due_date: string;
  period_key: string;
  amount: number;
  installment_amount?: number | null;
  is_paid: boolean;
  payment_status?: PaymentStatus | string | null;
  paid_amount?: number | null;
  recorded_paid_amount?: number | null;
  covered_amount?: number | null;
  remaining_due?: number | null;
  bank_note?: string | null;
  paid_date?: string | null;
  payment_id?: number | null;
  direct_payment_id?: number | null;
  allocation_payment_id?: number | null;
  can_cancel_payment?: boolean | null;
}

export interface ClientSummary {
  monthly_installment: number;
  bond_total: number;
  financed_amount: number;
  purchase_cost?: number;
  original_amount?: number;
  bond_cost_value?: number;
  ali_profit_component?: number;
  full_financed_amount?: number;
  total_profit: number;
  monthly_profit: number;
  effective_rate: number;
  total_rate: number;
  paid_count: number;
  remaining_months: number;
  paid_amount: number;
  remaining_amount: number;
  remaining_principal: number;
  profit_share: ProfitShare;
  ahmad_pct: number;
  ali_pct: number;
  ahmad_total: number;
  ahmad_monthly: number;
  ali_total: number;
  ali_monthly: number;
  progress_percent: number;
}

export interface Client {
  id: number;
  name: string;
  id_number?: string | null;
  phone?: string | null;
  asset?: string | null;
  contract_date: string;
  first_installment_date?: string | null;
  cost: number;
  principal: number;
  rate: number;
  months: number;
  bond_cost?: number | null;
  bond_total?: number | null;
  profit_share?: ProfitShare | null;
  status: ClientStatus;
  has_court: boolean;
  court_note?: string | null;
  notes?: string | null;
  summary: ClientSummary;
  schedule?: PaymentScheduleItem[];
  created_at?: string;
  updated_at?: string;
}

export interface StatsCounts {
  active: number;
  stuck: number;
  done: number;
  court: number;
  total: number;
}

export interface StatsAlertLate {
  id: number;
  name: string;
  id_number?: string | null;
  overdue_count: number;
  overdue_amount: number;
}

export interface StatsAlertWarn {
  id: number;
  name: string;
  days_left: number;
  next_due: string;
  amount: number;
}

export interface StatsStuck {
  count: number;
  total_remaining: number;
  total_principal: number;
  remaining_principal: number;
}

export interface StatsData {
  counts: StatsCounts;
  monthly_income: number;
  monthly_profit: number;
  ahmad_total: number;
  ahmad_monthly: number;
  ali_monthly: number;
  zakat_base: number;
  zakat: number;
  sadaqa: number;
  stuck: StatsStuck;
  alerts: {
    late: StatsAlertLate[];
    warn: StatsAlertWarn[];
  };
}

export interface CreateClientPayload {
  name: string;
  id_number?: string;
  phone?: string;
  asset?: string;
  contract_date: string;
  cost: number;
  principal: number;
  rate: number;
  months: number;
  bond_cost?: number;
  bond_total?: number | null;
  profit_share?: ProfitShare;
  notes?: string;
}

export interface UpdateClientPayload {
  name?: string;
  id_number?: string;
  phone?: string;
  asset?: string;
  contract_date?: string;
  cost?: number;
  principal?: number;
  rate?: number;
  months?: number;
  bond_cost?: number;
  bond_total?: number | null;
  profit_share?: ProfitShare;
  status?: ClientStatus;
  has_court?: boolean;
  court_note?: string;
  notes?: string;
}

export interface RecordPaymentPayload {
  period_key: string;
  paid_amount?: number | null;
  bank_note?: string | null;
}

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
}
