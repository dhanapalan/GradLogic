import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import Logo from "../components/Logo";
import { ThemeToggle } from "../components/marketing/ThemeToggle";
import { HOME_NAV } from "../pages/public/home/constants";
import { cn } from "../lib/utils";

export default function PublicLayout({ children }: { children?: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-colors",
          scrolled || !isHome
            ? "border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90"
            : "border-transparent bg-transparent"
        )}
      >
        <nav
          className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
          aria-label="Primary"
        >
          <Link to="/" className="inline-flex items-center gap-2 shrink-0">
            <Logo size={32} />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Grad<span className="text-primary-600">Logic</span>
            </span>
          </Link>

          <div className="hidden items-center gap-0.5 xl:flex">
            {HOME_NAV.map((link) => {
              const isHash = link.href.includes("#");
              const pathOnly = link.href.split("#")[0] || "/";
              const active =
                !isHash &&
                (pathOnly === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(pathOnly));
              return (
                <Link
                  key={link.label}
                  to={link.href}
                  className={cn(
                    "rounded-lg px-2.5 py-2 text-sm font-medium transition",
                    "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    "dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                    active ? "text-primary-700 dark:text-primary-300" : ""
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle compact className="hidden sm:inline-flex" />
            <Link
              to="/auth/login"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Login
            </Link>
            <Link
              to="/auth/register"
              className="hidden rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 sm:inline-flex"
            >
              Register
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 xl:hidden dark:border-slate-700 dark:text-slate-200"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <div
            id="mobile-nav"
            className="border-t border-slate-200 bg-white px-4 py-4 xl:hidden dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex flex-col gap-1">
              {HOME_NAV.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <ThemeToggle compact />
              <Link
                to="/auth/login"
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold dark:border-slate-700"
              >
                Login
              </Link>
              <Link
                to="/auth/register"
                className="flex-1 rounded-xl bg-primary-600 py-2.5 text-center text-sm font-semibold text-white"
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </header>

      <main id="main-content">{children ?? <Outlet />}</main>

      {!isHome && (
        <footer className="border-t border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <p>
            © {new Date().getFullYear()} GradLogic ·{" "}
            <Link to="/privacy" className="hover:text-primary-600">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link to="/terms" className="hover:text-primary-600">
              Terms
            </Link>{" "}
            ·{" "}
            <Link to="/contact" className="hover:text-primary-600">
              Contact
            </Link>
          </p>
        </footer>
      )}
    </div>
  );
}
