// =============================================================================
// Voice Studio admin pages — voices, languages, audio library, templates.
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Headphones, Languages, Library, Loader2, Mic, Volume2 } from "lucide-react";
import toast from "react-hot-toast";
import settingsService from "../../../services/settingsService";
import superadminFeaturesService, { type PublishedLesson } from "../../../services/superadminFeaturesService";
import {
  VOICE_TUTOR_LANGUAGES,
  type VoiceTutorLanguage,
} from "../../../services/voiceTutorService";
import { EmptyState, PageHeader, StatTile } from "./FeatureUi";

const TUTOR_ACTIONS = [
  { key: "listen", label: "Listen", blurb: "Student speaks; tutor responds in context." },
  { key: "explain", label: "Explain", blurb: "Plain-language explanation of the knowledge object." },
  { key: "hint", label: "Hint", blurb: "Nudge without revealing the answer." },
  { key: "example", label: "Example", blurb: "Worked example tied to the object." },
  { key: "translate", label: "Translate", blurb: "Restate in the selected language." },
  { key: "ask", label: "Ask", blurb: "Free-form question about the object." },
] as const;

export function AiTutorVoicesPage() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferred, setPreferred] = useState("auto");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis?.getVoices?.() || []);
    loadVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);
    settingsService
      .getSettings()
      .then((s) => setPreferred(String(s["voice.tutor_voice"] ?? "auto")))
      .catch(() => {});
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoices);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await settingsService.updateSettings({ "voice.tutor_voice": preferred });
      toast.success("Preferred tutor voice saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const preview = (voiceURI: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Hello from GradLogic voice tutor.");
    const match = voices.find((v) => v.voiceURI === voiceURI);
    if (match) u.voice = match;
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader
        icon={Volume2}
        title="AI Tutor Voices"
        description="Browser TTS voices used by the student Voice Tutor. Mic STT stays on-device."
      />

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <label className="block text-sm text-gray-600">
          Preferred voice
          <select
            value={preferred}
            onChange={(e) => setPreferred(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="auto">Auto (browser default for language)</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang}){v.localService ? "" : " · remote"}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save preference
          </button>
          {preferred !== "auto" && (
            <button
              type="button"
              onClick={() => preview(preferred)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Preview
            </button>
          )}
          <Link to="/app/superadmin/ai-config?tab=services" className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Voice interview API keys
          </Link>
        </div>
      </div>

      {voices.length === 0 ? (
        <EmptyState message="No speechSynthesis voices detected in this browser yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Voice</th>
                <th className="px-4 py-3">Lang</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {voices.map((v) => (
                <tr key={v.voiceURI} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                  <td className="px-4 py-3 text-gray-600">{v.lang}</td>
                  <td className="px-4 py-3 text-gray-500">{v.localService ? "Local" : "Remote"}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => preview(v.voiceURI)} className="text-xs text-admin-accent">
                      Preview
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function VoiceLanguagesPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [defaultLang, setDefaultLang] = useState<VoiceTutorLanguage>("en");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService
      .getSettings()
      .then((s) => {
        const defaults: Record<string, boolean> = {};
        for (const code of Object.keys(VOICE_TUTOR_LANGUAGES)) {
          defaults[code] = s[`voice.lang.${code}`] !== false;
        }
        setEnabled(defaults);
        const def = String(s["voice.default_language"] || "en");
        if (def in VOICE_TUTOR_LANGUAGES) setDefaultLang(def as VoiceTutorLanguage);
      })
      .catch(() => {
        const defaults: Record<string, boolean> = {};
        for (const code of Object.keys(VOICE_TUTOR_LANGUAGES)) defaults[code] = true;
        setEnabled(defaults);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { "voice.default_language": defaultLang };
      for (const [code, on] of Object.entries(enabled)) {
        payload[`voice.lang.${code}`] = on;
      }
      await settingsService.updateSettings(payload);
      toast.success("Languages saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader
        icon={Languages}
        title="Languages"
        description="Languages available in Voice Tutor and Translation Studio."
      />

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <label className="block text-sm text-gray-600">
          Default language
          <select
            value={defaultLang}
            onChange={(e) => setDefaultLang(e.target.value as VoiceTutorLanguage)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {Object.entries(VOICE_TUTOR_LANGUAGES).map(([code, meta]) => (
              <option key={code} value={code}>
                {meta.label} ({meta.bcp47})
              </option>
            ))}
          </select>
        </label>

        <ul className="divide-y divide-gray-100">
          {Object.entries(VOICE_TUTOR_LANGUAGES).map(([code, meta]) => (
            <li key={code} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium text-gray-900">{meta.label}</p>
                <p className="text-xs text-gray-500">
                  {code} · {meta.bcp47}
                </p>
              </div>
              <input
                type="checkbox"
                checked={enabled[code] !== false}
                onChange={(e) => setEnabled((p) => ({ ...p, [code]: e.target.checked }))}
              />
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save languages
        </button>
      </div>
    </div>
  );
}

export function AudioLibraryPage() {
  const [rows, setRows] = useState<PublishedLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superadminFeaturesService
      .listLessons({ voice: true })
      .then(setRows)
      .catch(() => toast.error("Failed to load audio library"))
      .finally(() => setLoading(false));
  }, []);

  const withAudio = rows.filter((r) => r.content_url);
  const scripts = rows.filter((r) => !r.content_url);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader
        icon={Library}
        title="Audio Library"
        description="Voice lessons and scripts available for the Voice Tutor."
        action={
          <Link
            to="/app/superadmin/learning-companion/studio?kind=voice_lessons"
            className="rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white"
          >
            Generate voice content
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="With audio URL" value={withAudio.length} />
        <StatTile label="Voice scripts" value={scripts.length} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          message="No voice lessons yet."
          ctaHref="/app/superadmin/library/voice-lessons"
          ctaLabel="Open Voice Lessons"
        />
      ) : (
        <div className="space-y-2">
          {rows.map((l) => (
            <div key={l.id} className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-gray-900">{l.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {l.course_title} · {l.module_title} · {l.content_type}
                  </p>
                </div>
                <span className="text-[11px] uppercase text-gray-400">
                  {l.content_url ? "Audio" : "Script"}
                </span>
              </div>
              {l.content_url ? (
                <audio controls className="mt-3 w-full max-w-md" src={l.content_url}>
                  <track kind="captions" />
                </audio>
              ) : l.content_text ? (
                <p className="mt-2 text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{l.content_text}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VoiceTemplatesPage() {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService
      .getSettings()
      .then((s) => {
        const next: Record<string, string> = {};
        for (const a of TUTOR_ACTIONS) {
          next[a.key] = String(s[`voice.template.${a.key}`] ?? "");
        }
        setNotes(next);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(notes)) {
        payload[`voice.template.${key}`] = value;
      }
      await settingsService.updateSettings(payload);
      toast.success("Voice templates saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <PageHeader
        icon={Headphones}
        title="Voice Templates"
        description="Admin notes / override guidance for each Voice Tutor action. Core safety prompts stay server-side."
      />

      <div className="space-y-3">
        {TUTOR_ACTIONS.map((a) => (
          <div key={a.key} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <Mic className="w-4 h-4 text-navy-900" />
              <h3 className="text-sm font-semibold text-gray-900">{a.label}</h3>
              <span className="text-[11px] text-gray-400 font-mono">{a.key}</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">{a.blurb}</p>
            <textarea
              value={notes[a.key] || ""}
              onChange={(e) => setNotes((p) => ({ ...p, [a.key]: e.target.value }))}
              rows={3}
              placeholder="Optional admin guidance appended for this action…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Save templates
      </button>
    </div>
  );
}
