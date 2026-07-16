import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Brain,
  Code2,
  FileCheck2,
  Mic,
  Target,
  Users,
} from "lucide-react";

const HIGHLIGHTS = [
  {
    id: "ai-learning",
    title: "AI Learning",
    icon: Brain,
    items: ["Personalized learning", "Adaptive roadmap", "AI Tutor"],
    accent: "from-primary-500 to-primary-600",
  },
  {
    id: "mock",
    title: "Mock Interviews",
    icon: Mic,
    items: ["Voice AI", "HR Interview", "Technical Interview", "Coding Interview"],
    accent: "from-violet-500 to-violet-600",
  },
  {
    id: "assessments",
    title: "AI Assessments",
    icon: Code2,
    items: ["MCQ", "Coding", "Descriptive", "Lab", "Psychometric"],
    accent: "from-emerald-500 to-emerald-600",
  },
] as const;

export function HighlightsSection() {
  const reduce = useReducedMotion();

  return (
    <section id="features" className="bg-white py-16 sm:py-20 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
            Platform highlights
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Everything students need to become placement ready
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {HIGHLIGHTS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.id}
                id={card.id === "ai-learning" ? "ai-learning" : card.id === "assessments" ? "assessments" : undefined}
                className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.08 }}
              >
                <div
                  className={`inline-flex rounded-xl bg-gradient-to-br ${card.accent} p-3 text-white shadow-md`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{card.title}</h3>
                <ul className="mt-3 space-y-2">
                  {card.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <Target className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </div>

        <div id="placements" className="mt-6 grid gap-5 lg:grid-cols-3">
          <Panel
            title="Campus Hiring"
            icon={<Users className="h-5 w-5" />}
            steps={["Apply", "Track", "Interview", "Offer"]}
          />
          <Panel
            title="Recruiter Portal"
            icon={<BookOpen className="h-5 w-5" />}
            steps={["Search Talent", "Shortlist", "Schedule Interviews", "Hire"]}
            id="recruiters"
          />
          <Panel
            title="Resume Builder"
            icon={<FileCheck2 className="h-5 w-5" />}
            steps={["ATS Optimized Resume", "Resume Score", "Keyword Suggestions"]}
          />
        </div>
      </div>
    </section>
  );
}

function Panel({
  title,
  icon,
  steps,
  id,
}: {
  title: string;
  icon: ReactNode;
  steps: string[];
  id?: string;
}) {
  return (
    <div
      id={id}
      className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-3 text-primary-700 dark:text-primary-300">
        <div className="rounded-lg bg-primary-50 p-2 dark:bg-primary-950/50">{icon}</div>
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((s) => (
          <span
            key={s}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
