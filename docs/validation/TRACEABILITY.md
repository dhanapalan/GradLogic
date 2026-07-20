# Validation Traceability Matrix

Scenario ID → UI route / API → automation → status.

Status values: `AUTOMATED` | `PARTIAL` | `MANUAL` | `BACKLOG`.

---

## Workflows (primary)

| ID | Scenario | Route / API | Automation | Status |
|----|----------|-------------|------------|--------|
| WF-ONB-01 | Super Admin login → dashboard | `/auth/login?role=super_admin` → `/app/superadmin/dashboard` · `POST /api/auth/login` | `flow-01-super-admin-login.spec.ts` | AUTOMATED |
| WF-ONB-02 | Create college + TPO credentials | `/app/superadmin/colleges/new` · `POST /api/campuses` (or colleges) | `flow-02`, `flow-03` | AUTOMATED |
| WF-ONB-03 | College admin login + password setup | College tab · setup-password | `flow-04` | AUTOMATED |
| WF-ONB-04 | Campus dashboard | `/app/college-portal/dashboard` | `flow-05` | AUTOMATED |
| WF-ONB-05 | Register student | `/app/college-portal/students/new` | `flow-06` | AUTOMATED |
| WF-ONB-06 | Student login + password | Student tab | `flow-07` | AUTOMATED |
| WF-ONB-07 | Student onboarding | `/student-onboarding` | `flow-08` | AUTOMATED |
| WF-ONB-08 | Student dashboard | `/app/student-portal` | `flow-09` | AUTOMATED |
| WF-PA-01 | QB published visible | `/app/superadmin/question-bank/browse` · `GET /api/question-bank` | `flow-15` 15.1 | PARTIAL |
| WF-PA-02 | Fill collection from bank | `/question-collections` · `POST …/fill-from-bank` | `flow-15` 15.2 · `path-a-api.ts` | PARTIAL |
| WF-PA-03 | Create practice drive from collection | `/drives/new` · `POST /api/drives` | `flow-15` 15.3 | PARTIAL |
| WF-PA-04 | Approve pool | Drive `?tab=pool` · `POST …/pool/approve` | `flow-15` 15.4 | PARTIAL |
| WF-PA-05 | Assign Demo College | `/drives/:id/assign-campus` · `POST …/assignments` | `flow-15` 15.5 | PARTIAL |
| WF-PA-06 | Ready + Publish | `POST …/ready`, `…/publish` | `flow-15` 15.6 | PARTIAL |
| WF-PA-07 | College sees assigned drive | `/app/college-portal/drives` · `GET /api/campus/drives` | `flow-15` 15.7 | PARTIAL |
| WF-PA-08 | Student learn | `/app/student-portal/my-learning` | `flow-15` 15.8 | PARTIAL |
| WF-PA-09 | Student practice | `/app/student-portal/practice` | `flow-15` 15.9 | PARTIAL |
| WF-PA-10 | Student exam start | `/tests`, `/exam/:id/*` · `/api/exam-sessions/*` | `flow-15` 15.10 | PARTIAL |
| WF-PA-11 | Student results page | `/app/student-portal/results` | `flow-15` 15.11 | PARTIAL |
| WF-PA-12 | Full submit + score + college results | exam submit · campus drive results | — | BACKLOG |
| WF-PB-01 | Campus QB → assessment → campaign → attempt | college-portal + my-assessments | `COLLEGE_DEMO_GUIDE.md` | MANUAL |

---

## UI / menus / hubs

| ID | Scenario | Route | Automation | Status |
|----|----------|-------|------------|--------|
| UI-MENU-SA | Super Admin menu landings | `/app/superadmin/*` | `menu-super-admin.spec.ts` | AUTOMATED |
| UI-MENU-CA | College Admin menu landings | `/app/college-portal/*` | `menu-college-admin.spec.ts` | AUTOMATED |
| UI-MENU-ST | Student menu landings | `/app/student-portal/*` | `menu-student.spec.ts` | AUTOMATED |
| UI-HUB-LH | Learning Hub feature matrix | KL / companion / journey | `learning-hub-audit.spec.ts` | PARTIAL |
| UI-HUB-AH | Assessment Hub feature matrix | assessment-hub … analytics | `assessment-hub-audit.spec.ts` | PARTIAL |
| UI-HUB-AI | AI Studio feature matrix | studio / review / ai-config | `ai-studio-audit.spec.ts` | PARTIAL |
| UI-TITLE | `GradLogic \| Hub \| Page` document titles | all hub pages | audits (soft fail) | BACKLOG |
| UI-CRUMB | Breadcrumbs on hub pages | all hub pages | audits (warn) | BACKLOG |

