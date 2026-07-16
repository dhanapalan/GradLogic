import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { WHY_FEATURES } from "./constants";

export function WhySection() {
  const reduce = useReducedMotion();

  return (
    <section className="bg-white py-16 sm:py-20 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            <Sparkles className="h-4 w-4" aria-hidden />
            Why GradLogic
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">
            AI that compounds every step of placement readiness
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WHY_FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: (i % 5) * 0.04 }}
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {f.desc}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
