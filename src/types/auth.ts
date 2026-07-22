// ─── Auth Types ──────────────────────────────────────────────────────────────

export type UserRole = "customer" | "pharmacy" | "manufacturer" | "admin" | "super_admin" | "drap_admin";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isVerified?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: string;
  emailVerified: boolean;
  avatar?: string;
  companyLogo?: string;
  logoUrl?: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpCredentials {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  acceptTerms: boolean;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface AuthError {
  message: string;
  code?: string;
  field?: string;
}

export interface AuthResponse<T = void> {
  success: boolean;
  data?: T;
  error?: AuthError;
  message?: string;
}