---

## Features (Wave 1)

| ID | Feature | Surface | Automation | Status |
|----|---------|---------|------------|--------|
| FE-COL-01 | College create / edit / suspend / activate | `/colleges` | `flow-02`, edge college specs | AUTOMATED |
| FE-QB-01 | Browse / search / filter questions | QB browse | hub audit + Path A 15.1 | PARTIAL |
| FE-QB-02 | Review queue approve/publish | `/question-bank/review-queue` | hub audit | PARTIAL |
| FE-QC-01 | Create collection + fill-from-bank | collections | Path A API + 15.2 | PARTIAL |
| FE-DR-01 | Assemble drive from collections | `/drives/new` | Path A 15.3 | PARTIAL |
| FE-DR-02 | Assign campus + eligibility students | assign-campus | Path A 15.5 | PARTIAL |
| FE-ST-01 | Practice hub session start | `/practice` · `/api/practice/*` | Path A 15.9 | PARTIAL |
| FE-ST-02 | Exam enroll/start/submit | exam-sessions | Path A 15.10 | PARTIAL |

---

## API (Wave 1)

| ID | Endpoint group | Prefix | Automation | Status |
|----|----------------|--------|------------|--------|
| API-AUTH | Login / sessions | `/api/auth` | sprint-1a + `api.integration.test.ts` | PARTIAL |
| API-CAMPUS | Campuses CRUD / approve | `/api/campuses` | flow-02 / campus specs | PARTIAL |
| API-QB | Question bank | `/api/question-bank` | Path A helper | PARTIAL |
| API-QC | Collections | `/api/question-collections` | Path A helper | PARTIAL |
| API-DRV | Platform drives | `/api/drives` | Path A helper | PARTIAL |
| API-EX | Exam sessions | `/api/exam-sessions` | Path A 15.10 (UI) | PARTIAL |
| API-CDRV | Campus drives | `/api/campus/drives` | Path A 15.7 | PARTIAL |
| API-CAM | Campus assessments/campaigns | `/api/campus/assessments`, `/campaigns` | — | BACKLOG |
| API-AH | Assessment hub pipeline | `/api/assessment-hub` | hub-integration-smoke | PARTIAL |
| API-AI | AI service config | `/api/superadmin/ai-services` | hub-integration-smoke | PARTIAL |

---

## Integration / AI / Security

| ID | Scenario | Surface | Automation | Status |
|----|----------|---------|------------|--------|
| INT-PIPE | KL → QB → collections → drives metrics | `/assessment-hub` · `assessmentPipeline.service` | `hub-integration-smoke` | PARTIAL |
| INT-SPOF | Shared `ai_service_configs` | `/ai-config` · `aiServiceConfig.service` | hub-integration-smoke | PARTIAL |
| AI-QB | AI question generate / review | `/qb-ai`, review-queue, companion studio | hub audits | PARTIAL |
| AI-DRV | Drive pool AI generate (non-hub path) | `POST /drives/:id/generate` | — | BACKLOG |
| SEC-TAB | Login tab must match role | LoginPage + loginRoles | edge login + product enforce | PARTIAL |
| SEC-ISO | Campus data isolation | college APIs scoped by college_id | — | BACKLOG |
| SEC-OWASP | OWASP Top 10 suite | app-wide | — | BACKLOG |

---

## npm scripts (regression entry points)

| Script | Maps to |
|--------|---------|
| `npm run test:sprint1a` | Onboarding + core flows |
| `npm run test:sprint1a:menus` | UI-MENU-* |
| `npm run test:sprint1a:hub-audits` | UI-HUB-* + INT-* |
| `npm run test:sprint1a:path-a` | WF-PA-* |
| `npm run test:sprint1a:edge` | Edge / negative |
| `npm run test:unit` (server) | Narrow unit rules only |

---

## Module backlog (Wave 2+)

Learning Hub deep features, Voice Studio, Faculty/Mentor/HR/Company portals, Billing (beyond flow-11), Certificates issuance, Placement Coach AI quality, Load/Stress formal suites — tracked as BACKLOG in folders `01`–`12` READMEs.
