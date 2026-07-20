/**
 * Portal menu catalogs — labels, paths, expected headings.
 * Keep in sync with CollegeLayout / SuperAdminLayout / StudentPortalLayout.
 */

export type MenuItem = {
  label: string;
  path: string;
  /** Expected heading (h1/h2) — soft match */
  heading: string | RegExp;
  hub?: string;
  /** If true, page may be Coming Soon / empty — still must not crash */
  soft?: boolean;
};

export const COLLEGE_ADMIN_MENUS: MenuItem[] = [
  { label: "Dashboard", path: "/app/college-portal/dashboard", heading: /College Dashboard/i },
  { label: "Students", path: "/app/college-portal/students", heading: /^Students$/i },
  { label: "Question Bank", path: "/app/college-portal/question-bank", heading: /Question Bank/i },
  { label: "Workflows", path: "/app/college-portal/workflows", heading: /Workflows/i, soft: true },
  {
    label: "Tests & Assessments",
    path: "/app/college-portal/assessments",
    heading: /Tests & Assessments|Assessments/i,
  },
  {
    label: "Assessment Campaigns",
    path: "/app/college-portal/campaigns",
    heading: /Assessment Campaigns|Campaigns/i,
  },
  {
    label: "Campus Drives",
    path: "/app/college-portal/drives",
    heading: /Recruitment Drives|Campus Drives|Drives/i,
  },
  {
    label: "Analytics & Reports",
    path: "/app/college-portal/analytics",
    heading: /Analytics/i,
  },
  { label: "Integrity", path: "/app/college-portal/integrity", heading: /Integrity/i },
  {
    label: "Soft Skills",
    path: "/app/college-portal/soft-skills",
    heading: /Skills|Soft Skills/i,
    soft: true,
  },
  {
    label: "Technical Skills",
    path: "/app/college-portal/technical-skills",
    heading: /Technical Skills/i,
    soft: true,
  },
  { label: "Settings", path: "/app/college-portal/settings", heading: /College Profile|Settings/i },
];

