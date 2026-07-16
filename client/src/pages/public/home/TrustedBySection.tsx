const LOGOS = [
  "NovaSoft",
  "Aether Labs",
  "CampusOne",
  "BrightHire",
  "PolyTech U",
  "GreenLeaf IT",
  "Summit Colleges",
  "Orbit HR",
];

export function TrustedBySection() {
  return (
    <section className="bg-white py-14 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
          Trusted by companies, colleges & partners
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LOGOS.map((name) => (
            <div
              key={name}
              className="flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
