import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../theme/ThemeProvider";
import { cn } from "../../lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function ThemeToggle({ className, compact }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
        compact ? "h-9 w-9" : "h-10 w-10",
        className
      )}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
