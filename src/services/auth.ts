import type {
  LoginCredentials,
  SignUpCredentials,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  AuthResponse,
  AuthSession,
  User,
} from "@/types/auth";

// ─── Session Storage Helpers ─────────────────────────────────────────────────

const SESSION_KEY = "mediverify_session";

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(SESSION_KEY) ??
      sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function storeSession(
  session: AuthSession,
  persistent = false
): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(session);
  if (persistent) {
    localStorage.setItem(SESSION_KEY, raw);
  } else {
    sessionStorage.setItem(SESSION_KEY, raw);
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Auth Service (Production) ───────────────────────────────────────────────

async function handleResponse<T>(response: Response): Promise<AuthResponse<T>> {
  let result: any;
  try {
    result = await response.json();
  } catch {
    return {
      success: false,
      error: { message: "Invalid server response. Please try again." },
    };
  }
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/")) {
        window.location.href = "/auth/login?expired=true";
      }
    }
    return {
      success: false,
      error: { message: result.message || "An error occurred." },
    };
  }
  return result;
}

export type LoginResult =
  | (AuthResponse<AuthSession> & { pendingMfa?: false })
  | {
      success: false;
      pendingMfa: true;
      message: string;
      email: string;
      error?: AuthResponse["error"];
    };

export const authService = {
  async login(creds: LoginCredentials): Promise<LoginResult> {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });

      const result = await handleResponse<any>(response);

      if (result.success && result.data?.status === "PENDING_MFA") {
        return {
          success: false,
          pendingMfa: true,
          message: result.data.message || result.message || "Verification code sent to your email.",
          email: result.data.email || creds.email,
        };
      }

      if (result.success && result.data?.user && result.data?.tokens) {
        const session: AuthSession = {
          user: {
            id: result.data.user.id,
            email: result.data.user.email,
            fullName: result.data.user.name,
            role: result.data.user.role.toLowerCase() === "patient" ? "customer" : result.data.user.role.toLowerCase(),
            emailVerified: true,
            createdAt: new Date().toISOString(),
          },
          token: result.data.tokens.accessToken,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        };
        return { ...result, data: session, pendingMfa: false };
      }

      return {
        success: false,
        pendingMfa: false,
        error: result.error ?? { message: result.message || "Login failed. Please try again." },
      };
    } catch (error: any) {
      const message =
        error?.message === "Failed to fetch"
          ? "Cannot reach the server. Please restart the app and try again."
          : error?.message || "Login failed. Please try again.";
      return {
        success: false,
        pendingMfa: false,
        error: { message },
      };
    }
  },

  async register(creds: SignUpCredentials): Promise<AuthResponse<AuthSession>> {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: creds.email,
        password: creds.password,
        name: creds.fullName,
        role: creds.role.toUpperCase(),
      }),
    });

    const result = await handleResponse<any>(response);
    if (result.success && result.data) {
      const session: AuthSession = {
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
          fullName: result.data.user.name,
          role: result.data.user.role.toLowerCase() === "patient" ? "customer" : result.data.user.role.toLowerCase(),
          emailVerified: true,
          createdAt: new Date().toISOString(),
        },
        token: result.data.tokens.accessToken,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      return { ...result, data: session };
    }
    return result;
  },

  async logout(token: string): Promise<AuthResponse> {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
    });
    return await handleResponse(response);
  },

  async updateProfile(data: { name?: string, email?: string }, token: string): Promise<AuthResponse<User>> {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  async forgotPassword(
    payload: ForgotPasswordPayload
  ): Promise<AuthResponse<{ devToken?: string }>> {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await handleResponse(response);
  },

  async resetPassword(
    payload: ResetPasswordPayload
  ): Promise<AuthResponse> {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await handleResponse(response);
  },

  async getMe(token: string): Promise<AuthResponse<User>> {
    const response = await fetch("/api/auth/me", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    return await handleResponse(response);
  },

  async changePassword(data: { currentPassword: string, newPassword: string }, token: string): Promise<AuthResponse> {
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  async googleLogin(idToken: string, role?: string): Promise<AuthResponse<AuthSession>> {
    const response = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, role: role?.toUpperCase() }),
    });

    const result = await handleResponse<any>(response);

    // Handle MFA required for manufacturers
    if (result.success && result.data?.status === "PENDING_MFA") {
      return {
        success: false,
        pendingMfa: true,
        message: result.data.message || "Verification code sent to your email.",
        email: result.data.email,
      } as any;
    }

    if (result.success && result.data?.user && result.data?.tokens) {
      const session: AuthSession = {
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
          fullName: result.data.user.name,
          role:
            result.data.user.role.toLowerCase() === "patient"
              ? "customer"
              : result.data.user.role.toLowerCase(),
          emailVerified: true,
          createdAt: new Date().toISOString(),
        },
        token: result.data.tokens.accessToken,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      return { ...result, data: session };
    }

    return result;
  },
  async resendMfa(email: string): Promise<AuthResponse<{ emailed: boolean; email: string }>> {
    try {
      const response = await fetch("/api/auth/mfa-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      return handleResponse(response);
    } catch {
      return {
        success: false,
        error: { message: "Cannot reach the server. Please try again." },
      };
    }
  },

  async verifyMfa(email: string, code: string): Promise<AuthResponse<AuthSession>> {
    const response = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const result = await handleResponse<any>(response);
    if (result.success && result.data) {
      const session: AuthSession = {
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
          fullName: result.data.user.name,
          role: result.data.user.role.toLowerCase() === "patient" ? "customer" : result.data.user.role.toLowerCase(),
          isVerified: result.data.user.isVerified,
          emailVerified: true,
          createdAt: new Date().toISOString(),
        },
        token: result.data.tokens.accessToken,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      return { ...result, data: session };
    }
    return result;
  },
};
