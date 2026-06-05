import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
    ArrowRight, CheckCircle, Zap, BookOpen, BarChart3,
    Users, Trophy, Target, Brain, Mic,
    GraduationCap, Building2, UserCircle2, ChevronRight,
} from "lucide-react";

// ── Scroll fade-in hook ───────────────────────────────────────────────────────
function useFadeIn() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.opacity = "0";
        el.style.transform = "translateY(32px)";
        el.style.transition = "opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.75s cubic-bezier(0.16,1,0.3,1)";
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    el.style.opacity = "1";
                    el.style.transform = "translateY(0)";
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return ref;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const STATS = [
    { value: "500+",    label: "Partner Companies" },
    { value: "50+",     label: "Colleges Onboarded" },
    { value: "50,000+", label: "Candidates Assessed" },
    { value: "10,000+", label: "Placements Tracked" },
];

const ROLES = [
    {
        tag: "For HR & Companies",
        headline: "Hire campus talent at scale",
        icon: Building2,
        bg: "bg-indigo-50",
        border: "border-indigo-100",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        tagColor: "bg-indigo-100 text-indigo-700",
        ctaColor: "text-indigo-600 hover:text-indigo-700",
        points: [
            "Self-register and set up in minutes",
            "Register colleges & import students via CSV",
            "AI-generated assessments from your JD",
            "Candidate pipeline: shortlist → interview → offer",
        ],
        cta: "Register Your Company",
        href: "/auth/register",
    },
    {
        tag: "For Colleges & Campuses",
        headline: "Elevate your placement record",
        icon: GraduationCap,
        bg: "bg-blue-50",
        border: "border-blue-100",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        tagColor: "bg-blue-100 text-blue-700",
        ctaColor: "text-blue-600 hover:text-blue-700",
        points: [
            "Manage all placement drives in one place",
            "Track student readiness & skill progress",
            "LMS & practice arena for all students",
            "College-specific analytics & reports",
        ],
        cta: "Register Your College",
        href: "/campus/contact",
    },
    {
        tag: "For Students",
        headline: "Accelerate your career journey",
        icon: UserCircle2,
        bg: "bg-cyan-50",
        border: "border-cyan-100",
        iconBg: "bg-cyan-100",
        iconColor: "text-cyan-700",
        tagColor: "bg-cyan-100 text-cyan-700",
        ctaColor: "text-cyan-700 hover:text-cyan-800",
        points: [
            "Practice with Voice AI mock interviews",
            "Get instant feedback & course recommendations",
            "Learn with structured LMS courses & certificates",
            "Track readiness score, badges & XP",
        ],
        cta: "Sign Up Free",
        href: "/auth/register",
    },
] as const;

const FEATURES = [
    {
        icon: Target,
        title: "Assessment Drives",
        desc: "Create multi-college drives with eligibility filters, admit cards, and real-time leaderboards. Scale from 50 to 50,000 candidates.",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
    },
    {
        icon: Mic,
        title: "Voice AI Mock Interviews",
        desc: "Students practice with a live AI interviewer, receive instant feedback on communication and technical depth, and get course recommendations.",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
    },
    {
        icon: BookOpen,
        title: "Learning Management",
        desc: "Build structured courses, video lessons, and quizzes. Track completion across every student and every college.",
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
    },
    {
        icon: Zap,
        title: "Practice Arena",
        desc: "Daily coding, aptitude, and verbal practice with streaks, XP points, and AI-driven improvement insights.",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
    },
    {
        icon: Brain,
        title: "Mentor Connect",
        desc: "Assign mentors to students, log sessions, share feedback, and guide readiness toward placement goals.",
        iconBg: "bg-rose-100",
        iconColor: "text-rose-600",
    },
    {
        icon: BarChart3,
        title: "Placement Analytics",
        desc: "Cohort comparisons, skill heatmaps, readiness scores, and the full placement funnel — all in one hub.",
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
    },
] as const;

const STEPS = [
    {
        num: "01",
        title: "Onboard Colleges",
        desc: "Add partner campuses, upload student data, and set eligibility rules — done in a day.",
        icon: Building2,
    },
    {
        num: "02",
        title: "Run AI-Proctored Drives",
        desc: "Create assessments, send admit cards, monitor live, and get instant ranked results.",
        icon: Shield,
    },
    {
        num: "03",
        title: "Develop Student Skills",
        desc: "LMS, daily practice, mentoring sessions, and readiness scores keep students on track.",
        icon: BookOpen,
    },
    {
        num: "04",
        title: "Confirm Placements",
        desc: "Record offers, track packages, and generate college-wise placement reports instantly.",
        icon: Trophy,
    },
] as const;

