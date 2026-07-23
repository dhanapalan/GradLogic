import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { WORKFLOW_PHASES } from "./constants";

export function WorkflowSection() {
  const reduce = useReducedMotion();

  return (
    <section className="border-y border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          Platform workflow
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          A clear path from day one to interview day — designed for students, faculty, and
          placement cells.
        </p>

        {/* Grid rather than a horizontal scroller: every phase stays visible at
            all widths, so the final outcome is never hidden off-screen. */}
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_PHASES.map((phase, i) => (
            <motion.li
              key={phase.phase}
              className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.08 }}
            >
              {/* Connector between phases — drawn only on the lg row, where the
                  cards actually sit side by side. */}
              {i < WORKFLOW_PHASES.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-slate-300 lg:block dark:bg-slate-700"
                />
              )}

              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {phase.phase}
                </h3>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {phase.summary}
              </p>

              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {phase.steps.map((step) => (
                  <li
                    key={step}
                    className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400"
                      aria-hidden
                    />
                    {step}
                  </li>
                ))}
              </ul>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
