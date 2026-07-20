# SuperAdmin CRUD + Soft Delete Audit

**Date:** 2026-07-12  
**Scope:** Admin / SuperAdmin portal entities  

## Standard applied

- **C** Create · **R** Read · **U** Update · **D** Soft delete (`deleted_at = NOW()`)
- Soft-deleted rows are excluded via `WHERE deleted_at IS NULL`
- Activate / restore clears `deleted_at` where applicable
- No hard `DELETE FROM` for primary SuperAdmin entities (questions permanent endpoint now soft-deletes)

## Feature status (after this change)

| Feature | Create | Read | Update | Soft Delete | Notes |
|---------|--------|------|--------|-------------|-------|
| Colleges | ✅ | ✅ | ✅ | ✅ `deleted_at` | Was status-only |
| Users | ✅ | ✅ | ✅ | ✅ `deleted_at` | Activate restores |
| Students | ✅ | ✅ | ✅ | ✅ `deleted_at` | New C/U/D APIs + UI |
| Roles | ✅ | ✅ | ✅ | ✅ | Already correct |
| Modules | ✅ | ✅ | ✅ | ✅ | Already correct |
| Categories | ✅ | ✅ | ✅ | ✅ `deleted_at` | |
| Questions | ✅ | ✅ | ✅ | ✅ `deleted_at` | Edit UI + soft delete |
| Workflows | ✅ | ✅ | ✅ | ✅ `deleted_at` | |
| Announcements | ✅ | ✅ | ✅ | ✅ `deleted_at` | PUT + edit UI |
| Email templates | ✅ | ✅ | ✅ | ✅ `deleted_at` | Full FE CRUD |
| Approvals / Review | — | ✅ | Approve/Reject | — | Workflow, not CRUD |
| Analytics / Billing / Audit | — | ✅ | — | — | Read-only by design |
| Settings / AI Config | — | ✅ | ✅ keys | — | Config, not entity CRUD |

## Backend files changed

- `server/src/controllers/users.controller.ts` — soft delete + restore
- `server/src/controllers/superadmin.controller.ts` — colleges, categories, announcements, templates
- `server/src/controllers/workflows.controller.ts` — soft delete
- `server/src/services/questionBank.service.ts` — soft delete; list filters `deleted_at`
- `server/src/controllers/superadminStudents.controller.ts` — create / update / soft delete
- `server/src/routes/superadminStudents.routes.ts` — POST/PUT/DELETE
- `server/src/routes/superadmin.routes.ts` — PUT announcements

## Frontend files changed

- `client/src/pages/superadmin/notifications/NotificationsPage.tsx` — full CRUD
- `client/src/pages/superadmin/question-bank/AllQuestionsPage.tsx` — edit modal + soft delete
- `client/src/pages/superadmin/students/AllStudentsPage.tsx` — create student
- `client/src/pages/superadmin/students/StudentDetailPage.tsx` — edit + soft delete
- `client/src/services/studentsService.ts` — create/update/delete helpers

## Intentionally not entity CRUD

- **Analytics, Billing, Audit Trail** — report / export only
- **Approvals / AI Review Queue** — approve/reject workflow
- **AI Config API keys** — environment-managed
- **Permissions catalog** — seeded; matrix assigns role↔permission only
