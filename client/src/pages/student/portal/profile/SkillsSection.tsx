import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import studentProfileService, {
  SKILL_CATEGORIES,
  type ProfileSkill,
} from "../../../../services/studentProfileService";

export function SkillsSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["student-profile-skills"],
    queryFn: () => studentProfileService.getSkills(),
  });
  const [skills, setSkills] = useState<ProfileSkill[] | null>(null);
  const [filter, setFilter] = useState("");
  const list = skills ?? q.data ?? [];

  const save = useMutation({
    mutationFn: () => studentProfileService.saveSkills(list),
    onSuccess: (data) => {
      toast.success("Skills saved");
      setSkills(data);
      qc.setQueryData(["student-profile-skills"], data);
      qc.invalidateQueries({ queryKey: ["student-profile-completion"] });
    },
    onError: (err: unknown) => {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Could not save skills"
      );
    },
  });

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return list;
    return list.filter((s) => s.name.toLowerCase().includes(f) || s.category.includes(f));
  }, [list, filter]);

  const add = () => {
    setSkills([
      ...list,
      { category: "programming_languages", name: "", proficiency: "intermediate", years_experience: null },
    ]);
  };

  const update = (idx: number, patch: Partial<ProfileSkill>) => {
    const next = [...list];
    // map filtered index back — operate on full list by identity
    const target = filtered[idx];
    const realIdx = list.indexOf(target);
    if (realIdx < 0) return;
    next[realIdx] = { ...next[realIdx], ...patch };
    setSkills(next);
  };

  const remove = (idx: number) => {
    const target = filtered[idx];
    setSkills(list.filter((s) => s !== target));
  };

  if (q.isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-label="Skills">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-slate-900">Skills</h2>
          <p className="text-xs text-slate-500">Add skills with proficiency. Duplicates are rejected by the server.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save skills
          </button>
        </div>
      </div>
      <input
        type="search"
        placeholder="Search skills…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        aria-label="Search skills"
      />
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No skills yet. Add your first skill.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s, idx) => (
            <li key={`${s.id || s.name}-${idx}`} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <select
                value={s.category}
                onChange={(e) => update(idx, { category: e.target.value })}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                aria-label="Skill category"
              >
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <input
                value={s.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="Skill name"
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                aria-label="Skill name"
              />
              <div className="flex gap-2">
                <select
                  value={s.proficiency}
                  onChange={(e) => update(idx, { proficiency: e.target.value })}
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs"
                  aria-label="Proficiency"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="Yrs"
                  value={s.years_experience ?? ""}
                  onChange={(e) =>
                    update(idx, { years_experience: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-xs"
                  aria-label="Years of experience"
                />
              </div>
              <button type="button" onClick={() => remove(idx)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Remove skill">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
