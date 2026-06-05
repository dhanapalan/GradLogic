import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
    Target, Mic, BookOpen, Zap, Brain, BarChart3,
    ChevronDown, ArrowRight, Sparkles,
} from "lucide-react";
import Logo from "../components/Logo";

// ── Platform mega-menu data ───────────────────────────────────────────────────

const PLATFORM_ITEMS = [
    {
        icon: BookOpen,
        label: "Learning Management",
        desc: "Structured courses, video lessons & certificates",
        badge: "LMS",
        badgeColor: "bg-indigo-100 text-indigo-700",
        iconBg: "bg-indigo-50",
        iconColor: "text-indigo-600",
        href: "/campus",
    },
    {
        icon: Mic,
        label: "Voice AI Interviews",
        desc: "Real-time AI interviewer with instant feedback",
        badge: "AI",
        badgeColor: "bg-blue-100 text-blue-700",
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        href: "/campus",
    },
    {
        icon: Target,
        label: "Assessment Drives",
        desc: "Multi-college drives with AI proctoring at scale",
        badge: null,
        badgeColor: "",
        iconBg: "bg-violet-50",
        iconColor: "text-violet-600",
        href: "/campus",
    },
    {
        icon: Zap,
        label: "Practice Arena",
        desc: "Daily coding, aptitude & verbal with streaks & XP",
        badge: null,
        badgeColor: "",
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        href: "/campus",
    },
    {
        icon: Brain,
        label: "Mentor Connect",
        desc: "Assign mentors, log sessions & track readiness",
        badge: null,
        badgeColor: "",
        iconBg: "bg-rose-50",
        iconColor: "text-rose-600",
        href: "/campus",
    },
    {
        icon: BarChart3,
        label: "Placement Analytics",
        desc: "Skill heatmaps, cohort scores & placement funnel",
        badge: null,
        badgeColor: "",
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        href: "/campus",
    },
];

const NAV_LINKS = [
    // { label: "Lateral Hiring", href: "/lateral" },  // hidden — enable later
    { label: "Campus Hiring", href: "/campus" },
    { label: "Pricing",       href: "/pricing" },
    { label: "About",         href: "/about" },
    { label: "Contact",       href: "/contact" },
];

// ── Layout ────────────────────────────────────────────────────────────────────

