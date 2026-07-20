# Wave 1 — Feature Validation

## 1. College module (Super Admin)

| Feature | Validate | Route / API | Status |
|---------|----------|-------------|--------|
| Add College | Can create | `POST` campuses/colleges · `/colleges/new` | AUTOMATED |
| Duplicate prevention | Duplicate email/code rejected | API 409/400 | PARTIAL |
| Mandatory fields | Name/email/required blocked | UI + API | AUTOMATED |
| Invalid email | Rejected | UI/API | PARTIAL |
| Phone validation | Format rules | UI/API | BACKLOG |
| Address validation | Accepts long/unicode | edge college specs | PARTIAL |
| Status / Activation | Suspend ↔ Active | flow-02 | AUTOMATED |
| Audit log | Create/suspend logged | `/api/audit-logs` | BACKLOG |
| Notification | TPO credential notify if configured | notifications | BACKLOG |

## 2. Question Bank (platform)

| Feature | Validate | Surface | Status |
|---------|----------|---------|--------|
| Browse published | Rows for `question_bank` active/published | `/question-bank/browse` | PARTIAL |
| Search / filters | Category, difficulty, type | browse UI | PARTIAL |
| Create / import | Manual or CSV/books | browse / import-books | PARTIAL |
| Review queue | Approve → published | review-queue | PARTIAL |
| AI generate | Items enter review/bank | ai-generator · `/api/qb-ai` | PARTIAL |
| Soft delete | Deleted not selectable for new collections | API `deleted_at` | BACKLOG |

## 3. Question Collections

| Feature | Validate | Surface | Status |
|---------|----------|---------|--------|
| Create collection | Name ≥3 + Phase-1 category | `POST /question-collections` | PARTIAL |
| Fill from bank | Pulls matching category | `POST …/fill-from-bank` | PARTIAL |
| Empty category | Fill fails with clear error | API 400 | MANUAL |
| Reuse IDs only | No duplicated bank content | collection items join | MANUAL |

## 4. Assessment Builder (drives)

| Feature | Validate | Surface | Status |
|---------|----------|---------|--------|
| Assemble from collections | Requires ≥1 collection (hub) | `/drives/new` | PARTIAL |
| Rule required | Name + rule_id | API/UI | PARTIAL |
| Types | hiring / practice_test / mock_test / coding_assessment | create form | PARTIAL |
| Pool seed | `drive_pool_questions` populated | create/seed | PARTIAL |
| Pool approve | Locks pool | `POST …/pool/approve` | PARTIAL |
| Assign campus | `drive_assignments` + `drive_students` | assign-campus | PARTIAL |
| Ready guard | READY blocked with no students | `POST …/ready` | MANUAL |
| Publish | Status live/published; students notified | `POST …/publish` | PARTIAL |

## 5. College portal features

| Feature | Validate | Surface | Status |
|---------|----------|---------|--------|
| View assigned drives | Path A drives for college_id | `/campus/drives` | PARTIAL |
| Student registration | Create + list | students CRUD | AUTOMATED |
| Campus QB | Active `college_questions` | campus question-bank | MANUAL |
| Publish assessment | Definition with questions | campus assessments | MANUAL |
| Campaign window | Audience + dates | campus campaigns | MANUAL |
| Eligibility verify | Student eligibility flags | students filter | BACKLOG |

## 6. Student features

| Feature | Validate | Surface | Status |
|---------|----------|---------|--------|
| Learn | My Learning loads | `/my-learning` | PARTIAL |
| Practice | Start quiz/coding session | `/practice` · `/api/practice` | PARTIAL |
| Exam enroll/start | Drive visible after assign+publish | exam-sessions | PARTIAL |
| Exam submit | Attempt completed + score | submit API | BACKLOG |
| Results | Attempt visible | `/results` | PARTIAL |
| My Assessments | Campaign attempt (Path B) | `/my-assessments` | MANUAL |

## Dual-bank rule

Platform features must not assume campus QB sync. Path A validation uses `question_bank` only; Path B uses `college_questions` only.
