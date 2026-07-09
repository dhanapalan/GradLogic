// =============================================================================
// TalentSecure AI — Auth Store (React 18 useSyncExternalStore)
// =============================================================================

import { useSyncExternalStore } from "react";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  college_id?: string | null;
  college_name?: string | null;
  department?: string | null;
  phone_number?: string | null;
  dob?: string | null;
  is_profile_complete?: boolean;
  must_change_password?: boolean;
  two_factor_enabled?: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  /** Effective RBAC permission keys for the current user. */
  permissions: string[];
}

// ── Storage keys ─────────────────────────────────────────────────────────────
const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "user";
const PERMS_KEY = "permissions";

// ── Internal state ───────────────────────────────────────────────────────────

// Tokens are stored in sessionStorage (cleared on tab close) rather than
// localStorage to reduce XSS token-theft exposure window.
// The ideal fix is httpOnly cookies — migrate when backend cookie auth is added.
function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

let state: AuthState = {
  isAuthenticated: !!sessionStorage.getItem(ACCESS_KEY),
  user: readJson<AuthUser | null>(USER_KEY, null),
  token: sessionStorage.getItem(ACCESS_KEY),
  permissions: readJson<string[]>(PERMS_KEY, []),
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  return state;
}

// ── React hook ───────────────────────────────────────────────────────────────

export function useAuthStore<T>(selector: (s: AuthState) => T): T {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return selector(snap);
}

// ── Token accessors (used by the axios interceptor) ──────────────────────────

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

// ── Actions ──────────────────────────────────────────────────────────────────

export const authActions = {
  login(accessToken: string, user: AuthUser, refreshToken?: string, permissions: string[] = []) {
    sessionStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(PERMS_KEY, JSON.stringify(permissions));
    state = { isAuthenticated: true, user, token: accessToken, permissions };
    emitChange();
  },

  /** Update tokens after a silent refresh without disturbing user/permissions. */
  setTokens(accessToken: string, refreshToken?: string, permissions?: string[]) {
    sessionStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
    const nextPerms = permissions ?? state.permissions;
    if (permissions) sessionStorage.setItem(PERMS_KEY, JSON.stringify(permissions));
    state = { ...state, isAuthenticated: true, token: accessToken, permissions: nextPerms };
    emitChange();
  },

  setPermissions(permissions: string[]) {
    sessionStorage.setItem(PERMS_KEY, JSON.stringify(permissions));
    state = { ...state, permissions };
    emitChange();
  },

  logout() {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(PERMS_KEY);
    state = { isAuthenticated: false, user: null, token: null, permissions: [] };
    emitChange();
  },

  setUser(user: AuthUser) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    state = { ...state, user };
    emitChange();
  },

  getState(): AuthState {
    return state;
  },
};