export default function PublicLayout({ children }: { children?: ReactNode }) {
    const [scrolled, setScrolled]       = useState(false);
    const [mobileOpen, setMobileOpen]   = useState(false);
    const [platformOpen, setPlatformOpen] = useState(false);
    const [mobilePlatformOpen, setMobilePlatformOpen] = useState(false);
    const platformRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const isHome = location.pathname === "/";
    const useLightHeader = isHome && !scrolled;

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        setMobileOpen(false);
        setMobilePlatformOpen(false);
    }, [location]);

    // Close platform dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (platformRef.current && !platformRef.current.contains(e.target as Node)) {
                setPlatformOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="min-h-screen bg-white">

            {/* ── Navbar ────────────────────────────────────────────────────── */}
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    scrolled ? "pt-3 px-4 lg:px-8" : ""
                }`}
            >
                <nav
                    className={`mx-auto flex items-center justify-between transition-all duration-500 ${
                        scrolled
                            ? "max-w-6xl rounded-2xl bg-white/90 backdrop-blur-xl shadow-xl shadow-black/[0.07] border border-slate-200/70 px-5 py-3"
                            : "max-w-7xl px-6 py-5 lg:px-8"
                    }`}
                >
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2.5 group shrink-0">
                        <Logo size={34} className="group-hover:scale-105 transition-transform duration-200" />
                        <span
                            className={`text-[17px] font-bold tracking-tight transition-colors duration-300 ${
                                useLightHeader ? "text-white" : "text-slate-900"
                            }`}
                        >
                            Grad<span className="text-indigo-500">Logic</span>
                        </span>
                    </Link>

                    {/* Desktop nav */}
                    <div className="hidden items-center gap-0.5 md:flex">

                        {/* Platform dropdown trigger */}
                        <div
                            ref={platformRef}
                            className="relative"
                            onMouseEnter={() => setPlatformOpen(true)}
                            onMouseLeave={() => setPlatformOpen(false)}
                        >
                            <button
                                type="button"
                                onClick={() => setPlatformOpen((v) => !v)}
                                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                                    useLightHeader
                                        ? platformOpen
                                            ? "text-white bg-white/15"
                                            : "text-white/75 hover:text-white hover:bg-white/10"
                                        : platformOpen
                                            ? "text-indigo-600 bg-indigo-50"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                }`}
                            >
                                Platform
                                <ChevronDown
                                    className={`h-3.5 w-3.5 transition-transform duration-200 ${platformOpen ? "rotate-180" : ""}`}
                                />
                            </button>

                            {/* Mega dropdown */}
                            {platformOpen && (
                                <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 w-[580px] rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-black/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                    {/* Header strip */}
                                    <div className="flex items-center gap-2.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-3.5">
                                        <Sparkles className="h-4 w-4 text-indigo-500" />
                                        <span className="text-xs font-bold uppercase tracking-widest text-indigo-700">
                                            AI-Powered Placement Platform
                                        </span>
                                    </div>

                                    {/* Feature grid */}
                                    <div className="grid grid-cols-2 gap-px bg-slate-100 p-px">
                                        {PLATFORM_ITEMS.map((item) => (
                                            <Link
                                                key={item.label}
                                                to={item.href}
                                                className="group flex items-start gap-3.5 bg-white p-4 transition-colors hover:bg-indigo-50/60"
                                            >
                                                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                                                    <item.icon className={`h-4.5 w-4.5 h-[18px] w-[18px] ${item.iconColor}`} strokeWidth={1.75} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                                                            {item.label}
                                                        </span>
                                                        {item.badge && (
                                                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${item.badgeColor}`}>
                                                                {item.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 text-xs leading-snug text-slate-500">{item.desc}</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>

                                    {/* Footer CTA */}
                                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                                        <span className="text-xs text-slate-500">All modules included — one subscription</span>
                                        <Link
                                            to="/auth/register"
                                            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                                        >
                                            Start Free <ArrowRight className="h-3 w-3" />
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Regular nav links */}
                        {NAV_LINKS.map((link) => {
                            const isActive = location.pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    to={link.href}
                                    className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 group ${
                                        useLightHeader
                                            ? isActive
                                                ? "text-white bg-white/15"
                                                : "text-white/75 hover:text-white hover:bg-white/10"
                                            : isActive
                                                ? "text-indigo-600 bg-indigo-50"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                                >
                                    {link.label}
                                    <span
                                        className={`absolute bottom-1 left-4 right-4 h-0.5 rounded-full transition-transform duration-200 origin-left ${
                                            isActive
                                                ? "scale-x-100 " + (useLightHeader ? "bg-white/70" : "bg-indigo-500")
                                                : "scale-x-0 group-hover:scale-x-100 " + (useLightHeader ? "bg-white/50" : "bg-indigo-400")
                                        }`}
                                    />
                                </Link>
                            );
                        })}
                    </div>

                    {/* Desktop CTAs */}
                    <div className="hidden items-center gap-2 md:flex">
                        <Link
                            to="/auth/login"
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                useLightHeader
                                    ? "text-white/80 hover:text-white hover:bg-white/10"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                        >
                            Sign In
                        </Link>
                        <Link
                            to="/auth/register"
                            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 active:scale-95 ${
                                useLightHeader
                                    ? "bg-white text-indigo-700 shadow-lg shadow-white/10 hover:bg-indigo-50"
                                    : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:from-indigo-500 hover:to-blue-500"
                            }`}
                        >
                            Get Started
                        </Link>
                        <Link
                            to="/contact"
                            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 active:scale-95 border ${
                                useLightHeader
                                    ? "border-white/25 text-white hover:bg-white/10"
                                    : "border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50"
                            }`}
                        >
                            Book a Demo
                        </Link>
                    </div>

                    {/* Mobile toggle */}
                    <button
                        type="button"
                        aria-controls="mobile-nav-menu"
                        aria-expanded={mobileOpen}
                        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className={`md:hidden rounded-xl p-2 transition-all duration-200 ${
                            useLightHeader
                                ? "text-white hover:bg-white/10"
                                : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        {mobileOpen ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                            </svg>
                        )}
                    </button>
                </nav>

                {/* Mobile menu */}
                {mobileOpen && (
                    <div
                        id="mobile-nav-menu"
                        className={`md:hidden mx-4 mt-2 overflow-hidden rounded-2xl border shadow-2xl shadow-black/10 animate-in slide-in-from-top-3 duration-200 ${
                            !scrolled && isHome
                                ? "border-white/10 bg-slate-900/95 backdrop-blur-xl"
                                : "border-slate-200/80 bg-white/95 backdrop-blur-xl"
                        }`}
                    >
                        <div className="px-3 py-3 space-y-0.5">
                            {/* Platform accordion */}
                            <button
                                type="button"
                                onClick={() => setMobilePlatformOpen((v) => !v)}
                                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                                    !scrolled && isHome
                                        ? "text-slate-300 hover:bg-white/10 hover:text-white"
                                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                }`}
                            >
                                Platform
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobilePlatformOpen ? "rotate-180" : ""}`} />
                            </button>
                            {mobilePlatformOpen && (
                                <div className={`mx-2 mb-1 rounded-xl overflow-hidden border ${
                                    !scrolled && isHome ? "border-white/10 bg-white/5" : "border-slate-100 bg-slate-50"
                                }`}>
                                    {PLATFORM_ITEMS.map((item) => (
                                        <Link
                                            key={item.label}
                                            to={item.href}
                                            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-b last:border-b-0 ${
                                                !scrolled && isHome
                                                    ? "border-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                                                    : "border-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                                            }`}
                                        >
                                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}>
                                                <item.icon className={`h-3.5 w-3.5 ${item.iconColor}`} strokeWidth={1.75} />
                                            </div>
                                            <span className="font-medium">{item.label}</span>
                                            {item.badge && (
                                                <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold ${item.badgeColor}`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            )}

                            {/* Regular links */}
                            {NAV_LINKS.map((link) => {
                                const isActive = location.pathname === link.href;
                                const dark = !scrolled && isHome;
                                return (
                                    <Link
                                        key={link.href}
                                        to={link.href}
                                        className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                                            dark
                                                ? isActive ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                                                : isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                    >
                                        {link.label}
                                        {isActive && (
                                            <span className={`ml-auto h-1.5 w-1.5 rounded-full ${dark ? "bg-indigo-400" : "bg-indigo-500"}`} />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        <div className={`px-3 pb-3 pt-2 border-t flex flex-col gap-2 ${
                            !scrolled && isHome ? "border-white/10" : "border-slate-100"
                        }`}>
                            <Link
                                to="/auth/login"
                                className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                                    !scrolled && isHome
                                        ? "text-slate-300 hover:bg-white/10 hover:text-white"
                                        : "text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                Sign In
                            </Link>
                            <Link
                                to="/auth/register"
                                className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-indigo-600/30"
                            >
                                Get Started Free
                            </Link>
                            <Link
                                to="/contact"
                                className={`rounded-xl border px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                                    !scrolled && isHome
                                        ? "border-white/20 text-white hover:bg-white/10"
                                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                Book a Demo
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            {/* ── Page Content ──────────────────────────────────────────────── */}
            <main>
                {children || <Outlet />}
            </main>

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <footer className="bg-indigo-950 text-white">
                <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
                    <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
                        {/* Brand */}
                        <div className="lg:col-span-1">
                            <div className="flex items-center gap-2.5">
                                <Logo size={36} />
                                <span className="text-lg font-bold">Grad<span className="text-indigo-400">Logic</span></span>
                            </div>
                            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
                                AI-Powered Talent Development &amp; Placement Platform — connecting colleges, companies, and students on one intelligent platform.
                            </p>
                        </div>

                        {/* Solutions */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Solutions</h4>
                            <ul className="mt-4 space-y-3">
                                {[
                                    { label: "Campus Hiring",          href: "/campus" },
                                    { label: "Register Your College",  href: "/campus/contact" },
                                ].map((item) => (
                                    <li key={item.label}>
                                        <Link to={item.href} className="text-sm text-slate-400 hover:text-white transition-colors">{item.label}</Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Company */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Company</h4>
                            <ul className="mt-4 space-y-3">
                                {[
                                    { label: "About Us", href: "/about" },
                                    { label: "Pricing",  href: "/pricing" },
                                    { label: "Contact",  href: "/contact" },
                                    { label: "Careers",  href: "/contact" },
                                ].map((item) => (
                                    <li key={item.label}>
                                        <Link to={item.href} className="text-sm text-slate-400 hover:text-white transition-colors">{item.label}</Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Connect */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-300">Connect</h4>
                            <ul className="mt-4 space-y-3">
                                <li><a href="mailto:hello@gradlogic.com" className="text-sm text-indigo-200 hover:text-white transition-colors">hello@gradlogic.com</a></li>
                                <li><a href="tel:+919876543210" className="text-sm text-indigo-200 hover:text-white transition-colors">+91 98765 43210</a></li>
                            </ul>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <Link to="/contact" className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                                    Book Demo
                                </Link>
                                <Link to="/pricing" className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                                    View Pricing
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-slate-500">© 2026 GradLogic Technologies Pvt. Ltd. All rights reserved.</p>
                        <div className="flex gap-6">
                            <Link to="/privacy" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</Link>
                            <Link to="/terms"   className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
