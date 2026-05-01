import {
  ApiEnvelope,
  Client,
  ClientFilter,
  CreateClientPayload,
  RecordPaymentPayload,
  StatsData,
  UpdateClientPayload,
} from '@/types/api';
import { AuthSession, AuthUser, LoginPayload } from '@/types/auth';
import {
  createMockClient,
  deleteMockClient,
  getMockClient,
  getMockClients,
  getMockProfile,
  getMockStats,
  loginMock,
  recordMockPayment,
  removeMockPayment,
  updateMockClient,
} from '@/services/mock-data';

function resolveApiBase(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';

  if (host === 'sara.pm.sa' || host.endsWith('.sara.pm.sa')) {
    return 'https://sara.pm.sa/api/v1';
  }

  if (host === 'finance.pm.sa' || host.endsWith('.finance.pm.sa')) {
    return 'https://finance.pm.sa/api/v1';
  }

  return (
    process.env.EXPO_PUBLIC_API_BASE_URL
    || process.env.EXPO_PUBLIC_API_URL
    || 'http://127.0.0.1:8000/api/v1'
  );
}

const API_BASE = resolveApiBase().replace(/\/$/, '');
const MOCK_FLAG = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
const HAS_REAL_API_BASE = /^https?:\/\//i.test(API_BASE) && !/(example\.com|127\.0\.0\.1|localhost)/i.test(API_BASE);
const USE_MOCKS = MOCK_FLAG && !HAS_REAL_API_BASE;

let authToken: string | null = null;

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

