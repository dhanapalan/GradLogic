import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART = [
  { name: "Wk1", learning: 42, assessment: 38, readiness: 45 },
  { name: "Wk2", learning: 55, assessment: 48, readiness: 52 },
  { name: "Wk3", learning: 61, assessment: 58, readiness: 60 },
  { name: "Wk4", learning: 70, assessment: 66, readiness: 68 },
  { name: "Wk5", learning: 78, assessment: 74, readiness: 76 },
  { name: "Wk6", learning: 84, assessment: 81, readiness: 82 },
];

export function ReadinessSection() {
  const reduce = useReducedMotion();
  const [score, setScore] = useState(reduce ? 82 : 0);

  useEffect(() => {
    if (reduce) return;
    const target = 82;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setScore(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  return (
    <section id="readiness" className="border-y border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Placement readiness
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">
            One score that guides the entire journey
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Combine learning progress, assessment strength, interview performance, and resume
            quality into a live Placement Readiness Score.
          </p>

          <div className="mt-8 flex items-center gap-8">
            <div className="relative h-36 w-36" role="img" aria-label={`Placement readiness ${score} percent`}>
              <svg className="-rotate-90" viewBox="0 0 128 128" width="144" height="144">
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-slate-200 dark:text-slate-700"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke="url(#readinessGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                />
                <defs>
                  <linearGradient id="readinessGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-bold text-slate-900 dark:text-white">
                  {score}%
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Ready
                </span>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>Learning Progress</li>
              <li>Assessment Scores</li>
              <li>Skill Gap</li>
              <li>Attendance · Certification</li>
            </ul>
          </div>
        </div>

        <div className="h-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Analytics snapshot
          </p>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={CHART}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip />
              <Area type="monotone" dataKey="learning" stroke="#2563EB" fill="#2563EB22" />
              <Area type="monotone" dataKey="assessment" stroke="#7C3AED" fill="#7C3AED18" />
              <Area type="monotone" dataKey="readiness" stroke="#10B981" fill="#10B98122" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
