# Wave 1 — Pipeline & Integration

## Assessment pipeline (Learning → Assessment)

Source: `server/src/services/assessmentPipeline.service.ts`  
UI: `/app/superadmin/assessment-hub`

```
knowledge_library → question_bank → collections → drives → journeys
```

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| INT-PIPE-01 | Dashboard loads pipeline/KPI language | Assessment Dashboard visible | PARTIAL |
| INT-PIPE-02 | KL published counts feed next_action hints | Metrics non-crash | PARTIAL |
| INT-PIPE-03 | QB browse uses same `question_bank` as drives JOIN | Drive pool question_ids in bank | MANUAL |
| INT-PIPE-04 | Collection → drive seed | Pool rows after assemble | PARTIAL |
| INT-PIPE-05 | Assign → student my-drives | Student sees drive | PARTIAL |

## AI config SPOF

Source: `aiServiceConfig.service.ts` · UI `/app/superadmin/ai-config` · API `/api/superadmin/ai-services`

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| INT-SPOF-01 | `question_bank` provider row visible/configurable | Listed or creatable | PARTIAL |
| INT-SPOF-02 | `drive_generation` row present | Listed | MANUAL |
| INT-SPOF-03 | Misconfigured provider fails QB AI and drive AI similarly | Documented failure mode | BACKLOG |
| INT-SPOF-04 | Prompt Manager tab shares page | `?tab=prompts` | PARTIAL |

## AI Studio ↔ Learning Companion aliases

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| INT-ALIAS-01 | Content Generator → `learning-companion/studio` | URL match | PARTIAL |
| INT-ALIAS-02 | Voice Generator → studio `?kind=voice_lessons` | URL match | PARTIAL |
| INT-ALIAS-03 | Review Center → `learning-companion/review` | URL match | PARTIAL |

## Notifications & jobs

| ID | Check | Status |
|----|-------|--------|
| INT-NOTIF-01 | Drive publish notifies students/campus admins | BACKLOG |
| INT-JOB-01 | Background pool generate completes / retries | BACKLOG |
| INT-JOB-02 | Failure surfaces toast + recoverable state | BACKLOG |

## Path A vs Path B isolation

| ID | Check | Status |
|----|-------|--------|
| INT-ISO-01 | Campus campaign does not require platform collection | MANUAL |
| INT-ISO-02 | Platform assign does not create `college_questions` | MANUAL |
