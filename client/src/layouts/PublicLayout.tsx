import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import Logo from "../components/Logo";

const NAV_LINKS = [
    // { label: "Lateral Hiring", href: "/lateral" },  // hidden — enable later
    { label: "Campus Hiring", href: "/campus" },
    { label: "Pricing", href: "/pricing" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
];

export default function PublicLayout({ children }: { children?: ReactNode }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();
    const isHome = location.pathname === "/";
    const useLightHeader = isHome && !scrolled;

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Close mobile menu on navigation
    useEffect(() => {
        setMobileOpen(false);
    }, [location]);

    return (
        <div className="min-h-screen bg-white">
            {/* ── Sticky Navbar ───────────────────────────────────────────── */}
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${!useLightHeader
                    ? "bg-white/80 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border-b border-slate-100"
                    : "bg-transparent"
                    }`}
            >
                <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <Logo size={36} className="group-hover:scale-105 transition-transform" />
                        <span className={`text-lg font-bold tracking-tight transition-colors ${useLightHeader ? "text-white" : "text-slate-900"}`}>
                            Grad<span className="text-indigo-500">Logic</span>
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden items-center gap-1 md:flex">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                to={link.href}
                                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${useLightHeader
                                    ? "text-white/80 hover:text-white hover:bg-white/10"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="hidden items-center gap-3 md:flex">
                        <Link
                            to="/auth/login"
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${useLightHeader
                                ? "text-white/90 hover:text-white"
                                : "text-slate-700 hover:text-slate-900"
                                }`}
                        >
                            Sign In
                        </Link>
                        <Link
                            to="/contact"
                            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700 hover:shadow-indigo-600/40 transition-all active:scale-95"
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
                        className={`md:hidden rounded-lg p-2 transition-colors ${useLightHeader ? "text-white hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                            }`}
                    >
                        {mobileOpen ? (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                            </svg>
                        )}
                    </button>
                </nav>

                {/* Mobile menu */}
                {mobileOpen && (
                    <div id="mobile-nav-menu" className="border-t border-slate-100 bg-white px-6 py-4 space-y-1 md:hidden animate-in slide-in-from-top-2 duration-200">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                to={link.href}
                                className="block rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                            <Link to="/auth/login" className="block rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                Sign In
                            </Link>
                            <Link to="/contact" className="block rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-bold text-white">
                                Book a Demo
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            {/* ── Page Content ────────────────────────────────────────────── */}
            <main>
                {children || <Outlet />}
            </main>

            {/* ── Footer ──────────────────────────────────────────────────── */}
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
                                    // { label: "Lateral Hiring", href: "/lateral" },         // hidden — enable later
                                    // { label: "Submit Your Profile", href: "/lateral/contact" }, // hidden — enable later
                                    { label: "Campus Hiring", href: "/campus" },
                                    { label: "Register Your College", href: "/campus/contact" },
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
                                    { label: "Pricing", href: "/pricing" },
                                    { label: "Contact", href: "/contact" },
                                    { label: "Careers", href: "/contact" },
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
                            <Link to="/terms" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
