export interface AuthUser {
  id: number | string;
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
