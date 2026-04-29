export type FollowUpOutcome = 'contacted' | 'promise' | 'no_answer' | 'excused' | 'court' | 'other';

export interface FollowUpSummary {
  client_id: number;
  total?: number;
  last_contact_at?: string | null;
  last_outcome?: FollowUpOutcome | string | null;
  next_follow_up_at?: string | null;
  promise_date?: string | null;
  promise_amount?: number | null;
  notes?: string | null;
}
