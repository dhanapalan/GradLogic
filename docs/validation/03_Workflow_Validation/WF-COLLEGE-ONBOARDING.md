# WF-COLLEGE-ONBOARDING — Super Admin → College → Student

Org onboarding journey (pre-assessment).

```
SA Login → Create College → TPO Credentials → Email/Copy
  → College Admin Login → Change Password → Campus Dashboard
  → Register Student → Student Login → Password → Onboarding → Dashboard
```

**Automation:** `flow-01` … `flow-09` in `client/tests/e2e/sprint-1a/specs/`  
**Run:** `npm run test:sprint1a` (workers: 1, serial where needed)  
**State handoff:** `.runtime/sprint1a-state.json`

---

## Gates

| Gate | Spec | Pass criteria | Status |
|------|------|---------------|--------|
| ONB-1 | flow-01 | SA login, dashboard KPIs/nav, logout | AUTOMATED |
| ONB-2 | flow-02 | College CRUD create/edit/suspend/activate | AUTOMATED |
| ONB-3 | flow-03 | TPO username/temp password/credentials UI | AUTOMATED |
| ONB-4 | flow-04 | College login → forced password → dashboard | AUTOMATED |
| ONB-5 | flow-05 | Campus dashboard KPIs/charts | AUTOMATED |
| ONB-6 | flow-06 | Student registration visible in grid | AUTOMATED |
| ONB-7 | flow-07 | Student login → password reset → dashboard | AUTOMATED |
| ONB-8 | flow-08 | Onboarding wizard complete (resume skip OK) | AUTOMATED |
| ONB-9 | flow-09 | Student dashboard progress/assessments widgets | AUTOMATED |

## Extended (same family)

| Gate | Spec | Notes | Status |
|------|------|-------|--------|
| ONB-10 | flow-10 | Password recovery | PARTIAL |
| ONB-11 | flow-11 | Billing / payments | PARTIAL |
| ONB-12 | flow-12 | Campus admins management | PARTIAL |
| ONB-13 | flow-13 | Super Admin college approvals | PARTIAL |
| ONB-14 | flow-14 | Student profile | PARTIAL |

## Downstream

After ONB-9, continue with [WF-PATH-A.md](./WF-PATH-A.md) or [WF-PATH-B.md](./WF-PATH-B.md).
