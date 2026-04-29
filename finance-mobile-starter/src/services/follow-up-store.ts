import { FollowUpSummary } from '@/types/follow-up';

function toId(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizeSummary(raw: any, fallbackClientId?: number): FollowUpSummary | null {
  if (!raw || typeof raw !== 'object') return null;

  const clientId = toId(raw.client_id ?? raw.clientId ?? raw.client?.id ?? fallbackClientId);
  if (!clientId) return null;

  return {
    client_id: clientId,
    total: Number(raw.total ?? raw.count ?? raw.followups_count ?? raw.follow_ups_count ?? 0) || 0,
    last_contact_at: raw.last_contact_at ?? raw.lastContactAt ?? raw.last_follow_up_at ?? raw.lastFollowUpAt ?? null,
    last_outcome: raw.last_outcome ?? raw.lastOutcome ?? raw.outcome ?? null,
    next_follow_up_at: raw.next_follow_up_at ?? raw.nextFollowUpAt ?? raw.reminder_at ?? raw.reminderAt ?? null,
    promise_date: raw.promise_date ?? raw.promiseDate ?? null,
    promise_amount: raw.promise_amount ?? raw.promiseAmount ?? null,
    notes: raw.notes ?? raw.note ?? null,
  };
}

function extractList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.summaries)) return payload.summaries;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function tryFetchJson(url: string): Promise<any | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function getFollowUpSummaries(clientIds: number[]): Promise<Record<number, FollowUpSummary>> {
  const ids = clientIds.map(Number).filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return {};

  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl) return {};

  const result: Record<number, FollowUpSummary> = {};

  const bulkUrls = [
    `${baseUrl}/follow-ups/summaries?client_ids=${encodeURIComponent(ids.join(','))}`,
    `${baseUrl}/clients/follow-ups/summaries?client_ids=${encodeURIComponent(ids.join(','))}`,
    `${baseUrl}/followups/summaries?client_ids=${encodeURIComponent(ids.join(','))}`,
  ];

  for (const url of bulkUrls) {
    const payload = await tryFetchJson(url);
    const list = extractList(payload);
    if (list.length) {
      list.forEach((item) => {
        const summary = normalizeSummary(item);
        if (summary) result[summary.client_id] = summary;
      });
      return result;
    }
  }

  await Promise.all(
    ids.slice(0, 80).map(async (clientId) => {
      const urls = [
        `${baseUrl}/clients/${clientId}/follow-ups/summary`,
        `${baseUrl}/clients/${clientId}/followups/summary`,
      ];

      for (const url of urls) {
        const payload = await tryFetchJson(url);
        const summary = normalizeSummary(payload?.data ?? payload, clientId);
        if (summary) {
          result[clientId] = summary;
          break;
        }
      }
    }),
  );

  return result;
}
