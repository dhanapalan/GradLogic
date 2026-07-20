import { Link } from "react-router-dom";
import { useState } from "react";

const TIERS = [
    {
        name: "Starter",
        price: "Free",
        period: "",
        description: "For startups and small teams getting started with structured hiring.",
        features: [
            "Up to 5 active jobs",
            "Applicant tracking (ATS)",
            "Resume parsing",
            "Basic assessments",
            "Email notifications",
            "Career page",
            "Basic analytics",
        ],
        cta: "Get Started",
        href: "/contact",
        highlight: false,
    },
    {
        name: "Professional",
        price: "₹25,000",
        period: "/month",
        description: "Full lateral + campus hiring suite with AI-powered features.",
        features: [
            "Unlimited job postings",
            "Advanced ATS with pipeline",
            "Campus ATS & drive management",
            "AI-powered assessments",
            "Video interviews (live & async)",
            "AI proctoring",
            "Automated workflows",
            "Advanced analytics & reports",
            "Bulk candidate import",
            "Custom branding",
            "Priority support",
        ],
        cta: "Start Free Trial",
        href: "/contact",
        highlight: true,
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "",
        description: "Tailored for large organisations with multi-entity, high-volume hiring needs.",
        features: [
            "Everything in Professional",
            "Unlimited users & entities",
            "Multi-campus management",
            "SSO & LDAP integration",
            "Background verification",
            "HRIS / ATS connectors",
            "Dedicated account manager",
            "On-premise deployment option",
            "SLA guarantee (99.9%)",
            "API access & webhooks",
        ],
        cta: "Contact Sales",
        href: "/contact",
        highlight: false,
    },
];

export default function PricingPage() {
    const [annual, setAnnual] = useState(true);

    return (
        <div className="pt-24">
            {/* Hero */}
            <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white py-20 sm:py-28">
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-0 left-1/3 h-72 w-72 rounded-full bg-indigo-200 blur-[100px]" />
                    <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-blue-200 blur-[80px]" />
                </div>
                <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Pricing</p>
                    <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                        Plans that scale with your hiring
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
                        Start free for lateral or campus hiring. Upgrade as you grow. No hidden fees.
                    </p>

                    {/* Toggle */}
                    <div className="mt-8 flex items-center justify-center gap-3">
                        <span className={`text-sm font-semibold ${!annual ? "text-slate-900" : "text-slate-400"}`}>Monthly</span>
                        <button
                            onClick={() => setAnnual(!annual)}
                            className={`relative h-7 w-12 rounded-full transition-colors ${annual ? "bg-indigo-600" : "bg-slate-300"}`}
                        >
                            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${annual ? "translate-x-5" : "translate-x-0.5"}`} />
                        </button>
                        <span className={`text-sm font-semibold ${annual ? "text-slate-900" : "text-slate-400"}`}>
                            Annual <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Save 20%</span>
                        </span>
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="pb-24 sm:pb-32 -mt-4">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        {TIERS.map((tier) => (
                            <div
                                key={tier.name}
                                className={`relative rounded-3xl border p-8 transition-all ${tier.highlight
                                    ? "border-indigo-200 bg-white shadow-xl shadow-indigo-600/10 scale-[1.02]"
                                    : "border-slate-200 bg-white hover:shadow-lg"
                                    }`}
                            >
                                {tier.highlight && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-1 text-xs font-bold text-white shadow-lg">
                                        Most Popular
                                    </div>
                                )}
                                <h3 className="text-lg font-bold text-slate-900">{tier.name}</h3>
                                <div className="mt-4 flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-900">
                                        {tier.price === "₹25,000" && annual ? "₹20,000" : tier.price}
                                    </span>
                                    {tier.period && <span className="text-sm text-slate-400">{tier.period}</span>}
                                </div>
                                <p className="mt-3 text-sm text-slate-500">{tier.description}</p>

                                <Link
                                    to={tier.href}
                                    className={`mt-8 block w-full rounded-xl px-4 py-3.5 text-center text-sm font-bold transition-all active:scale-95 ${tier.highlight
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700"
                                        : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                                        }`}
                                >
                                    {tier.cta}
                                </Link>

                                <ul className="mt-8 space-y-3">
                                    {tier.features.map((f) => (
                                        <li key={f} className="flex items-start gap-3 text-sm text-slate-600">
                                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                            </svg>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="border-t border-slate-100 bg-slate-50 py-24 sm:py-32">
                <div className="mx-auto max-w-3xl px-6 lg:px-8">
                    <h2 className="text-center text-2xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
                    <div className="mt-12 space-y-6">
                        {[
                            { q: "Is there a free trial?", a: "Yes! Our Professional plan comes with a 14-day free trial. No credit card required." },
                            { q: "Can I use it for lateral hiring only?", a: "Absolutely. Use just the ATS, assessments, and video interviews for lateral roles — or activate the Campus ATS module when needed." },
                            { q: "Does it work for campus hiring too?", a: "Yes. Our dedicated Campus ATS handles campus drives, bulk registration, eligibility checks, admit cards, and campus-specific workflows." },
                            { q: "What payment methods do you accept?", a: "We accept all major credit/debit cards, UPI, net banking, and wire transfers for Enterprise plans." },
                        ].map(({ q, a }) => (
                            <div key={q} className="rounded-2xl border border-slate-200 bg-white p-6">
                                <h3 className="text-sm font-bold text-slate-900">{q}</h3>
                                <p className="mt-2 text-sm text-slate-500">{a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
