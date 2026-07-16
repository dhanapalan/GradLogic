import { useMemo, useState } from "react";
import {
  Code2, ListChecks, Pencil, Trash2, CheckSquare, Square, ChevronDown,
  Lightbulb, Layers, Volume2, Square as StopIcon, GraduationCap, Link2,
  Tag, Brain, Save, Plus, X, ExternalLink, Wand2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import StatusBadge from "../StatusBadge";
import questionBankService, { Question, isSystemTag } from "../../../services/questionBankService";

// =============================================================================
// Expandable Knowledge Card (Phase 4).
//
// Collapsed state matches the existing Phase-1 QuestionCard exactly (same
// summary layout, same select/edit/delete affordances) — this component
// supersedes it in Knowledge Library, not duplicates it.
//
// Expanded state surfaces every Knowledge Object facet. Nothing here
// introduces new storage beyond the 3 additive columns from migration 34
// (hint, learning_objectives, reference_links):
//   - Question / Explanation / Coding Challenge / Topic / Skill Mapping are
//     read directly off the SAME question_bank row already in memory.
//   - Flashcard is a pure front/back transform of existing fields — nothing
//     persisted.
//   - Voice Lesson uses the browser's speechSynthesis API on demand —
//     nothing persisted, no TTS backend.
//   - Assessment Link has no real linkage table anywhere in this schema
//     (drive_pool_questions stores its own denormalized copy with no FK back
//     to question_bank) — shown honestly as "not linked" rather than invented.
// =============================================================================

const DIFFICULTY_DOT: Record<string, string> = {
  easy: "bg-green-400",
  medium: "bg-amber-400",
  hard: "bg-rose-400",
};

interface KnowledgeObjectCardProps {
  question: Question;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEdit?: (question: Question) => void;
  onDelete?: (id: string) => void;
  onUpdated?: (question: Question) => void;
}

export default function KnowledgeObjectCard({
  question: q,
  selected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onUpdated,
}: KnowledgeObjectCardProps) {
  const navigate = useNavigate();
  const isCoding = q.type === "coding_challenge";
  const [expanded, setExpanded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const [editingHint, setEditingHint] = useState(false);
  const [hintDraft, setHintDraft] = useState(q.hint || "");
  const [objectives, setObjectives] = useState<string[]>(q.learning_objectives || []);
  const [newObjective, setNewObjective] = useState("");
  const [references, setReferences] = useState<string[]>(q.reference_links || []);
  const [newReference, setNewReference] = useState("");
  const [saving, setSaving] = useState(false);

  const skillTags = useMemo(
    () => (q.tags || []).filter((t) => !isSystemTag(t)),
    [q.tags]
  );

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const handleSpeak = () => {
    if (!speechSupported) {
      toast.error("Voice playback isn't supported in this browser");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const parts = [q.question_text];
    if (q.options && q.options.length > 0) {
      q.options.forEach((opt, i) => parts.push(`Option ${String.fromCharCode(65 + i)}: ${opt}`));
    }
    const utterance = new SpeechSynthesisUtterance(parts.join(". "));
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const persist = async (patch: Partial<Question>) => {
    setSaving(true);
    try {
      const updated = await questionBankService.updateQuestion(q.id, patch);
      toast.success("Saved");
      onUpdated?.({ ...q, ...patch, ...updated });
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveHint = async () => {
    await persist({ hint: hintDraft.trim() || null });
    setEditingHint(false);
  };

  const addObjective = () => {
    if (!newObjective.trim()) return;
    const next = [...objectives, newObjective.trim()];
    setObjectives(next);
    setNewObjective("");
    persist({ learning_objectives: next });
  };

  const removeObjective = (idx: number) => {
    const next = objectives.filter((_, i) => i !== idx);
    setObjectives(next);
    persist({ learning_objectives: next });
  };

  const addReference = () => {
    if (!newReference.trim()) return;
    const next = [...references, newReference.trim()];
    setReferences(next);
    setNewReference("");
    persist({ reference_links: next });
  };

  const removeReference = (idx: number) => {
    const next = references.filter((_, i) => i !== idx);
    setReferences(next);
    persist({ reference_links: next });
  };

  return (
    <div
      className={`bg-white rounded-xl border shadow-admin-card flex flex-col transition-colors ${
        selected ? "border-admin-accent ring-1 ring-admin-accent/30" : "border-gray-200/70"
      } ${q.is_active === false ? "opacity-60" : ""}`}
    >
      {/* Collapsed summary — matches the original QuestionCard exactly */}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                isCoding ? "bg-purple-50 text-purple-700" : "bg-navy-900/[0.06] text-navy-900"
              }`}
            >
              {isCoding ? <Code2 className="w-3.5 h-3.5" /> : <ListChecks className="w-3.5 h-3.5" />}
              {q.category.replace(/_/g, " ")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 capitalize">
              <span className={`w-2 h-2 rounded-full ${DIFFICULTY_DOT[q.difficulty_level] || "bg-gray-300"}`} />
              {q.difficulty_level}
            </span>
            {q.bloom_level && <span className="text-xs text-gray-400 capitalize">· {q.bloom_level}</span>}
          </div>
          {onToggleSelect && (
            <button onClick={() => onToggleSelect(q.id)} className="text-gray-400 hover:text-admin-accent shrink-0" title={selected ? "Deselect" : "Select"}>
              {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
          )}
        </div>

        <p className="text-sm text-gray-900 leading-relaxed line-clamp-3">{q.question_text}</p>

        {skillTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skillTags.slice(0, 4).map((t) => (
              <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px] font-medium">{t}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
          <StatusBadge status={q.status} size="xs" />
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(`/app/superadmin/learning-companion/improve/${q.id}`)}
              className="p-1.5 text-gray-500 hover:text-admin-accent hover:bg-navy-900/[0.04] rounded-lg transition-colors"
              title="AI Improve"
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
            {onEdit && (
              <button onClick={() => onEdit(q)} className="p-1.5 text-gray-500 hover:text-admin-accent hover:bg-navy-900/[0.04] rounded-lg transition-colors" title="Edit">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(q.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 p-1.5 text-gray-500 hover:text-admin-accent hover:bg-navy-900/[0.04] rounded-lg transition-colors"
              title={expanded ? "Collapse Knowledge Card" : "Expand Knowledge Card"}
            >
              <Layers className="w-3.5 h-3.5" />
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Knowledge Object */}
      {expanded && (
        <div className="border-t border-gray-100 p-5 space-y-5 bg-gray-50/50 rounded-b-xl">
          {/* Explanation */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Explanation</h4>
            <p className="text-sm text-gray-700">{q.explanation || <span className="text-gray-400 italic">None recorded</span>}</p>
          </section>

          {/* Hint */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" /> Hint
              </h4>
              {!editingHint && (
                <button onClick={() => { setHintDraft(q.hint || ""); setEditingHint(true); }} className="text-xs text-admin-accent hover:underline">
                  {q.hint ? "Edit" : "Add"}
                </button>
              )}
            </div>
            {editingHint ? (
              <div className="space-y-2">
                <textarea
                  value={hintDraft}
                  onChange={(e) => setHintDraft(e.target.value)}
                  rows={2}
                  placeholder="A nudge toward the answer, without giving it away"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
                />
                <div className="flex gap-2">
                  <button onClick={saveHint} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-navy-900 text-white rounded-lg text-xs font-medium hover:bg-navy-800 disabled:opacity-50">
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => setEditingHint(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium hover:bg-white">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700">{q.hint || <span className="text-gray-400 italic">No hint yet</span>}</p>
            )}
          </section>

          {/* Flashcard */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Flashcard
            </h4>
            <button
              onClick={() => setFlipped((v) => !v)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-admin-accent/40 transition-colors min-h-[5rem]"
              title="Click to flip"
            >
              {!flipped ? (
                <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
              ) : (
                <div className="text-sm text-gray-700">
                  <p className="font-medium text-green-700 mb-1">
                    {/* correct_answer is always stored as the literal answer text,
                        never an option index — render it verbatim. */}
                    {q.correct_answer || "—"}
                  </p>
                  {q.explanation && <p className="text-xs text-gray-500">{q.explanation}</p>}
                </div>
              )}
              <span className="text-[11px] text-gray-400 mt-2 block">{flipped ? "Showing answer — click to flip back" : "Click to reveal answer"}</span>
            </button>
          </section>

          {/* Voice Lesson */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" /> Voice Lesson
            </h4>
            <button
              onClick={handleSpeak}
              disabled={!speechSupported}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-admin-accent/40 disabled:opacity-50"
            >
              {speaking ? <StopIcon className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {speaking ? "Stop" : "Play"}
            </button>
            {!speechSupported && <p className="text-xs text-gray-400 mt-1">Not supported in this browser</p>}
          </section>

          {/* Coding Challenge */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" /> Coding Challenge
            </h4>
            {isCoding && q.test_cases && q.test_cases.length > 0 ? (
              <div className="space-y-1.5">
                {q.test_cases.slice(0, 2).map((tc, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-mono text-gray-600">
                    <div>in: {tc.input}</div>
                    <div>out: {tc.expectedOutput}</div>
                  </div>
                ))}
                {q.test_cases.length > 2 && <p className="text-xs text-gray-400">+{q.test_cases.length - 2} more test case(s)</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">This item is an MCQ — no coding challenge variant</p>
            )}
          </section>

          {/* Assessment Link */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Assessment Link
            </h4>
            <p className="text-sm text-gray-400 italic">
              Not linked to any assessment yet — question-bank items aren't cross-referenced from assessment drives in this schema today.
            </p>
          </section>

          {/* Skill Mapping */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> Skill Mapping
            </h4>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${q.bloom_level ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                {q.bloom_level || "Bloom level not set"}
              </span>
            </div>
          </section>

          {/* Topic */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Topic
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {skillTags.length > 0
                ? skillTags.map((t) => <span key={t} className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded text-xs">{t}</span>)
                : <span className="text-sm text-gray-400 italic">No topic tags</span>}
            </div>
          </section>

          {/* Learning Objectives */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" /> Learning Objectives
            </h4>
            <ul className="space-y-1 mb-2">
              {objectives.map((obj, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                  <span>{obj}</span>
                  <button onClick={() => removeObjective(i)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </li>
              ))}
              {objectives.length === 0 && <li className="text-sm text-gray-400 italic">None yet</li>}
            </ul>
            <div className="flex gap-2">
              <input
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addObjective()}
                placeholder="Add a learning objective…"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
              />
              <button onClick={addObjective} className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-admin-accent/40"><Plus className="w-4 h-4 text-gray-500" /></button>
            </div>
          </section>

          {/* References */}
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> References
            </h4>
            <ul className="space-y-1 mb-2">
              {references.map((ref, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                  <a href={ref} target="_blank" rel="noreferrer" className="text-admin-accent hover:underline truncate">{ref}</a>
                  <button onClick={() => removeReference(i)} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </li>
              ))}
              {references.length === 0 && <li className="text-sm text-gray-400 italic">None yet</li>}
            </ul>
            <div className="flex gap-2">
              <input
                value={newReference}
                onChange={(e) => setNewReference(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addReference()}
                placeholder="Add a reference URL…"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
              />
              <button onClick={addReference} className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-admin-accent/40"><Plus className="w-4 h-4 text-gray-500" /></button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
