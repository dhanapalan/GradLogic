# College Portal — CRUD & Data Isolation Audit

**Date:** 2026-07-12  
**Scope:** Campus / College Admin portal (`college_admin`, `college`, `college_staff`)

## Verdict

College portal **student CRUD** (create, read, update, soft-delete, bulk import/actions) is implemented on **JWT-scoped** `/api/campus/students`. Shared APIs that previously leaked cross-tenant data for college roles are now **forced to the caller's college** or blocked.

## Student CRUD (own college only)

| Operation | Endpoint | Isolation |
|-----------|----------|-----------|
| List / analytics | `GET /api/campus/students`, `/analytics` | JWT college; `deleted_at IS NULL` |
| Create | `POST /api/campus/students` | Ignores client `college_id`; always JWT college |
| Bulk import | `POST /api/campus/students/bulk-import` | Same |
| Update | `PUT /api/campus/students/:id` | Must belong to caller college |
| Soft delete | `DELETE /api/campus/students/:id` | Sets `deleted_at` |
| Bulk actions | `POST /api/campus/students/bulk-action` | suspend / activate / soft_delete / update_placement |

**UI:** College portal Students page uses in-portal Add / Bulk Upload modals (no more `/app/students/*` links). Detail page supports edit + soft delete.

## Data isolation hardening

| Area | Change |
|------|--------|
| Cheating logs / stats | College roles scoped via `resolveCallerCollegeId` |
| Proctoring events | Joined to student `college_id` for college roles |
| Analytics dashboard / drives | College filter forced; missing college → 403 |
| Global `/api/drives` | `college_admin` removed — use `/api/campus/drives` |
| Placements list / create / college summary | Forced JWT college; cross-college create blocked |
| Gamification `/stats/:collegeId` | Cross-college param → 403 |
| Development campus overview | Same |
| LMS bulk-enroll | College roles may only enroll own-college students |
| Question bank mutate | College roles **read-only** (writes: admin/HR only) |
| Campus settings `PUT /api/campuses/:id` | College can update **own** campus profile whitelist fields |
| Staff remove | Soft delete (`deleted_at`) instead of hard `DELETE` |

Helper: `server/src/middleware/collegeIsolation.ts`  
(`isCollegeScopedRole`, `resolveCallerCollegeId`, `effectiveCollegeId`, `assertSameCollege`)

## Portal wiring

- Soft Skills → `CollegeSkillsPage` (`/app/college-portal/soft-skills`)
- Assessments detail → `/app/college-portal/assessments/:id`
- Integrity nav → `/app/college-portal/integrity`
- Settings → own campus + daily practice target

## Still Coming Soon / limited

- Question Bank & Workflows portal pages (Coming Soon UI)
- Technical Skills page (Coming Soon)
- Workflow bulk-assign UI is stubbed (toast only)

## Isolation test checklist

1. Login as college A admin → list students → only college A.
2. Create / bulk-import student → appears only for A; B cannot see.
3. Soft-delete → gone from A roster; not returned in list.
4. `GET /api/cheating-logs` and `/api/proctoring/events` → only A students.
5. `GET /api/analytics/dashboard` → A totals only.
6. `GET /api/drives` as college_admin → **403**.
7. `GET /api/placements?college_id=<other>` as A → still only A data.
8. `PUT /api/campuses/<other-id>` as A → **403**.
9. Question bank `POST /api/questions` as college_admin → **403**.
