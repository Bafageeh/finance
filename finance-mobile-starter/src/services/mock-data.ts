import {
  Client,
  CreateClientPayload,
  PaymentScheduleItem,
  RecordPaymentPayload,
  StatsData,
  UpdateClientPayload,
} from '@/types/api';
import { AuthSession, AuthUser, LoginPayload } from '@/types/auth';
import { buildClientSummary, buildPaymentSchedule, buildStatsFromClients, normalizeClient, withRecordedPayment, withRemovedPayment } from '@/utils/finance';

function createSchedule(startDate: string, months: number, monthlyAmount: number, paidCount: number): PaymentScheduleItem[] {
  const base = buildPaymentSchedule(startDate, months, monthlyAmount);
  return base.map((item) => {
    if (item.month > paidCount) return item;
    return {
      ...item,
      is_paid: true,
      paid_amount: item.amount,
      bank_note: 'دفعة تجريبية',
      paid_date: item.due_date,
      payment_id: item.month,
    };
  });
}

function seedClient(
  base: Omit<Client, 'summary'>,
  paidCount: number,
): Client {
  const monthly = base.bond_total && base.months ? base.bond_total / base.months : 0;
  const schedule = createSchedule(base.contract_date, base.months, monthly || 0, paidCount);
  const seeded: Client = {
    ...base,
    schedule,
    summary: buildClientSummary({ ...base, schedule }),
  };

  return normalizeClient(seeded);
}

const mockUser: AuthUser = {
  id: 1,
  name: 'أحمد بافقيه',
  email: 'admin@pm.sa',
  phone: '0500007650',
  role: 'manager',
};

let mockDb: Client[] = [
  seedClient(
    {
      id: 1,
      name: 'سالم العتيبي',
      id_number: '1020304050',
      phone: '0500001111',
      asset: 'كامري 2024',
      contract_date: '2026-01-10',
      cost: 60000,
      principal: 60000,
      rate: 1.5,
      months: 12,
      bond_cost: 74.75,
      bond_total: 70874.75,
      profit_share: 'shared',
      status: 'active',
      has_court: false,
      court_note: '',
      created_at: '2026-01-10T09:00:00.000Z',
      updated_at: '2026-04-20T10:00:00.000Z',
    },
    4,
  ),
  seedClient(
    {
      id: 2,
      name: 'ناصر الحربي',
      id_number: '2030405060',
      phone: '0555002222',
      asset: 'هايلوكس 2023',
      contract_date: '2025-11-15',
      cost: 45000,
      principal: 45000,
      rate: 1.25,
      months: 10,
      bond_cost: 74.75,
      bond_total: 50699.75,
      profit_share: 'ahmad_only',
      status: 'stuck',
      has_court: true,
      court_note: 'تم تحويل الملف للمتابعة القانونية.',
      created_at: '2025-11-15T12:00:00.000Z',
      updated_at: '2026-04-19T14:00:00.000Z',
    },
    3,
  ),
  seedClient(
    {
      id: 3,
      name: 'تركي الشمري',
      id_number: '3040506070',
      phone: '0567003333',
      asset: 'أيفون 16 برو',
      contract_date: '2025-06-01',
      cost: 5500,
      principal: 5500,
      rate: 1.8,
      months: 8,
      bond_cost: 74.75,
      bond_total: 6366.75,
      profit_share: 'shared',
      status: 'done',
      has_court: false,
      court_note: '',
      created_at: '2025-06-01T08:00:00.000Z',
      updated_at: '2026-02-01T08:00:00.000Z',
    },
    8,
  ),
  seedClient(
    {
      id: 4,
      name: 'عبدالله القحطاني',
      id_number: '4050607080',
      phone: '0588804444',
      asset: 'سوناتا 2022',
      contract_date: '2026-03-05',
      cost: 39000,
      principal: 39000,
      rate: 1.1,
      months: 12,
      bond_cost: 74.75,
      bond_total: 44222.75,
      profit_share: 'shared',
      status: 'active',
      has_court: false,
      court_note: '',
      created_at: '2026-03-05T11:00:00.000Z',
      updated_at: '2026-04-22T11:00:00.000Z',
    },
    1,
  ),
];

