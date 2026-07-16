// =============================================================================
// Single route that renders ComingSoonPage for any Organization Management
// sub-item without a real entity yet. Swap an entry out for a real page (and
// drop its key here) once that entity's table + routes are built.
// =============================================================================

import { useParams } from "react-router-dom";
import { Building, CalendarRange, BookOpenCheck, Layers, ClipboardCheck } from "lucide-react";
import ComingSoonPage from "./ComingSoonPage";

const ENTITIES: Record<string, { icon: typeof Building; title: string; description: string }> = {
  departments: {
    icon: Building,
    title: "Departments",
    description: "Academic departments within each college.",
  },
  "academic-years": {
    icon: CalendarRange,
    title: "Academic Years",
    description: "Academic year cycles (e.g. 2026-27) per college.",
  },
  semesters: {
    icon: CalendarRange,
    title: "Semesters",
    description: "Semester terms within an academic year.",
  },
  courses: {
    icon: BookOpenCheck,
    title: "Courses",
    description: "Degree / academic courses offered by a college.",
  },
  batches: {
    icon: Layers,
    title: "Batches",
    description: "Student batches / cohorts within a course.",
  },
  enrollment: {
    icon: ClipboardCheck,
    title: "Enrollment",
    description: "Student enrollment into a college, course, and batch.",
  },
};

export default function OrgComingSoonRoute() {
  const { entity } = useParams<{ entity: string }>();
  const meta = (entity && ENTITIES[entity]) || {
    icon: Building,
    title: "Organization Management",
    description: "",
  };

  return <ComingSoonPage icon={meta.icon} title={meta.title} description={meta.description} />;
}
