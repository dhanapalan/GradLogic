/**
 * Student portal mobile preferences (theme, font scale, low-bandwidth).
 * Persisted in localStorage; applied on the portal shell.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "student-mobile-prefs";

export type StudentTheme = "system" | "light" | "dark";
export type StudentFontScale = 0.9 | 1 | 1.1 | 1.25;

export type StudentMobilePrefs = {
  theme: StudentTheme;
  fontScale: StudentFontScale;
  lowBandwidth: boolean;
};

const DEFAULTS: StudentMobilePrefs = {
  theme: "system",
  fontScale: 1,
  lowBandwidth: false,
};

function readStored(): StudentMobilePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<StudentMobilePrefs>;
    return {
      theme: parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
        ? parsed.theme
        : DEFAULTS.theme,
      fontScale: ([0.9, 1, 1.1, 1.25] as const).includes(parsed.fontScale as StudentFontScale)
        ? (parsed.fontScale as StudentFontScale)
        : DEFAULTS.fontScale,
      lowBandwidth: !!parsed.lowBandwidth,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function detectSaveData(): boolean {
  try {
    const conn = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (!conn) return false;
    if (conn.saveData) return true;
    return conn.effectiveType === "2g" || conn.effectiveType === "slow-2g";
  } catch {
    return false;
  }
}

function resolveDark(theme: StudentTheme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useStudentMobilePrefs() {
  const [prefs, setPrefsState] = useState<StudentMobilePrefs>(readStored);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const setPrefs = useCallback((patch: Partial<StudentMobilePrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Auto-hint low bandwidth once if user hasn't toggled yet
  useEffect(() => {
    if (detectSaveData() && !prefs.lowBandwidth) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) setPrefs({ lowBandwidth: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const isDark = resolveDark(prefs.theme);

  useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setPrefsState((p) => ({ ...p }));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs.theme]);

  return {
    prefs,
    setPrefs,
    isDark,
    isOnline,
    fontScale: prefs.fontScale,
    lowBandwidth: prefs.lowBandwidth,
  };
}
