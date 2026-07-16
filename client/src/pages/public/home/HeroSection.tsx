import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HeroIllustration } from "./HeroIllustration";

const LOGIN_CTAS = [
  { label: "Student Login", href: "/auth/login?role=student" },
  { label: "Faculty Login", href: "/auth/login?role=faculty" },
  { label: "College Login", href: "/auth/login?role=college" },
  { label: "Recruiter Login", href: "/auth/login?role=recruiter" },
] as const;

export function HeroSection() {
  const reduce = useReducedMotion();

  return (
    <section
      id="home"
      className="relative overflow-hidden border-b border-slate-200/60 bg-gradient-to-b from-slate-50 via-white to-white dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.12),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.22),_transparent_55%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <motion.p
            className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-700 dark:border-primary-800 dark:bg-primary-950/60 dark:text-primary-300"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            AI-Powered Talent Development Platform
          </motion.p>

          <motion.h1
            className="mt-5 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <span className="block">Learn.</span>
            <span className="block">Practice.</span>
            <span className="block">Get Assessed.</span>
            <span className="mt-1 block bg-gradient-to-r from-primary-600 via-emerald-600 to-violet-600 bg-clip-text text-transparent">
              Become Placement Ready.
            </span>
          </motion.h1>

          <motion.p
            className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            GradLogic connects colleges, students, and recruiters on one intelligent platform —
            from personalized AI learning to proctored assessments and confirmed campus offers.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap gap-3"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Link
              to="/auth/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {LOGIN_CTAS.map((cta) => (
              <Link
                key={cta.label}
                to={cta.href}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-primary-700 dark:hover:bg-slate-800"
              >
                {cta.label}
              </Link>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <HeroIllustration />
        </motion.div>
      </div>
    </section>
  );
}