const RESULTS = [
    { value: "22%",  label: "Average improvement in placement rates",        icon: Trophy,  iconBg: "bg-indigo-100", iconColor: "text-indigo-600" },
    { value: "60%",  label: "Reduction in HR screening time per drive",       icon: Zap,     iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
    { value: "3×",   label: "More candidates assessed per drive on average",  icon: Users,   iconBg: "bg-blue-100", iconColor: "text-blue-600" },
] as const;


const PORTALS = [
    {
        name: "Company / HR",
        desc: "Drives · Candidates · Analytics",
        icon: Building2,
        href: "/auth/login",
        bg: "bg-indigo-600 hover:bg-indigo-700",
    },
    {
        name: "College Admin",
        desc: "Campus drives · Student tracking",
        icon: GraduationCap,
        href: "/auth/login",
        bg: "bg-blue-600 hover:bg-blue-700",
    },
    {
        name: "Student",
        desc: "Exams · Mock Interviews · LMS",
        icon: UserCircle2,
        href: "/auth/login",
        bg: "bg-cyan-600 hover:bg-cyan-700",
    },
];

// ── Page component ────────────────────────────────────────────────────────────

export default function LandingPage() {
    const statsRef    = useFadeIn();
    const rolesRef    = useFadeIn();
    const featuresRef = useFadeIn();
    const stepsRef    = useFadeIn();
    const proofRef    = useFadeIn();

    return (
        <div className="bg-white font-sans">

            {/* ══════════════════════════════════════════════════════════════
                1. HERO
            ══════════════════════════════════════════════════════════════ */}
            <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
                {/* Ambient glow blobs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-32 left-[12%] h-[640px] w-[640px] rounded-full bg-indigo-600/20 blur-[130px]" />
                    <div className="absolute -bottom-24 right-[8%] h-[520px] w-[520px] rounded-full bg-blue-500/18 blur-[110px]" />
                    <div className="absolute top-[38%] left-[48%] h-[320px] w-[320px] rounded-full bg-cyan-500/12 blur-[90px]" />
                </div>

                {/* Dot-grid texture */}
                <div
                    className="absolute inset-0 opacity-[0.032] pointer-events-none"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                />

                <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-36 text-center lg:px-8">

                    {/* Eyebrow badge */}
                    <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-5 py-2 backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                            AI-Powered Talent Development &amp; Placement Platform
                        </span>
                    </div>

                    {/* Main headline */}
                    <h1 className="mx-auto max-w-5xl text-5xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
                        Build Skills.{" "}
                        <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            Run Drives.
                        </span>
                        <br className="hidden sm:block" />
                        {" "}Confirm Placements.
                    </h1>

                    {/* Sub-headline */}
                    <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
                        One intelligent platform connecting colleges, companies and students —
                        from skill development and AI-proctored assessment to confirmed campus placements.
                    </p>

                    {/* CTA row */}
                    <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <Link
                            to="/auth/register"
                            className="group flex items-center gap-2.5 rounded-xl bg-indigo-600 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-indigo-900/60 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/50 active:scale-95"
                        >
                            Get Started Free
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                        <Link
                            to="/contact"
                            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 active:scale-95"
                        >
                            Book a Demo
                            <ChevronRight className="h-4 w-4 opacity-60" />
                        </Link>
                    </div>

                    {/* Trust line */}
                    <p className="mt-8 text-xs font-medium tracking-wide text-slate-500">
                        Trusted by 50+ colleges · 500+ companies · Voice AI mock interviews · No credit card required
                    </p>
                </div>

                {/* Scroll cue */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-35 pointer-events-none">
                    <span className="text-[11px] text-slate-400 tracking-widest uppercase">Scroll</span>
                    <div className="h-8 w-px bg-gradient-to-b from-slate-400 to-transparent" />
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                2. STATS TRUST BAR
            ══════════════════════════════════════════════════════════════ */}
            <section ref={statsRef} className="border-b border-slate-100 bg-white py-16">
                <div className="mx-auto max-w-5xl px-6 lg:px-8">
                    <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
                        {STATS.map((s) => (
                            <div key={s.label} className="text-center">
                                <p className="text-3xl font-black tracking-tight text-indigo-600 sm:text-4xl">{s.value}</p>
                                <p className="mt-1.5 text-sm font-medium text-slate-500">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                3. FOR YOUR ROLE
            ══════════════════════════════════════════════════════════════ */}
            <section ref={rolesRef} className="bg-slate-50 py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    {/* Section header */}
                    <div className="text-center mb-16">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">One Platform, Every Role</p>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                            Built for everyone in the placement ecosystem
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
                            Whether you're hiring at scale, coordinating college drives, or preparing for your first job — GradLogic has the tools built exactly for you.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {ROLES.map((role) => (
                            <div
                                key={role.tag}
                                className={`flex flex-col rounded-3xl border ${role.border} ${role.bg} p-8`}
                            >
                                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${role.iconBg}`}>
                                    <role.icon className={`h-6 w-6 ${role.iconColor}`} strokeWidth={1.5} />
                                </div>
                                <span className={`mt-4 inline-block w-fit rounded-full px-3 py-1 text-xs font-bold ${role.tagColor}`}>
                                    {role.tag}
                                </span>
                                <h3 className="mt-3 text-xl font-bold text-slate-900">{role.headline}</h3>
                                <ul className="mt-5 flex-1 space-y-3">
                                    {role.points.map((point) => (
                                        <li key={point} className="flex items-start gap-2.5 text-sm text-slate-600">
                                            <CheckCircle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${role.iconColor}`} strokeWidth={2} />
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    to={role.href}
                                    className={`mt-8 flex items-center gap-1.5 text-sm font-bold transition-colors ${role.ctaColor}`}
                                >
                                    {role.cta} <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                4. PLATFORM FEATURES
            ══════════════════════════════════════════════════════════════ */}
            <section ref={featuresRef} className="bg-white py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">Platform Capabilities</p>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                            Everything you need. Nothing you don't.
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
                            Six tightly integrated modules that replace a stack of disconnected tools — built specifically for campus talent development and placement.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {FEATURES.map((f) => (
                            <div
                                key={f.title}
                                className="group rounded-3xl border border-slate-100 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-200 hover:shadow-xl"
                            >
                                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${f.iconBg}`}>
                                    <f.icon className={`h-6 w-6 ${f.iconColor}`} strokeWidth={1.5} />
                                </div>
                                <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                5. HOW IT WORKS
            ══════════════════════════════════════════════════════════════ */}
            <section ref={stepsRef} className="bg-slate-50 py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">How It Works</p>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                            From setup to placement in 4 steps
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map((step, i) => (
                            <div key={step.num} className="relative">
                                {/* Dashed connector line (desktop only) */}
                                {i < STEPS.length - 1 && (
                                    <div className="absolute top-7 left-[calc(50%+2.75rem)] right-[-1.25rem] hidden h-px border-t-2 border-dashed border-slate-200 lg:block" />
                                )}
                                <div className="flex flex-col items-center text-center">
                                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
                                        <step.icon className="h-7 w-7 text-white" strokeWidth={1.5} />
                                        <span className="absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-indigo-100 bg-white text-[10px] font-black text-indigo-600">
                                            {step.num}
                                        </span>
                                    </div>
                                    <h3 className="mt-5 text-base font-bold text-slate-900">{step.title}</h3>
                                    <p className="mt-2 max-w-[200px] text-sm leading-relaxed text-slate-500">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                6. RESULTS
            ══════════════════════════════════════════════════════════════ */}
            <section ref={proofRef} className="bg-white py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-600">Built for Impact</p>
                        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                            Everything you need, from day one
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
                            GradLogic is built to grow with you — whether you're running your first campus drive or managing placements across 50 colleges.
                        </p>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                        {RESULTS.map((r) => (
                            <div key={r.label} className="flex flex-col items-center rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center">
                                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${r.iconBg}`}>
                                    <r.icon className={`h-6 w-6 ${r.iconColor}`} strokeWidth={1.5} />
                                </div>
                                <p className="mt-4 text-5xl font-black tracking-tight text-slate-900">{r.value}</p>
                                <p className="mt-2 max-w-[160px] text-sm text-slate-500">{r.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                7. FINAL CTA STRIP
            ══════════════════════════════════════════════════════════════ */}
            <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 py-24">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-20 right-0 h-96 w-96 rounded-full bg-white/10 blur-[90px]" />
                    <div className="absolute -bottom-16 left-0 h-80 w-80 rounded-full bg-indigo-400/20 blur-[70px]" />
                </div>
                <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-8">
                    <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                        Ready to transform campus hiring?
                    </h2>
                    <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
                        Join colleges and companies already using GradLogic to assess, develop, and place talent at scale.
                    </p>
                    <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <Link
                            to="/auth/register"
                            className="group flex items-center gap-2.5 rounded-xl bg-white px-8 py-4 text-sm font-bold text-indigo-600 shadow-xl transition-all hover:bg-indigo-50 active:scale-95"
                        >
                            Get Started Free
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                        <Link
                            to="/contact"
                            className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
                        >
                            Book a Demo
                        </Link>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                8. PORTAL ENTRY (existing users)
            ══════════════════════════════════════════════════════════════ */}
            <section className="bg-slate-50 py-20">
                <div className="mx-auto max-w-4xl px-6 lg:px-8">
                    <div className="mb-10 text-center">
                        <p className="text-sm font-semibold text-slate-400">Already a GradLogic user?</p>
                        <h3 className="mt-2 text-xl font-bold text-slate-800">Sign in to your portal</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {PORTALS.map((portal) => (
                            <Link
                                key={portal.name}
                                to={portal.href}
                                className={`group flex items-center gap-4 rounded-2xl ${portal.bg} p-5 transition-all hover:-translate-y-1 hover:shadow-lg`}
                            >
                                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
                                    <portal.icon className="h-6 w-6 text-white" strokeWidth={1.5} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-white">{portal.name}</p>
                                    <p className="mt-0.5 text-xs text-white/70">{portal.desc}</p>
                                </div>
                                <ChevronRight className="h-5 w-5 flex-shrink-0 text-white/50 transition-transform group-hover:translate-x-1" />
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

        </div>
    );
}
