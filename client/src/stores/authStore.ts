// =============================================================================
// TalentSecure AI — Auth Store (React 18 useSyncExternalStore)
// Secure token handling with optional Remember Me (localStorage).
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
  rememberMe: boolean;
}

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "user";
const PERMS_KEY = "permissions";
const REMEMBER_KEY = "authRememberMe";

function storage(): Storage {
  try {
    if (localStorage.getItem(REMEMBER_KEY) === "1") return localStorage;
  } catch {
    /* ignore */
  }
  return sessionStorage;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storage().getItem(key) ?? sessionStorage.getItem(key) ?? localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readToken(key: string): string | null {
  return storage().getItem(key) ?? sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

function clearBoth(key: string) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

let state: AuthState = {
  isAuthenticated: !!readToken(ACCESS_KEY),
  user: readJson<AuthUser | null>(USER_KEY, null),
  token: readToken(ACCESS_KEY),
  permissions: readJson<string[]>(PERMS_KEY, []),
  rememberMe: localStorage.getItem(REMEMBER_KEY) === "1",
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

export function useAuthStore<T>(selector: (s: AuthState) => T): T {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return selector(snap);
}

export function getRefreshToken(): string | null {
  return readToken(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return readToken(ACCESS_KEY);
}

function persistAll(
  accessToken: string,
  user: AuthUser | null,
  refreshToken: string | undefined,
  permissions: string[],
  rememberMe: boolean
) {
  const store = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;
  [ACCESS_KEY, REFRESH_KEY, USER_KEY, PERMS_KEY].forEach((k) => other.removeItem(k));
  store.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) store.setItem(REFRESH_KEY, refreshToken);
  if (user) store.setItem(USER_KEY, JSON.stringify(user));
  store.setItem(PERMS_KEY, JSON.stringify(permissions));
  if (rememberMe) localStorage.setItem(REMEMBER_KEY, "1");
  else localStorage.removeItem(REMEMBER_KEY);
}

export const authActions = {
  login(
    accessToken: string,
    user: AuthUser,
    refreshToken?: string,
    permissions: string[] = [],
    rememberMe = false
  ) {
    persistAll(accessToken, user, refreshToken, permissions, rememberMe);
    state = {
      isAuthenticated: true,
      user,
      token: accessToken,
      permissions,
      rememberMe,
    };
    emitChange();
  },

  setTokens(accessToken: string, refreshToken?: string, permissions?: string[]) {
    const rememberMe = state.rememberMe || localStorage.getItem(REMEMBER_KEY) === "1";
    const store = rememberMe ? localStorage : sessionStorage;
    store.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) store.setItem(REFRESH_KEY, refreshToken);
    const nextPerms = permissions ?? state.permissions;
    if (permissions) store.setItem(PERMS_KEY, JSON.stringify(permissions));
    state = { ...state, isAuthenticated: true, token: accessToken, permissions: nextPerms, rememberMe };
    emitChange();
  },

  setPermissions(permissions: string[]) {
    const store = state.rememberMe ? localStorage : sessionStorage;
    store.setItem(PERMS_KEY, JSON.stringify(permissions));
    state = { ...state, permissions };
    emitChange();
  },

  logout() {
    clearBoth(ACCESS_KEY);
    clearBoth(REFRESH_KEY);
    clearBoth(USER_KEY);
    clearBoth(PERMS_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    state = {
      isAuthenticated: false,
      user: null,
      token: null,
      permissions: [],
      rememberMe: false,
    };
    emitChange();
  },

  setUser(user: AuthUser) {
    const store = state.rememberMe ? localStorage : sessionStorage;
    store.setItem(USER_KEY, JSON.stringify(user));
    state = { ...state, user };
    emitChange();
  },

  getState(): AuthState {
    return state;
  },
};
