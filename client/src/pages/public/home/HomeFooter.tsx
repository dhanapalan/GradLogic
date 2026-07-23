import { Link } from "react-router-dom";
import { Github, Linkedin, Twitter } from "lucide-react";
import Logo from "../../../components/Logo";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Colleges", href: "/campus" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Support", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
] as const;

export function HomeFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-white">
            <Logo size={32} />
            <span className="font-display text-lg font-bold">
              Grad<span className="text-primary-400">Logic</span>
            </span>
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            AI-powered learning and placement-readiness platform for colleges and students.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="https://linkedin.com" className="rounded-lg p-2 hover:bg-white/10" aria-label="LinkedIn">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="https://twitter.com" className="rounded-lg p-2 hover:bg-white/10" aria-label="Twitter">
              <Twitter className="h-4 w-4" />
            </a>
            <a href="https://github.com" className="rounded-lg p-2 hover:bg-white/10" aria-label="GitHub">
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.href} className="text-sm hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} GradLogic Technologies Pvt. Ltd. All rights reserved.
      </div>
    </footer>
  );
}
