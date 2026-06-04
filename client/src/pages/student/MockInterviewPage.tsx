import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Clock, Target, ChevronRight, AlertCircle, BookOpen } from "lucide-react";
import api from "../../lib/api";

const ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "Data Analyst",
  "DevOps Engineer",
  "Product Manager",
  "Business Analyst",
  "Machine Learning Engineer",
];

const DIFFICULTIES = [
  {
    value: "easy",
    label: "Beginner",
    desc: "2 questions · Encouraging tone · 8–10 min",
    color: "border-emerald-200 bg-emerald-50 text-emerald-700",
    selected: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-300",
  },
  {
    value: "medium",
    label: "Intermediate",
    desc: "3 questions · Realistic pace · 12–15 min",
    color: "border-indigo-200 bg-indigo-50 text-indigo-700",
    selected: "border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300",
  },
  {
    value: "hard",
    label: "Advanced",
    desc: "3–4 questions · Deep follow-ups · 15–20 min",
    color: "border-rose-200 bg-rose-50 text-rose-700",
    selected: "border-rose-500 bg-rose-100 ring-2 ring-rose-300",
  },
];

export default function MockInterviewPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRole = role === "__custom__" ? customRole.trim() : role;

  const handleStart = async () => {
    if (!selectedRole) { setError("Please select or enter a target role."); return; }
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/mock-interviews/start", {
        target_role: selectedRole,
        difficulty,
      });
      navigate(`/app/student-portal/mock-interview/room`, {
        state: {
          session_id: data.data.session_id,
          vapi_public_key: data.data.vapi_public_key,
          assistant_config: data.data.assistant_config,
          target_role: selectedRole,
          difficulty,
        },
      });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start interview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg mb-4">
            <Mic className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">AI Mock Interview</h1>
          <p className="text-slate-500 mt-1 text-sm">Practice with a voice AI interviewer and get instant feedback</p>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">How it works</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { icon: Target, label: "Pick a role & level", step: "1" },
              { icon: Mic, label: "Talk with AI interviewer", step: "2" },
              { icon: BookOpen, label: "Get detailed feedback", step: "3" },
            ].map(({ icon: Icon, label, step }) => (
              <div key={step} className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">{step}</div>
                <Icon className="h-5 w-5 text-slate-400" />
                <span className="text-xs text-slate-500 leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Config card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">

          {/* Role picker */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">Target Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Select a role…</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="__custom__">Other (type your own)</option>
            </select>
            {role === "__custom__" && (
              <input
                type="text"
                placeholder="e.g. iOS Developer, QA Engineer…"
                value={customRole}
                onChange={e => setCustomRole(e.target.value)}
                className="mt-2 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            )}
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">Difficulty</label>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  className={`rounded-xl border p-3 text-left transition-all ${difficulty === d.value ? d.selected : d.color}`}
                >
                  <div className="text-xs font-black mb-0.5">{d.label}</div>
                  <div className="text-[10px] leading-tight opacity-70">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 space-y-1">
                <p className="font-semibold">Before you start</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-600">
                  <li>Find a quiet place with no background noise</li>
                  <li>Make sure your microphone is working</li>
                  <li>Allow microphone access when prompted</li>
                  <li>Keep your browser tab open throughout</li>
                </ul>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-500 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}

          <button
            onClick={handleStart}
            disabled={loading || !selectedRole}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-indigo-200"
          >
            {loading ? (
              <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Preparing interview…</>
            ) : (
              <><Mic className="h-4 w-4" /> Start Mock Interview <ChevronRight className="h-4 w-4" /></>
            )}
          </button>
        </div>

        {/* Duration hint */}
        <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
          <Clock className="h-3 w-3" /> Estimated duration: {difficulty === "easy" ? "8–10" : difficulty === "hard" ? "15–20" : "12–15"} minutes
        </p>
      </div>
    </div>
  );
}
