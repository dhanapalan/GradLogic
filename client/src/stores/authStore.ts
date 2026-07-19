// =============================================================================
// TalentSecure AI — Auth Store (React 18 useSyncExternalStore)
//
// Token handling: the access token lives in memory only and the refresh token
// lives in an httpOnly cookie set by the server — neither is persisted to
// web storage, so nothing sensitive is readable from DevTools/XSS. On page
// load, lib/api.ts#bootstrapSession silently refreshes via the cookie.
// Storage keeps only non-credential session context (user profile,
// permission keys, Remember Me flag). Legacy token keys left by older builds
// are still read once for migration, then scrubbed.
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

// Legacy-only read: current builds never write token keys to storage, but
// sessions started on an older build (and E2E seeding) may still have them.
function readLegacyToken(key: string): string | null {
  return storage().getItem(key) ?? sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

function clearBoth(key: string) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

/** Remove token copies persisted by older builds (post-migration cleanup). */
export function clearLegacyTokenStorage() {
  clearBoth(ACCESS_KEY);
  clearBoth(REFRESH_KEY);
}

const legacyAccessToken = readLegacyToken(ACCESS_KEY);

let state: AuthState = {
  isAuthenticated: !!legacyAccessToken,
  user: readJson<AuthUser | null>(USER_KEY, null),
  token: legacyAccessToken,
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

/**
 * Legacy sessions only: the refresh token now lives in an httpOnly cookie the
 * client cannot read. This returns a storage copy left by an older build (or
 * null), which /auth/refresh and /auth/logout still accept in the body.
 */
export function getRefreshToken(): string | null {
  return readLegacyToken(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return state.token;
}

function persistAll(
  user: AuthUser | null,
  permissions: string[],
  rememberMe: boolean
) {
  const store = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;
  [ACCESS_KEY, REFRESH_KEY, USER_KEY, PERMS_KEY].forEach((k) => other.removeItem(k));
  // Tokens are intentionally NOT written to storage.
  clearLegacyTokenStorage();
  if (user) store.setItem(USER_KEY, JSON.stringify(user));
  store.setItem(PERMS_KEY, JSON.stringify(permissions));
  if (rememberMe) localStorage.setItem(REMEMBER_KEY, "1");
  else localStorage.removeItem(REMEMBER_KEY);
}

export const authActions = {
  login(
    accessToken: string,
    user: AuthUser,
    _refreshToken?: string,
    permissions: string[] = [],
    rememberMe = false
  ) {
    // The refresh token argument is ignored: the server delivers it as an
    // httpOnly cookie, and we never persist tokens to web storage.
    persistAll(user, permissions, rememberMe);
    state = {
      isAuthenticated: true,
      user,
      token: accessToken,
      permissions,
      rememberMe,
    };
    emitChange();
  },

  setTokens(accessToken: string, _refreshToken?: string, permissions?: string[]) {
    const rememberMe = state.rememberMe || localStorage.getItem(REMEMBER_KEY) === "1";
    const store = rememberMe ? localStorage : sessionStorage;
    // Access token stays in memory; rotated refresh token arrives via cookie.
    clearLegacyTokenStorage();
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
