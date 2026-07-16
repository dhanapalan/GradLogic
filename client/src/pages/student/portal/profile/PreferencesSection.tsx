import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";
import studentProfileService, {
  type ProfilePreferences,
} from "../../../../services/studentProfileService";

function csv(v?: string[] | null) {
  return (v || []).join(", ");
}
function parseCsv(v: string) {
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

export function PreferencesSection({ mode }: { mode: "career" | "privacy" }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["student-profile-prefs"],
    queryFn: () => studentProfileService.getPreferences(),
  });
  const [form, setForm] = useState<ProfilePreferences>({});

  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => studentProfileService.savePreferences(form),
    onSuccess: (data) => {
      toast.success("Preferences saved");
      qc.setQueryData(["student-profile-prefs"], data);
      qc.invalidateQueries({ queryKey: ["student-profile-completion"] });
    },
    onError: () => toast.error("Could not save preferences"),
  });

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  if (mode === "career") {
    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-black text-slate-900">Career preferences</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block font-bold uppercase tracking-wider text-slate-500">Preferred job roles</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={csv(form.preferred_roles)} onChange={(e) => setForm({ ...form, preferred_roles: parseCsv(e.target.value) })} placeholder="Comma-separated" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-bold uppercase tracking-wider text-slate-500">Preferred industries</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={csv(form.preferred_industries)} onChange={(e) => setForm({ ...form, preferred_industries: parseCsv(e.target.value) })} placeholder="Comma-separated" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-bold uppercase tracking-wider text-slate-500">Preferred locations</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={csv(form.preferred_locations)} onChange={(e) => setForm({ ...form, preferred_locations: parseCsv(e.target.value) })} placeholder="Comma-separated" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-bold uppercase tracking-wider text-slate-500">Expected salary (optional)</span>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={form.expected_salary || ""} onChange={(e) => setForm({ ...form, expected_salary: e.target.value })} />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              ["willing_to_relocate", "Willing to relocate"],
              ["higher_studies_interest", "Higher studies interest"],
              ["government_jobs_interest", "Government jobs interest"],
              ["entrepreneurship_interest", "Entrepreneurship interest"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                className="rounded border-slate-300 text-indigo-600"
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save preferences
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-black text-slate-900">Privacy & preferences</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(
          [
            ["email_notifications", "Email notifications"],
            ["sms_notifications", "SMS notifications"],
            ["push_notifications", "Push notifications"],
            ["placement_visibility", "Placement visibility"],
            ["resume_visibility", "Resume visibility"],
            ["profile_visibility", "Profile visibility"],
            ["marketing_preferences", "Marketing preferences"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save privacy settings
        </button>
      </div>
    </section>
  );
}
