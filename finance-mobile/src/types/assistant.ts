import { Client } from '@/types/api';
import { FollowUpSummary } from '@/types/follow-up';

export type AssistantUrgency = 'critical' | 'high' | 'medium' | 'normal';

export type AssistantActionKind =
  | 'late_collection'
  | 'promise_followup'
  | 'court_warning'
  | 'today_due'
  | 'friendly_reminder';

export interface CollectionAssistantLead {
  key: string;
  client: Client;
  summary?: FollowUpSummary;
  urgency: AssistantUrgency;
  actionKind: AssistantActionKind;
  score: number;
  amount: number;
  overdueAmount: number;
  overdueCount: number;
  dueDate?: string | null;
  nextFollowUpAt?: string | null;
  reason: string;
  nextActionLabel: string;
}

export interface CollectionAssistantBoard {
  leads: CollectionAssistantLead[];
  totalLeads: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  promiseDueCount: number;
  courtCount: number;
  totalOpportunityAmount: number;
}
