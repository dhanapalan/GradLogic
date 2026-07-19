import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  authActions,
  clearLegacyTokenStorage,
  getAccessToken,
  getRefreshToken,
} from "../stores/authStore";

// In dev: relative "/api" is proxied by Vite → localhost:5050
// In staging (Docker): http://localhost:5050
// In prod: https://api.atherasys.com
const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
const VITE_API_URL =
  import.meta.env.VITE_API_URL || (isLocalhost ? "http://localhost:5050" : "https://api.gradlogic.atherasys.com");
const baseURL = VITE_API_URL.endsWith("/") ? `${VITE_API_URL}api` : `${VITE_API_URL}/api`;

// withCredentials so the httpOnly refresh cookie rides along on /api/auth/*
// and /api/sessions (the cookie is path-scoped server-side).
const api = axios.create({ baseURL, withCredentials: true });

// Attach access token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Silent refresh on 401 ─────────────────────────────────────────────────────
// When an access token expires, we transparently exchange the refresh token for
// a new pair and replay the failed request. Concurrent 401s are queued behind a
// single in-flight refresh so we only rotate once.

let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function flushQueue(token: string | null) {
  pendingQueue.forEach((resolve) => resolve(token));
  pendingQueue = [];
}

function forceLogout() {
  authActions.logout();
  if (window.location.pathname !== "/auth/login") {
    window.location.href = "/auth/login";
  }
}

async function performRefresh(): Promise<string | null> {
  // Normally the refresh token travels in the httpOnly cookie; a body token is
  // only present for sessions started on an older build (storage copy).
  const legacyRefreshToken = getRefreshToken();
  try {
    // Bare axios (not `api`) so this request skips the interceptors below.
    const { data } = await axios.post(
      `${baseURL}/auth/refresh`,
      {
        refreshToken: legacyRefreshToken || undefined,
        rememberMe: authActions.getState().rememberMe,
      },
      { withCredentials: true }
    );
    const payload = data?.data ?? data;
    if (!payload?.accessToken) return null;
    authActions.setTokens(payload.accessToken, payload.refreshToken, payload.permissions);
    // The rotated refresh token is now cookie-only; drop any legacy copy.
    clearLegacyTokenStorage();
    return payload.accessToken as string;
  } catch {
    return null;
  }
}

/**
 * Restore the session before first render: if we have a persisted user but no
 * access token (page reload — the token lives only in memory), silently
 * exchange the httpOnly refresh cookie for a new pair. Clears stale session
 * context if the refresh is rejected.
 */
export async function bootstrapSession(): Promise<void> {
  const { user } = authActions.getState();
  if (getAccessToken() || !user) return;
  const token = await performRefresh();
  if (!token && navigator.onLine) {
    authActions.logout();
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = typeof original?.url === "string" ? original.url : "";

    // Never try to refresh for the auth endpoints themselves.
    const isAuthEndpoint = url.startsWith("/auth/");

    if (error.response?.status !== 401 || !original || isAuthEndpoint || original._retry) {
      return Promise.reject(error);
    }

    // The refresh token lives in an httpOnly cookie we cannot see, so we
    // can't pre-check its presence — only attempt a refresh if this looked
    // like an authenticated session at all.
    if (!getAccessToken() && !getRefreshToken()) {
      forceLogout();
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      // Wait for the in-flight refresh, then replay.
      return new Promise((resolve, reject) => {
        pendingQueue.push((token) => {
          if (!token) return reject(error);
          original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;
    const newToken = await performRefresh();
    isRefreshing = false;
    flushQueue(newToken);

    if (!newToken) {
      forceLogout();
      return Promise.reject(error);
    }

    original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
    return api(original);
  }
);

export { baseURL };
export default api;
