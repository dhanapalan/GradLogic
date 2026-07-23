import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";
import {
  SparklesIcon,
  UserGroupIcon,
  MicrophoneIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  BookOpenIcon,
  ClockIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

interface SoftSkillModule {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  difficulty: string | null;
  skill_name: string | null;
}

// ── Curated GD topics (Indian campus placement classics) ─────────────────────

const GD_TOPICS: { category: string; topics: string[] }[] = [
  {
    category: "Current Affairs",
    topics: [
      "AI will create more jobs than it destroys",
      "Should India adopt a 4-day work week?",
      "UPI and the future of cashless India",
      "Work from home vs return to office",
    ],
  },
  {
    category: "Abstract",
    topics: [
      "Blue is better than red",
      "A room without books is like a body without a soul",
      "Is failure the best teacher?",
      "The journey matters more than the destination",
    ],
  },
  {
    category: "Business & Tech",
    topics: [
      "Startups vs corporate jobs for freshers",
      "Should social media be regulated?",
      "EVs: hype or the future of Indian mobility?",
      "Are engineering degrees losing relevance?",
    ],
  },
];

const GD_DOS = [
  "Open confidently if you know the topic well",
  "Back opinions with one concrete example or statistic",
  "Acknowledge others before countering (\"Adding to that point…\")",
  "Bring the discussion back on track if it derails",
  "Summarize at the end — it gets noticed",
];

const GD_DONTS = [
  "Interrupt or talk over other participants",
  "Speak for long stretches without letting others in",
  "Get aggressive or personal about disagreements",
  "Stay silent throughout — participation is scored",
  "Fabricate statistics you can't defend",
];

// ── HR interview questions with framework answers ────────────────────────────

const INTERVIEW_QA: { question: string; framework: string }[] = [
  {
    question: "Tell me about yourself",
    framework:
      "Use Present–Past–Future: 1) Who you are now (degree, college, key strength). 2) Relevant things you've done (projects, internships, achievements). 3) Why you're excited about THIS role. Keep it under 90 seconds and rehearse until it sounds natural, not memorized.",
  },
  {
    question: "What are your strengths and weaknesses?",
    framework:
      "Strengths: pick 2 relevant to the job, each with a 1-line proof (\"I'm persistent — I debugged a project issue for 3 days when others gave up\"). Weakness: pick something real but non-fatal, and show what you're doing about it. Never say \"I'm a perfectionist\".",
  },
  {
    question: "Why should we hire you?",
    framework:
      "Match 3 things: what the role needs → what you bring → proof. Research the company's tech stack or values beforehand and mirror their language. End with enthusiasm, not desperation.",
  },
  {
    question: "Describe a challenge you faced and how you handled it",
    framework:
      "Use STAR: Situation (1 line of context), Task (what you were responsible for), Action (what YOU did — use \"I\", not \"we\"), Result (quantify if possible: marks, time saved, users). Prepare 3 STAR stories that can flex to different questions.",
  },
  {
    question: "Where do you see yourself in 5 years?",
    framework:
      "Show ambition anchored to the company: growing into a specialist or lead role, learning their domain deeply. Avoid \"your seat\" jokes and avoid implying you'll leave for an MBA in 2 years.",
  },
  {
    question: "Do you have any questions for us?",
    framework:
      "Always ask 2. Good options: \"What does success look like in the first 6 months?\", \"What do the best freshers here do differently?\". Never ask about salary/leave in round one.",
  },
];

// ── Resume checklist ──────────────────────────────────────────────────────────

const RESUME_CHECKLIST = [
  "One page only — recruiters spend under 30 seconds on a fresher resume",
  "Contact block: phone, professional email, LinkedIn, GitHub (if coding role)",
  "Education table with CGPA/percentage — don't hide it, they'll ask",
  "2–3 projects with action verbs and measurable outcomes (\"Built X using Y, achieved Z\")",
  "Skills section split: Languages / Frameworks / Tools — only list what you can defend",
  "Achievements over responsibilities — \"won\", \"ranked\", \"reduced\", not \"was part of\"",
  "No photo, no age, no \"objective\" paragraph — use that space for projects",
  "Save as PDF named Firstname_Lastname_College.pdf — ATS systems parse PDFs best",
  "Zero typos — one spelling mistake can reject an otherwise strong resume",
];

export default function SoftSkillsHubPage() {
  const [openQa, setOpenQa] = useState<number | null>(0);

  const { data: modules } = useQuery<SoftSkillModule[]>({
    queryKey: ["soft-skill-modules"],
    queryFn: async () => {
      const { data } = await api.get("/learning-modules?type=soft_skill&published=true");
      return data.data;
    },
  });

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <SparklesIcon className="h-8 w-8 text-indigo-600" />
          Soft Skills Hub
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Group discussions, interviews, resume, and communication — everything beyond the written test.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/app/learn"
          className="group bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
        >
          <BookOpenIcon className="h-8 w-8 mb-3 text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-900">Learning Portal</h3>
          <p className="text-sm text-gray-500 mt-1">
            Enroll in structured skill programs — aptitude, reasoning, and soft-skill modules with progress tracking.
          </p>
          <span className="inline-block mt-3 text-sm font-bold text-indigo-600 group-hover:underline">
            Browse programs →
          </span>
        </Link>
      </div>

      {/* Soft-skill learning modules (from API) */}
      {(modules?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-xl font-black text-gray-900 mb-4">Soft Skill Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules!.map((m) => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <h3 className="font-bold text-gray-900">{m.title}</h3>
                {m.description && <p className="text-sm text-gray-500 mt-1 line-clamp-3">{m.description}</p>}
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 font-bold">
                  {m.duration_minutes && (
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon className="h-3.5 w-3.5" /> {m.duration_minutes} min
                    </span>
                  )}
                  {m.difficulty && <span className="capitalize">{m.difficulty}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GD practice */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <UserGroupIcon className="h-5 w-5 text-indigo-600" />
          <h2 className="font-black text-gray-900">Group Discussion Practice</h2>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {GD_TOPICS.map((group) => (
            <div key={group.category}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{group.category}</p>
              <ul className="space-y-2">
                {group.topics.map((topic) => (
                  <li
                    key={topic}
                    className="text-sm text-gray-700 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100"
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 rounded-lg p-5 border border-green-100">
            <p className="font-bold text-green-800 mb-3 text-sm">Do's</p>
            <ul className="space-y-2">
              {GD_DOS.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-green-900">
                  <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-red-50 rounded-lg p-5 border border-red-100">
            <p className="font-bold text-red-800 mb-3 text-sm">Don'ts</p>
            <ul className="space-y-2">
              {GD_DONTS.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-red-900">
                  <XCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* HR interview prep */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-indigo-600" />
          <h2 className="font-black text-gray-900">HR Interview — Answer Frameworks</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {INTERVIEW_QA.map((qa, i) => (
            <div key={qa.question}>
              <button
                onClick={() => setOpenQa(openQa === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50"
              >
                <span className="font-bold text-gray-900 text-sm">{qa.question}</span>
                <ChevronDownIcon
                  className={`h-4 w-4 text-gray-400 transition-transform ${openQa === i ? "rotate-180" : ""}`}
                />
              </button>
              {openQa === i && (
                <p className="px-6 pb-5 text-sm text-gray-600 leading-relaxed">{qa.framework}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Resume checklist */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
          <h2 className="font-black text-gray-900">Resume Checklist</h2>
        </div>
        <ul className="p-6 space-y-3">
          {RESUME_CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
              <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-indigo-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
