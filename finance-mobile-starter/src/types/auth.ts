export interface AuthUser {
  id: number | string;
  account_id?: number | string | null;
  account_name?: string | null;
  account_slug?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  issued_at: string;
}

export interface LoginPayload {
  login: string;
  password: string;
}
