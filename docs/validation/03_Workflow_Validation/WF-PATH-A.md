# WF-PATH-A — Platform Question Bank → College → Student

Primary Assessment Hub journey.

```
Publish QB → Collection fill → Assemble drive → Approve pool
  → Assign campus → Ready → Publish
  → College reviews Campus Drives
  → Student Learn → Practice → Exam → Results
```

**Tables:** `question_bank` → `question_collection_items` → `assessment_drives` / `drive_*` → `drive_assignments` / `drive_students` → exam session attempts.

**Automation:** `client/tests/e2e/sprint-1a/specs/flow-15-path-a-qb-to-student.spec.ts` · [PATH_A.md](../../../client/tests/e2e/sprint-1a/specs/PATH_A.md)

---

## Gates

| Gate | Actor | Action | Where | Pass when | Status |
|------|-------|--------|-------|-----------|--------|
| PA-1 | Super Admin | Published questions visible | `/question-bank/browse` | Rows present | PARTIAL |
| PA-2 | Super Admin | Collection has bank questions | `/question-collections/:id` · fill-from-bank | `question_count` ≥ 1 | PARTIAL |
| PA-3 | Super Admin | Create practice drive from collection | `/drives/new` | Drive id; pool seeded | PARTIAL |
| PA-4 | Super Admin | Approve pool | Drive Preview tab | Pool approved/locked | PARTIAL |
| PA-5 | Super Admin | Assign Demo College | `/drives/:id/assign-campus` | Assignment + students | PARTIAL |
| PA-6 | Super Admin | Mark Ready + Publish | Drive actions | Ready/Live/Published | PARTIAL |
| PA-7 | College Admin | See drive | `/college-portal/drives` | Drive name visible | PARTIAL |
| PA-8 | Student | Learn | `/my-learning` | Page loads | PARTIAL |
| PA-9 | Student | Practice | `/practice` | Hub loads | PARTIAL |
| PA-10 | Student | Drive on Tests; start exam | `/tests` → instructions/play | Drive visible; start best-effort | PARTIAL |
| PA-11 | Student | Results page | `/results` | Page loads | PARTIAL |
| PA-12 | Student + College | Submit score; college integrity/results | submit + campus drive detail | Score both sides | BACKLOG |

## Seed / env

| Item | Default |
|------|---------|
| Super Admin | `admin@gradlogic.com` / `Admin123` |
| College | `college@gradlogic.com` / `gradlogic123` |
| Student | `student4@democollege.edu` / `gradlogic123` |
| Campus | Demo College `eaef6179-285f-48a8-83a5-419d285feea7` |
| Client | `http://admin.localhost:5173` |
| API | `http://127.0.0.1:5050/api` |

## Known gaps

- College UI session switch after Super Admin (heal `clearAuthSession` + assert URL) — track under PA-7.
- Full exam submit + evaluation not asserted in flow-15.
- `/mock/:mockId` stub player is **out of scope**; use drive-based exams.
