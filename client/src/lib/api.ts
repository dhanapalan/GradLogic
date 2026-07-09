import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { authActions, getRefreshToken } from "../stores/authStore";

// In dev: relative "/api" is proxied by Vite → localhost:5050
// In staging (Docker): http://localhost:5050
// In prod: https://api.atherasys.com
const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
const VITE_API_URL =
  import.meta.env.VITE_API_URL || (isLocalhost ? "http://localhost:5050" : "https://api.gradlogic.atherasys.com");
const baseURL = VITE_API_URL.endsWith("/") ? `${VITE_API_URL}api` : `${VITE_API_URL}/api`;

const api = axios.create({ baseURL });

// Attach access token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStorage.getItem("accessToken");
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
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    // Bare axios (not `api`) so this request skips the interceptors below.
    const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
    const payload = data?.data ?? data;
    if (!payload?.accessToken) return null;
    authActions.setTokens(payload.accessToken, payload.refreshToken, payload.permissions);
    return payload.accessToken as string;
  } catch {
    return null;
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

    // No refresh token available → straight to login.
    if (!getRefreshToken()) {
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

export default api;
