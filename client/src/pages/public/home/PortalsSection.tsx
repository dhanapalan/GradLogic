import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Briefcase, GraduationCap, Settings } from "lucide-react";
import { PORTAL_CARDS } from "./constants";

const ICONS = {
  student: GraduationCap,
  college: Building2,
  recruiter: Briefcase,
  admin: Settings,
} as const;

/**
 * Portal chooser — the primary navigation on the home page.
 *
 * Cards link to /auth/login?role=… rather than to the portal subdomains:
 * the query param works in local dev and on any host, and the login page
 * already validates it against the roles the current portal permits. If a
 * subdomain is later made the canonical entry point, only the href changes.
 */
export function PortalsSection() {
  const reduce = useReducedMotion();

  return (
    <section
      id="portals"
      className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            Choose your portal
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            GradLogic serves students, colleges, recruiters and platform teams — each with
            its own workspace. Pick yours to sign in.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PORTAL_CARDS.map((card, i) => {
            const Icon = ICONS[card.id];
            return (
              <motion.div
                key={card.id}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.07 }}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>

                <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white">
                  {card.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                  {card.summary}
                </p>

                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-500"
                        aria-hidden
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to={card.href}
                  className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-800 transition group-hover:border-primary-600 group-hover:bg-primary-600 group-hover:text-white dark:border-slate-700 dark:text-slate-100"
                >
                  {card.cta}
                  <ArrowRight
                    className="h-4 w-4 transition group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
