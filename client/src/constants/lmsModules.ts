import type { LucideIcon } from "lucide-react";
import {
  Brain,
  Code2,
  MessageSquare,
  Mic,
  GraduationCap,
  Building2,
  BookOpen,
  BarChart3,
  Sparkles,
} from "lucide-react";

/** Icon lookup for module keys (DB icon field is string slug). */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  building: Building2,
  brain: Brain,
  code: Code2,
  "message-circle": MessageSquare,
  mic: Mic,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  "bar-chart": BarChart3,
  sparkles: Sparkles,
};

export function moduleIcon(slug?: string | null): LucideIcon {
  return (slug && MODULE_ICONS[slug]) || BookOpen;
}

export interface EnabledLmsModule {
  key: string;
  name: string;
  description: string | null;
  module_type: "lms" | "platform";
  icon: string | null;
  features: string[];
  sort_order: number;
}
