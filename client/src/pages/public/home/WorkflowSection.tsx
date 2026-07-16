import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { WORKFLOW_STEPS } from "./constants";

export function WorkflowSection() {
  const reduce = useReducedMotion();

  return (
    <section className="border-y border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          Platform workflow
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          A clear path from registration to job offers — designed for students, faculty, and
          placement cells.
        </p>

        <div className="mt-8 overflow-x-auto pb-2">
          <ol className="flex min-w-max items-stretch gap-2">
            {WORKFLOW_STEPS.map((step, i) => (
              <Fragment key={step}>
                <motion.li
                  className="flex w-36 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                    Step {i + 1}
                  </span>
                  <span className="mt-1 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
                    {step}
                  </span>
                </motion.li>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <li className="flex items-center text-slate-300 dark:text-slate-600" aria-hidden>
                    <ChevronRight className="h-5 w-5" />
                  </li>
                )}
              </Fragment>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
