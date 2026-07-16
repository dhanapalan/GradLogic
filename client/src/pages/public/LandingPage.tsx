import { useEffect } from "react";
import { HeroSection } from "./home/HeroSection";
import { HighlightsSection } from "./home/HighlightsSection";
import { ReadinessSection } from "./home/ReadinessSection";
import { WhySection } from "./home/WhySection";
import { WorkflowSection } from "./home/WorkflowSection";
import { HomeFooter } from "./home/HomeFooter";

/**
 * GradLogic public marketing home — Vite/React (SSR would require Next.js migration).
 * Sections are code-split friendly and motion-aware (prefers-reduced-motion).
 *
 * Social-proof blocks (stats, testimonials, trusted-by logos) are omitted until
 * real customer metrics are available for a brand-new launch.
 */
export default function LandingPage() {
  useEffect(() => {
    document.title = "GradLogic — AI-Powered Talent Development Platform";
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <HeroSection />
      <HighlightsSection />
      <ReadinessSection />
      <WhySection />
      <WorkflowSection />
      <HomeFooter />
    </div>
  );
}
