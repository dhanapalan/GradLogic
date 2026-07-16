import { Outlet, Link } from "react-router-dom";
import { Bot, ShieldCheck, TrendingUp } from "lucide-react";
import Logo from "../components/Logo";
import { ThemeToggle } from "../components/marketing/ThemeToggle";

export default function AuthLayout() {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-primary-200/40 to-emerald-100/30 blur-[100px] dark:from-primary-600/20 dark:to-emerald-500/10" />
        <div className="absolute -right-[5%] bottom-[10%] h-[360px] w-[360px] rounded-full bg-gradient-to-tr from-violet-200/30 to-primary-100/20 blur-[80px] dark:from-violet-600/15 dark:to-primary-500/10" />
      </div>

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle compact />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 lg:grid-cols-2 lg:max-h-[min(860px,92dvh)]">
          <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-8 text-white lg:flex xl:p-10">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#2563EB_0%,transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,#10B981_0%,transparent_50%)]" />
            </div>

            <div className="relative z-10">
              <Link to="/" className="inline-flex items-center gap-2">
                <Logo size={40} />
                <span className="text-xl font-bold tracking-tight">
                  Grad<span className="text-primary-400">Logic</span>
                </span>
              </Link>

              <h1 className="mt-8 font-display text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl">
                AI assistant. Learning. Placement.{" "}
                <span className="bg-gradient-to-r from-primary-400 to-emerald-400 bg-clip-text text-transparent">
                  Success.
                </span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
                Enterprise-grade access for students, faculty, colleges, recruiters, and platform
                admins — secured with MFA-ready authentication.
              </p>
            </div>

            <div className="relative z-10 mt-8 grid gap-4">
              {[
                {
                  icon: <Bot className="h-5 w-5 text-primary-400" />,
                  title: "AI Learning & Coaching",
                  desc: "Tutor, career coach, and interview practice in one place.",
                },
                {
                  icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
                  title: "Placement Readiness",
                  desc: "Live scores across learning, assessments, and interviews.",
                },
                {
                  icon: <ShieldCheck className="h-5 w-5 text-violet-400" />,
                  title: "Trusted Assessments",
                  desc: "Proctoring, integrity reports, and campus hiring workflows.",
                },
              ].map((f) => (
                <div key={f.title} className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="relative z-10 mt-8 border-t border-white/10 pt-4 text-xs text-white/50">
              © {new Date().getFullYear()} GradLogic Technologies. All rights reserved.
            </p>
          </section>

          <main className="max-h-[92dvh] overflow-y-auto bg-white/60 p-5 sm:p-8 lg:p-10 dark:bg-slate-950/40">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-5 flex items-center justify-center gap-2 lg:hidden">
                <Logo size={32} />
                <span className="text-lg font-bold tracking-tight">
                  Grad<span className="text-primary-600">Logic</span>
                </span>
              </div>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
