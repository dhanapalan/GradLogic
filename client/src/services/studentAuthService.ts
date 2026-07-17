/**
 * Student Portal Module 01 — auth API integrations (no duplicated auth logic).
 */
import api from "../lib/api";
import { authActions, getRefreshToken, type AuthUser } from "../stores/authStore";

export type LoginPayload = {
  email?: string;
  student_id?: string;
  password: string;
  rememberMe?: boolean;
};

export type ApiErrorShape = {
  message: string;
  fieldErrors?: Record<string, string>;
  status?: number;
};

export function parseApiError(err: unknown): ApiErrorShape {
  const e = err as {
    response?: { status?: number; data?: { error?: string; message?: string; fieldErrors?: Record<string, string> } };
    message?: string;
  };
  return {
    message:
      e.response?.data?.error ||
      e.response?.data?.message ||
      e.message ||
      "Something went wrong. Please try again.",
    fieldErrors: e.response?.data?.fieldErrors,
    status: e.response?.status,
  };
}

const studentAuthService = {
  async login(payload: LoginPayload) {
    const identifier = (payload.email || payload.student_id || "").trim();
    const { data } = await api.post("/auth/login", {
      email: identifier,
      password: payload.password,
      // Lets the server decide the refresh cookie's persistence.
      rememberMe: Boolean(payload.rememberMe),
    });
    const body = data.data;
    if (body?.requires2FA) {
      return { requires2FA: true as const, challengeToken: body.challengeToken as string };
    }
    const { accessToken, refreshToken, permissions, user } = body as {
      accessToken: string;
      refreshToken: string;
      permissions: string[];
      user: AuthUser;
    };
    authActions.login(
      accessToken,
      user,
      refreshToken,
      permissions ?? [],
      Boolean(payload.rememberMe)
    );
    return { requires2FA: false as const, user };
  },

  async logout() {
    const refreshToken = getRefreshToken();
    try {
      await api.post("/auth/logout", { refreshToken });
    } catch {
      /* still clear local session */
    }
    authActions.logout();
  },

  async forgotPassword(email: string) {
    const { data } = await api.post("/auth/forgot-password", { email });
    return (data.data ?? {}) as { resetUrl?: string; otp?: string };
  },

  async verifyOtp(email: string, otp: string) {
    const { data } = await api.post("/auth/verify-otp", { email, otp });
    return data.data as { resetToken: string };
  },

  async resetPassword(token: string, password: string) {
    await api.post("/auth/reset-password", { token, password });
  },

  async listSessions() {
    const refreshToken = getRefreshToken();
    const { data } = await api.get("/sessions", {
      headers: refreshToken ? { "X-Refresh-Token": refreshToken } : undefined,
    });
    return data.data as Array<{
      id: string;
      user_agent: string | null;
      ip_address: string | null;
      created_at: string;
      expires_at: string;
      is_current: boolean;
    }>;
  },

  async revokeSession(id: string) {
    await api.delete(`/sessions/${id}`);
  },

  async revokeAllSessions() {
    await api.delete("/sessions/all");
  },
};

export default studentAuthService;