function buildHeaders(init?: RequestInit): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(init?.headers || {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildHeaders(init),
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;

  if (!response.ok) {
    const message = payload.message || (response.status === 401
      ? 'انتهت جلسة الدخول أو يلزم تسجيل الدخول مرة أخرى.'
      : 'تعذر تنفيذ الطلب.');
    throw new ApiRequestError(message, response.status);
  }

  return payload;
}

async function requestOptional<T>(paths: string[], init?: RequestInit): Promise<T> {
  let lastError: Error | null = null;

  for (const path of paths) {
    try {
      return await request<T>(path, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تنفيذ الطلب.';
      if (error instanceof ApiRequestError && error.status === 404) {
        lastError = new Error(message);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('تعذر العثور على المسار المناسب للمصادقة.');
}

function pickEnvelopeData<T>(raw: any): T {
  return (raw?.data ?? raw) as T;
}

function normalizeClientCapital(client: Client): Client {
  if (!client?.summary) {
    return client;
  }

  const remainingPrincipal = Number(client.summary.remaining_principal);
  const paidAmount = Number(client.summary.paid_amount);

  if (!Number.isFinite(remainingPrincipal) || !Number.isFinite(paidAmount)) {
    return client;
  }

  return {
    ...client,
    summary: {
      ...client.summary,
      // نجعل أي شاشة قديمة تعتمد على financed_amount - paid_amount تعرض نفس رقم الخادم.
      // المصدر المعتمد هو remaining_principal القادم من Laravel، وهو نفس الرقم الظاهر في الويب.
      financed_amount: remainingPrincipal + paidAmount,
    },
  };
}

function normalizeClientList(clients: Client[]): Client[] {
  return clients.map((client) => normalizeClientCapital(client));
}

function pickUser(raw: any): AuthUser {
  const source = raw?.user || raw?.data?.user || raw?.data || raw || {};
  return {
    id: source.id ?? source.user_id ?? 1,
    name: source.name ?? source.full_name ?? source.username ?? 'مستخدم النظام',
    email: source.email ?? null,
    phone: source.phone ?? null,
    role: source.role ?? null,
  };
}

function pickToken(raw: any): string {
  return raw?.token || raw?.access_token || raw?.data?.token || raw?.data?.access_token || '';
}

function normalizeAuthSession(raw: any): AuthSession {
  const token = pickToken(raw);
  if (!token) {
    throw new Error('لم يتم العثور على رمز دخول صالح من الخادم.');
  }

  return {
    token,
    user: pickUser(raw),
    issued_at: new Date().toISOString(),
  };
}

export function setApiToken(token: string | null | undefined): void {
  authToken = token || null;
}

export async function signIn(payload: LoginPayload): Promise<AuthSession> {
  if (USE_MOCKS) {
    const session = loginMock(payload);
    setApiToken(session.token);
    return session;
  }

  const response = await requestOptional<any>(['/auth/login', '/login'], {
    method: 'POST',
    body: JSON.stringify({
      login: payload.login,
      email: payload.login,
      username: payload.login,
      password: payload.password,
    }),
  });

  const session = normalizeAuthSession(response);
  setApiToken(session.token);
  return session;
}

export async function getProfile(): Promise<AuthUser> {
  if (USE_MOCKS) {
    return getMockProfile();
  }

  const response = await requestOptional<any>(['/auth/me', '/me', '/user']);
  return pickUser(response);
}

export async function signOutRemote(): Promise<void> {
  if (USE_MOCKS) return;

  try {
    await requestOptional<any>(['/auth/logout', '/logout'], {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch {
    // intentionally ignore logout endpoint mismatches for now
  } finally {
    setApiToken(null);
  }
}

export async function getClients(status: ClientFilter = 'all'): Promise<Client[]> {
  if (!USE_MOCKS) {
    const response = await request<ApiEnvelope<Client[]> | Client[]>(`/clients?status=${status}`);
    return normalizeClientList(pickEnvelopeData<Client[]>(response));
  }

  return normalizeClientList(getMockClients(status === 'late' ? 'all' : status));
}

export async function getClient(id: number | string): Promise<Client> {
  if (!USE_MOCKS) {
    const response = await request<ApiEnvelope<Client> | Client>(`/clients/${id}`);
    return normalizeClientCapital(pickEnvelopeData<Client>(response));
  }

  return normalizeClientCapital(getMockClient(id));
}

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  if (!USE_MOCKS) {
    const response = await request<ApiEnvelope<Client> | Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeClientCapital(pickEnvelopeData<Client>(response));
  }

  return normalizeClientCapital(createMockClient(payload));
}

export async function updateClient(id: number | string, payload: UpdateClientPayload): Promise<Client> {
  if (!USE_MOCKS) {
    const response = await request<ApiEnvelope<Client> | Client>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return normalizeClientCapital(pickEnvelopeData<Client>(response));
  }

  return normalizeClientCapital(updateMockClient(id, payload));
}

export async function deleteClient(id: number | string): Promise<void> {
  if (!USE_MOCKS) {
    await request<{ message: string }>(`/clients/${id}`, { method: 'DELETE' });
    return;
  }

  deleteMockClient(id);
}

export async function getStats(): Promise<StatsData> {
  if (!USE_MOCKS) {
    const response = await request<ApiEnvelope<StatsData> | StatsData>('/stats');
    return pickEnvelopeData<StatsData>(response);
  }

  return getMockStats();
}

export async function recordPayment(id: number | string, payload: RecordPaymentPayload): Promise<void> {
  if (!USE_MOCKS) {
    await request(`/clients/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return;
  }

  recordMockPayment(id, payload);
}

export async function removePayment(
  id: number | string,
  periodKey: string,
  options: {
    paymentId?: number | string | null;
    monthNumber?: number | null;
    dueDate?: string | null;
  } = {},
): Promise<void> {
  if (!USE_MOCKS) {
    const encodedPeriodKey = encodeURIComponent(periodKey);
    const queryParts: string[] = [];

    if (options.paymentId !== undefined && options.paymentId !== null && String(options.paymentId).trim() !== '') {
      queryParts.push(`payment_id=${encodeURIComponent(String(options.paymentId))}`);
    }

    if (options.monthNumber !== undefined && options.monthNumber !== null) {
      queryParts.push(`month_number=${encodeURIComponent(String(options.monthNumber))}`);
    }

    if (options.dueDate) {
      queryParts.push(`due_date=${encodeURIComponent(String(options.dueDate))}`);
    }

    const queryString = queryParts.length ? `?${queryParts.join('&')}` : '';
    await request(`/clients/${id}/pay/${encodedPeriodKey}${queryString}`, { method: 'DELETE' });
    return;
  }

  removeMockPayment(id, periodKey);
}

export const apiConfig = {
  baseUrl: API_BASE,
  useMocks: USE_MOCKS,
  mockFlagEnabled: MOCK_FLAG,
  hasRealApiBase: HAS_REAL_API_BASE,
};
