import api from "./api";
import { authActions, getRefreshToken } from "../stores/authStore";

/**
 * Full logout: revoke the refresh token server-side (best-effort), then clear
 * local session state. Safe to call even if the network request fails.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    await api.post("/auth/logout", { refreshToken });
  } catch {
    // Ignore — we clear locally regardless.
  } finally {
    authActions.logout();
  }
}