function nextId(): number {
  return mockDb.length ? Math.max(...mockDb.map((client) => client.id)) + 1 : 1;
}

function sortClients(list: Client[]): Client[] {
  return [...list].sort((a, b) => b.id - a.id);
}

export function loginMock(payload: LoginPayload): AuthSession {
  const login = payload.login.trim().toLowerCase();
  const password = payload.password.trim();

  if ((login === 'admin' || login === 'admin@pm.sa') && password === '123456') {
    return {
      token: 'mock-token-finance-mobile',
      user: mockUser,
      issued_at: new Date().toISOString(),
    };
  }

  throw new Error('بيانات الدخول التجريبية غير صحيحة. استخدم admin / 123456 أو admin@pm.sa / 123456');
}

export function getMockProfile(): AuthUser {
  return mockUser;
}

export function getMockClients(status: 'all' | 'active' | 'stuck' | 'done' | 'court' = 'all'): Client[] {
  const normalized = sortClients(mockDb).map(normalizeClient);
  if (status === 'all') return normalized;
  if (status === 'court') return normalized.filter((client) => client.has_court);
  return normalized.filter((client) => client.status === status || (status === 'done' && client.summary.paid_count >= client.months));
}

export function getMockClient(id: number | string): Client {
  const client = mockDb.find((item) => item.id === Number(id));
  if (!client) throw new Error('العميل غير موجود.');
  return normalizeClient(client);
}

export function createMockClient(payload: CreateClientPayload): Client {
  const bondCost = payload.bond_cost ?? 74.75;
  const created: Client = normalizeClient({
    id: nextId(),
    name: payload.name,
    id_number: payload.id_number || null,
    phone: payload.phone || null,
    asset: payload.asset || null,
    contract_date: payload.contract_date,
    cost: payload.cost,
    principal: payload.principal,
    rate: payload.rate,
    months: payload.months,
    bond_cost: bondCost,
    bond_total: payload.bond_total ?? null,
    profit_share: payload.profit_share || 'shared',
    status: 'active',
    has_court: false,
    court_note: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    summary: {} as Client['summary'],
    schedule: buildPaymentSchedule(payload.contract_date, payload.months, 0),
  });

  mockDb = [created, ...mockDb];
  return created;
}

export function updateMockClient(id: number | string, payload: UpdateClientPayload): Client {
  const current = getMockClient(id);
  const updated = normalizeClient({
    ...current,
    ...payload,
    updated_at: new Date().toISOString(),
  });

  mockDb = mockDb.map((client) => (client.id === Number(id) ? updated : client));
  return updated;
}

export function deleteMockClient(id: number | string): void {
  mockDb = mockDb.filter((client) => client.id !== Number(id));
}

export function recordMockPayment(id: number | string, payload: RecordPaymentPayload): Client {
  const current = getMockClient(id);
  const updated = withRecordedPayment(current, payload.period_key, payload.paid_amount, payload.bank_note ?? null);
  mockDb = mockDb.map((client) => (client.id === Number(id) ? updated : client));
  return updated;
}

export function removeMockPayment(id: number | string, periodKey: string): Client {
  const current = getMockClient(id);
  const updated = withRemovedPayment(current, periodKey);
  mockDb = mockDb.map((client) => (client.id === Number(id) ? updated : client));
  return updated;
}

export function getMockStats(): StatsData {
  const stats = buildStatsFromClients(mockDb.map(normalizeClient));
  return {
    ...stats,
    zakat: Number((stats.zakat_base * 0.025).toFixed(2)),
    sadaqa: Number((stats.zakat_base * 0.01).toFixed(2)),
  };
}