/** Flattened Super Admin leaf menus (visible nav; Enrollments excluded — hidden). */
export const SUPER_ADMIN_MENUS: MenuItem[] = [
  { label: "Dashboard", path: "/app/superadmin/dashboard", heading: /Admin Dashboard/i, hub: "Dashboard" },

  // Organization
  { label: "Colleges", path: "/app/superadmin/colleges", heading: /All Colleges/i, hub: "Organization Management" },
  { label: "Faculty", path: "/app/superadmin/users?role=instructor", heading: /Faculty|Users|All Users/i, hub: "Organization Management" },
  { label: "Students", path: "/app/superadmin/students", heading: /Students/i, hub: "Organization Management" },
  { label: "Batches", path: "/app/superadmin/batches", heading: /Batch/i, hub: "Organization Management", soft: true },
  { label: "Certificates", path: "/app/superadmin/certificates", heading: /Certificate/i, hub: "Organization Management", soft: true },

  // Learning Hub — key leaves (full KL tree)
  { label: "Knowledge Library Dashboard", path: "/app/superadmin/knowledge-library", heading: /Knowledge Library/i, hub: "Learning Hub", soft: true },
  { label: "All Knowledge", path: "/app/superadmin/knowledge-library/all", heading: /Knowledge|All/i, hub: "Learning Hub", soft: true },
  { label: "Lessons", path: "/app/superadmin/knowledge-library/assets/lessons", heading: /Lesson/i, hub: "Learning Hub", soft: true },
  { label: "Questions", path: "/app/superadmin/knowledge-library/assets/questions", heading: /Question/i, hub: "Learning Hub", soft: true },
  { label: "Flashcards", path: "/app/superadmin/knowledge-library/assets/flashcards", heading: /Flashcard/i, hub: "Learning Hub", soft: true },
  { label: "Coding Challenges", path: "/app/superadmin/knowledge-library/assets/coding", heading: /Coding/i, hub: "Learning Hub", soft: true },
  { label: "Case Studies", path: "/app/superadmin/knowledge-library/assets/case-studies", heading: /Case/i, hub: "Learning Hub", soft: true },
  { label: "Interview Questions", path: "/app/superadmin/knowledge-library/assets/interview-questions", heading: /Interview/i, hub: "Learning Hub", soft: true },
  { label: "Voice Lessons (KL)", path: "/app/superadmin/knowledge-library/assets/voice-lessons", heading: /Voice|Lesson/i, hub: "Learning Hub", soft: true },
  { label: "Videos", path: "/app/superadmin/knowledge-library/assets/videos", heading: /Video/i, hub: "Learning Hub", soft: true },
  { label: "Documents", path: "/app/superadmin/knowledge-library/assets/documents", heading: /Document|Resource/i, hub: "Learning Hub", soft: true },
  { label: "Organization", path: "/app/superadmin/knowledge-library/organization", heading: /Organization|Categor/i, hub: "Learning Hub", soft: true },
  { label: "Categories", path: "/app/superadmin/knowledge-library/organization/categories", heading: /Categor/i, hub: "Learning Hub", soft: true },
  { label: "Subjects", path: "/app/superadmin/knowledge-library/organization/subjects", heading: /Subject/i, hub: "Learning Hub", soft: true },
  { label: "Topics (KL)", path: "/app/superadmin/knowledge-library/organization/topics", heading: /Topic/i, hub: "Learning Hub", soft: true },
  { label: "Skills (KL)", path: "/app/superadmin/knowledge-library/organization/skills", heading: /Skill/i, hub: "Learning Hub", soft: true },
  { label: "Tags", path: "/app/superadmin/knowledge-library/organization/tags", heading: /Tag/i, hub: "Learning Hub", soft: true },
  { label: "Collections", path: "/app/superadmin/knowledge-library/collections", heading: /Collection/i, hub: "Learning Hub", soft: true },
  { label: "AI Features", path: "/app/superadmin/knowledge-library/ai", heading: /AI/i, hub: "Learning Hub", soft: true },
  { label: "Enterprise", path: "/app/superadmin/knowledge-library/enterprise", heading: /Enterprise/i, hub: "Learning Hub", soft: true },
  { label: "Create Asset", path: "/app/superadmin/knowledge-library/create", heading: /Create|Asset|Knowledge/i, hub: "Learning Hub", soft: true },
  { label: "AI Learning Companion", path: "/app/superadmin/learning-companion", heading: /Learning Companion|AI/i, hub: "Learning Hub", soft: true },
  { label: "Course Builder", path: "/app/superadmin/course-builder", heading: /Course/i, hub: "Learning Hub", soft: true },
  { label: "Course Catalog", path: "/app/superadmin/course-catalog/tracks", heading: /Track|Catalog|Course/i, hub: "Learning Hub", soft: true },
  { label: "AI Learning Journey", path: "/app/superadmin/learning-journey", heading: /Learning Journey|Journey/i, hub: "Learning Hub", soft: true },

  // Assessment Hub
  { label: "Assessment Hub Dashboard", path: "/app/superadmin/assessment-hub", heading: /Assessment/i, hub: "Assessment Hub", soft: true },
  { label: "Question Bank", path: "/app/superadmin/question-bank", heading: /Question/i, hub: "Assessment Hub", soft: true },
  { label: "Question Collections", path: "/app/superadmin/question-collections", heading: /Collection/i, hub: "Assessment Hub", soft: true },
  { label: "Assessment Builder", path: "/app/superadmin/drives", heading: /Drive|Assessment|Builder/i, hub: "Assessment Hub", soft: true },
  { label: "Assessment Templates", path: "/app/superadmin/assessment-templates", heading: /Template/i, hub: "Assessment Hub", soft: true },
  { label: "Practice Sets", path: "/app/superadmin/practice-sets", heading: /Practice/i, hub: "Assessment Hub", soft: true },
  { label: "Mock Tests", path: "/app/superadmin/mock-tests", heading: /Mock/i, hub: "Assessment Hub", soft: true },
  { label: "Coding Assessments", path: "/app/superadmin/coding-assessments", heading: /Coding/i, hub: "Assessment Hub", soft: true },
  { label: "Results & Evaluation", path: "/app/superadmin/assessment-results", heading: /Result|Evaluation/i, hub: "Assessment Hub", soft: true },
  { label: "Certificates (Assessment)", path: "/app/superadmin/certificates", heading: /Certificate/i, hub: "Assessment Hub", soft: true },
  { label: "Assessment Analytics", path: "/app/superadmin/analytics/assessments", heading: /Analytics|Assessment/i, hub: "Assessment Hub", soft: true },

  // AI Studio
  { label: "Content Generator", path: "/app/superadmin/learning-companion/studio", heading: /Studio|Content|Generator/i, hub: "AI Studio", soft: true },
  { label: "AI Review Center", path: "/app/superadmin/learning-companion/review", heading: /Review/i, hub: "AI Studio", soft: true },
  { label: "AI Content Improver", path: "/app/superadmin/ai-studio/content-improver", heading: /Improver|Content|AI/i, hub: "AI Studio", soft: true },
  { label: "Translation Studio", path: "/app/superadmin/ai-studio/translation", heading: /Translation/i, hub: "AI Studio", soft: true },
  { label: "AI Models", path: "/app/superadmin/ai-config", heading: /AI|Model|Config/i, hub: "AI Studio", soft: true },
  { label: "Embedding Manager", path: "/app/superadmin/ai-studio/embeddings", heading: /Embedding/i, hub: "AI Studio", soft: true },

  // Voice Studio
  { label: "AI Tutor Voices", path: "/app/superadmin/voice-studio/tutor-voices", heading: /Voice|Tutor/i, hub: "Voice Studio", soft: true },
  { label: "Languages", path: "/app/superadmin/voice-studio/languages", heading: /Language/i, hub: "Voice Studio", soft: true },
  { label: "Audio Library", path: "/app/superadmin/voice-studio/audio-library", heading: /Audio/i, hub: "Voice Studio", soft: true },
  { label: "Voice Templates", path: "/app/superadmin/voice-studio/templates", heading: /Template|Voice/i, hub: "Voice Studio", soft: true },
  { label: "Voice Analytics", path: "/app/superadmin/analytics/voice", heading: /Voice|Analytics/i, hub: "Voice Studio", soft: true },

  // Analytics
  { label: "Platform Analytics", path: "/app/superadmin/analytics", heading: /Analytics/i, hub: "Analytics", soft: true },
  { label: "Learning Analytics", path: "/app/superadmin/analytics/learning", heading: /Learning|Analytics/i, hub: "Analytics", soft: true },
  { label: "Student Analytics", path: "/app/superadmin/analytics/students", heading: /Student|Analytics/i, hub: "Analytics", soft: true },
  { label: "Skills Analytics", path: "/app/superadmin/analytics/skills", heading: /Skill|Analytics/i, hub: "Analytics", soft: true },
  { label: "AI Usage", path: "/app/superadmin/learning-companion/analytics", heading: /Analytics|AI|Usage/i, hub: "Analytics", soft: true },

  // Administration
  { label: "Users", path: "/app/superadmin/users", heading: /User|All Users/i, hub: "Administration" },
  { label: "Roles", path: "/app/superadmin/roles", heading: /Role/i, hub: "Administration" },
  { label: "Permissions", path: "/app/superadmin/roles/matrix", heading: /Permission|Matrix|Role/i, hub: "Administration", soft: true },
  { label: "Notifications", path: "/app/superadmin/notifications", heading: /Notification/i, hub: "Administration", soft: true },
  { label: "Audit Logs", path: "/app/superadmin/audit-trail", heading: /Audit/i, hub: "Administration" },
  { label: "Branding", path: "/app/superadmin/branding", heading: /Brand/i, hub: "Administration", soft: true },
  { label: "Integrations", path: "/app/superadmin/integrations", heading: /Integration/i, hub: "Administration", soft: true },
  { label: "AI Configuration", path: "/app/superadmin/ai-config?tab=services", heading: /AI|Config|Service/i, hub: "Administration", soft: true },
  { label: "Platform Settings", path: "/app/superadmin/settings", heading: /Setting|System|Backup/i, hub: "Administration", soft: true },
  { label: "License", path: "/app/superadmin/license", heading: /License/i, hub: "Administration", soft: true },
];

export const STUDENT_MENUS: MenuItem[] = [
  { label: "Dashboard", path: "/app/student-portal", heading: /Dashboard|Welcome/i },
  { label: "Learning Hub", path: "/app/student-portal/my-learning", heading: /Learning Hub|Learning/i },
  { label: "Practice Hub", path: "/app/student-portal/practice", heading: /Practice/i },
  { label: "My Assessments", path: "/app/student-portal/my-assessments", heading: /Assessment/i },
  { label: "Results", path: "/app/student-portal/results", heading: /Result/i },
  { label: "AI Coach", path: "/app/student-portal/placement-coach", heading: /Coach|AI/i, soft: true },
  { label: "Profile", path: "/app/student-portal/profile", heading: /Profile/i },
  { label: "Notifications", path: "/app/student-portal/notifications", heading: /Notification/i },
  { label: "Settings", path: "/app/student-portal/settings", heading: /Settings/i },
];
