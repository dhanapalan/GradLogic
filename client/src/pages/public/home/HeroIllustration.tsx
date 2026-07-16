import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Bot,
  Briefcase,
  FileText,
  GraduationCap,
  Sparkles,
} from "lucide-react";

/** Decorative SVG-style hero composition — no external image dependency. */
export function HeroIllustration() {
  const reduce = useReducedMotion();

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-lg"
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary-600/15 via-emerald-400/10 to-violet-500/15 blur-2xl dark:from-primary-500/25 dark:via-emerald-400/15 dark:to-violet-400/20" />
      <div className="relative grid h-full grid-cols-2 gap-3 p-2 sm:gap-4 sm:p-4">
        <motion.div
          className="col-span-2 flex items-center gap-3 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-lg backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80"
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Student Journey</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Learn → Practice → Assess → Place</p>
          </div>
          <Sparkles className="ml-auto h-5 w-5 text-violet-500" />
        </motion.div>

        <Card
          delay={0.1}
          icon={<Bot className="h-5 w-5" />}
          title="AI Assistant"
          subtitle="Tutor & coach"
          tone="emerald"
        />
        <Card
          delay={0.2}
          icon={<FileText className="h-5 w-5" />}
          title="Assessment"
          subtitle="MCQ · Coding · Lab"
          tone="blue"
        />
        <Card
          delay={0.3}
          icon={<Briefcase className="h-5 w-5" />}
          title="Resume + Offer"
          subtitle="ATS · Campus hiring"
          tone="violet"
        />
        <Card
          delay={0.4}
          icon={<BarChart3 className="h-5 w-5" />}
          title="Analytics"
          subtitle="Readiness 82%"
          tone="slate"
        />
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  subtitle,
  tone,
  delay,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  tone: "emerald" | "blue" | "violet" | "slate";
  delay: number;
}) {
  const reduce = useReducedMotion();
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    blue: "bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };

  return (
    <motion.div
      className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/90"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <div className={`mb-3 inline-flex rounded-lg p-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </motion.div>
  );
}
