# Wave 1 — API Endpoint Checklist

For each endpoint: **200/2xx happy** · **401 unauth** · **403 wrong role** · **400 validation** · **response shape** · **idempotency/duplicates** as noted.

Login body uses `{ "email", "password" }` → token in `data.accessToken`.

---

## Auth & session

| ID | Method | Path | Checks | Status |
|----|--------|------|--------|--------|
| API-AUTH-01 | POST | `/api/auth/login` | Valid SA/CA/Student; wrong password 401 | PARTIAL |
| API-AUTH-02 | POST | `/api/auth/login` | Role tab mismatch is client-side; API still returns role | MANUAL |
| API-AUTH-03 | * | Protected routes | Missing Bearer → 401 | PARTIAL |

## Campuses / colleges

| ID | Method | Path | Checks | Status |
|----|--------|------|--------|--------|
| API-CAM-01 | GET | `/api/campuses` | SA lists campuses; includes Demo College | PARTIAL |
| API-CAM-02 | POST | `/api/campuses` | Create; duplicate email/code | PARTIAL |
| API-CAM-03 | PUT/PATCH | `/api/campuses/:id` | Update fields | PARTIAL |
| API-CAM-04 | POST | `/api/campuses/:id/approve` | Approval workflow | PARTIAL |

## Question Bank & collections

| ID | Method | Path | Checks | Status |
|----|--------|------|--------|--------|
| API-QB-01 | GET | `/api/question-bank` | Pagination; published filter | PARTIAL |
| API-QB-02 | POST | `/api/question-bank` | Create (roles: manage) | BACKLOG |
| API-QB-03 | GET | `/api/question-collections` | List + question_count | PARTIAL |
| API-QB-04 | POST | `/api/question-collections` | name min 3; category | PARTIAL |
| API-QB-05 | POST | `/api/question-collections/:id/fill-from-bank` | Requires category; limit 1–200 | PARTIAL |
| API-QB-06 | POST | `/api/question-collections/seed-phase1` | Idempotent shells | MANUAL |

## Assessment rules & drives

| ID | Method | Path | Checks | Status |
|----|--------|------|--------|--------|
| API-AR-01 | GET | `/api/assessment-rules` | Published rules present | PARTIAL |
| API-DR-01 | POST | `/api/drives` | collection_ids seeds pool | PARTIAL |
| API-DR-02 | GET | `/api/drives/:id` | Detail + status | PARTIAL |
| API-DR-03 | GET | `/api/drives/:id/pool` | Pool questions | PARTIAL |
| API-DR-04 | POST | `/api/drives/:id/pool/approve` | Approve / 409 if locked | PARTIAL |
| API-DR-05 | POST | `/api/drives/:id/seed-from-collections` | Reseed | PARTIAL |
| API-DR-06 | POST | `/api/drives/:id/assignments` | `{ college_id, segment }` | PARTIAL |
| API-DR-07 | POST | `/api/drives/:id/ready` | 400 if no students | MANUAL |
| API-DR-08 | POST | `/api/drives/:id/publish` | Live + notifications | PARTIAL |
| API-DR-09 | POST | `/api/drives/:id/generate` | AI pool (non-collection path) | BACKLOG |

## Exam sessions (student)

| ID | Method | Path | Checks | Status |
|----|--------|------|--------|--------|
| API-EX-01 | GET | `/api/exam-sessions/my-drives` | Assigned drives for student | PARTIAL |
| API-EX-02 | POST | `/api/exam-sessions/:driveId/enroll` | Enroll | BACKLOG |
| API-EX-03 | POST | `/api/exam-sessions/:driveId/start` | Start session | BACKLOG |
| API-EX-04 | PUT | `/api/exam-sessions/:driveId/save` | Autosave answer | BACKLOG |
| API-EX-05 | POST | `/api/exam-sessions/:driveId/submit` | Submit + score | BACKLOG |
| API-EX-06 | GET | `/api/exam-sessions/:driveId/evaluation` | Evaluation payload | BACKLOG |

## Campus (college) APIs

| ID | Method | Path | Checks | Status |
|----|--------|------|--------|--------|
| API-CD-01 | GET | `/api/campus/drives` | Only assigned platform drives | PARTIAL |
| API-CQ-01 | * | `/api/campus/questions` | CRUD Active questions | BACKLOG |
| API-CA-01 | * | `/api/campus/assessments` | Publish definition | BACKLOG |
| API-CC-01 | * | `/api/campus/campaigns` | Preview audience + publish | BACKLOG |
| API-CS-01 | * | `/api/campus/students` | Create/list; college scoped | PARTIAL |

## Assessment Hub & AI config

| ID | Method | Path | Checks | Status |
|----|--------|------|--------|--------|
| API-AH-01 | GET | `/api/assessment-hub/pipeline` (or dashboard) | Catalog steps KL→QB→… | PARTIAL |
| API-AI-01 | GET | `/api/superadmin/ai-services` | Lists `question_bank`, `drive_generation`, … | PARTIAL |
| API-AI-02 | POST | `/api/superadmin/ai-services/:key/test` | Connectivity | BACKLOG |

## Cross-cutting API checks (all Wave 1)

| ID | Check | Status |
|----|-------|--------|
| API-X-01 | Authorization: college cannot call `/api/drives` mutate | BACKLOG |
| API-X-02 | Student cannot call superadmin AI services | BACKLOG |
| API-X-03 | Rate limiting on login | PARTIAL |
| API-X-04 | Error body shape `{ success, error }` consistency | BACKLOG |
| API-X-05 | Audit events on campus create / drive publish | BACKLOG |
