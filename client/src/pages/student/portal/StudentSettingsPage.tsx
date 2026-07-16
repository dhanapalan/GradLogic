/**
 * Student Portal — Settings hub (MVP).
 * Includes mobile display preferences (theme, font, low-bandwidth).
 */
import { Link } from "react-router-dom";
import {
  Bell,
  KeyRound,
  Languages,
  MonitorSmartphone,
  Shield,
  ChevronRight,
  Type,
  Wifi,
  Moon,
} from "lucide-react";
import {
  useStudentMobilePrefs,
  type StudentFontScale,
  type StudentTheme,
} from "../../../hooks/useStudentMobilePrefs";

const BASE = "/app/student-portal";

const SECTIONS = [
  {
    title: "Security",
    items: [
      {
        name: "Change Password",
        description: "Update your account password",
        href: "/auth/change-password",
        icon: KeyRound,
      },
      {
        name: "MFA",
        description: "Multi-factor authentication status and setup",
        href: `${BASE}/profile?section=account`,
        icon: Shield,
      },
      {
        name: "Sessions",
        description: "Review and revoke signed-in devices",
        href: `${BASE}/sessions`,
        icon: MonitorSmartphone,
      },
    ],
  },
  {
    title: "Preferences",
    items: [
      {
        name: "Notification Preferences",
        description: "Alerts for assessments, learning, and results",
        href: `${BASE}/notifications`,
        icon: Bell,
      },
      {
        name: "Language",
        description: "Learning and voice language preferences",
        href: `${BASE}/profile?section=preferences`,
        icon: Languages,
      },
    ],
  },
] as const;

const THEME_OPTIONS: { value: StudentTheme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const FONT_OPTIONS: { value: StudentFontScale; label: string }[] = [
  { value: 0.9, label: "Small" },
  { value: 1, label: "Default" },
  { value: 1.1, label: "Large" },
  { value: 1.25, label: "XL" },
];

export default function StudentSettingsPage() {
  const { prefs, setPrefs } = useStudentMobilePrefs();

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-500">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Account
        </p>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Password, MFA, sessions, notifications, and mobile display preferences.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <Moon className="h-3.5 w-3.5" aria-hidden />
          Display &amp; accessibility
        </h2>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">Theme</p>
            <div className="flex flex-wrap gap-2">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPrefs({ theme: opt.value })}
                  className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition ${
                    prefs.theme === opt.value
                      ? "border-admin-accent bg-admin-accent/10 text-admin-accent"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Type className="h-4 w-4" aria-hidden />
              Font size
            </p>
            <div className="flex flex-wrap gap-2">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPrefs({ fontScale: opt.value })}
                  className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition ${
                    prefs.fontScale === opt.value
                      ? "border-admin-accent bg-admin-accent/10 text-admin-accent"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-admin-accent focus:ring-admin-accent"
              checked={prefs.lowBandwidth}
              onChange={(e) => setPrefs({ lowBandwidth: e.target.checked })}
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                <Wifi className="h-4 w-4" aria-hidden />
                Low bandwidth mode
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Skip autoplay video and defer heavy charts. Recommended on slow connections.
              </span>
            </span>
          </label>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Download for offline lessons and OS-level background audio are coming soon. Voice input for
            AI Coach is planned for a later release.
          </p>
        </div>
      </section>

      {SECTIONS.map((section) => (
        <section
          key={section.title}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {section.title}
          </h2>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {item.description}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
