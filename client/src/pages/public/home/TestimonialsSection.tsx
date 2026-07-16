import { useEffect, useState } from "react";
import { TESTIMONIALS } from "./constants";

export function TestimonialsSection() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % TESTIMONIALS.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  const t = TESTIMONIALS[index];

  return (
    <section className="border-y border-slate-200 bg-gradient-to-br from-primary-950 via-slate-900 to-violet-950 py-16 text-white">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary-300">
          Testimonials
        </p>
        <blockquote className="mt-6">
          <p className="font-display text-xl leading-relaxed sm:text-2xl">“{t.quote}”</p>
          <footer className="mt-6">
            <p className="font-semibold">{t.name}</p>
            <p className="text-sm text-slate-300">
              {t.role} · {t.org}
            </p>
          </footer>
        </blockquote>
        <div className="mt-8 flex justify-center gap-2" role="tablist" aria-label="Testimonials">
          {TESTIMONIALS.map((item, i) => (
            <button
              key={`${item.name}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show testimonial from ${item.name}`}
              className={`h-2.5 w-2.5 rounded-full transition ${
                i === index ? "bg-white" : "bg-white/30 hover:bg-white/50"
              }`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
