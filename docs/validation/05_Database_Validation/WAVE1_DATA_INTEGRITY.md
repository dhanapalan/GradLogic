# Wave 1 — Data Integrity

## Path A chain

```
question_bank
  → question_collection_items (collection_id, question_id)
  → drive_source_collections (drive_id, collection_id)
  → drive_question_pool / drive_pool_questions
  → drive_assignments (drive_id, college_id)
  → drive_students (eligibility_status)
  → assessment_drives (status ready/live/published)
  → exam attempt rows (via exam session services)
```

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| DB-PA-01 | Published QB rows | `deleted_at IS NULL`, active/published | MANUAL |
| DB-PA-02 | Collection items FK | `question_id` exists in `question_bank` | MANUAL |
| DB-PA-03 | Drive source collections | After assemble, rows for selected collections | MANUAL |
| DB-PA-04 | Pool questions | Count ≥ 1 after seed | MANUAL |
| DB-PA-05 | Assignment | `drive_assignments.college_id` = Demo College | MANUAL |
| DB-PA-06 | Drive students | Bulk insert; eligibility not all null | MANUAL |
| DB-PA-07 | Status transitions | draft → pool_approved → ready → published/live | MANUAL |
| DB-PA-08 | No orphan pool | Pool tied to drive_id | MANUAL |
| DB-PA-09 | Soft delete QB | Soft-deleted Q not filled into new collections | BACKLOG |

## College onboarding chain

```
campuses (college)
  → campus/college admins / users
  → students
  → audit_logs / notifications (if enabled)
```

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| DB-ONB-01 | Campus insert | Unique code/email | PARTIAL |
| DB-ONB-02 | Admin user linked | `college_id` set | PARTIAL |
| DB-ONB-03 | Student insert | Roll/email unique per campus | PARTIAL |
| DB-ONB-04 | Soft suspend | Campus/user inactive flags | PARTIAL |
| DB-ONB-05 | Timestamps | `created_at` / `updated_at` set | BACKLOG |

## Path B chain (campus-owned)

```
college_questions → college_assessment_questions
  → college_assessments → college_assessment_campaigns
  → college_campaign_students / picks → attempts
```

| ID | Check | Status |
|----|-------|--------|
| DB-PB-01 | No FK from campus assessment to `question_bank` | MANUAL |
| DB-PB-02 | Campaign audience rows match preview | BACKLOG |

## Dual-bank isolation

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| DB-ISO-01 | Path A assign does not insert `college_questions` | Count unchanged | MANUAL |
| DB-ISO-02 | Campus drive API reads `assessment_drives` via assignments only | JOIN path | MANUAL |

## Transaction / rollback

| ID | Check | Status |
|----|-------|--------|
| DB-TX-01 | Failed drive create does not leave half-attached collections | BACKLOG |
| DB-TX-02 | Failed fill-from-bank is atomic per batch | BACKLOG |
