# College Admin Portal — QA Test Handover

**Product:** GradLogic / TalentSecure-AI — Campus (College) Portal  
**Date:** 2026-07-11  
**Environment:** Production (public)  
**Status:** Ready for QA validation  

---

## 1. Environment & Access

| Item | Value |
|------|-------|
| **Application URL** | https://gradlogic.atherasys.com/ |
| **Login URL** | https://gradlogic.atherasys.com/auth/login |
| **Portal base** | https://gradlogic.atherasys.com/app/college-portal |
| **Dashboard** | https://gradlogic.atherasys.com/app/college-portal/dashboard |
| **API** | https://api.gradlogic.atherasys.com |
| **API login** | https://api.gradlogic.atherasys.com/api/auth/login |

**Allowed roles:** `college_admin`, `college`, `college_staff`  
After login, these roles land on `/app/college-portal/dashboard`.

---

## 2. Login Credentials

### Option A — Create a test campus admin (recommended for prod)

Use Super Admin to create a campus + admin, then share those credentials with QA.

1. Login as Super Admin: `admin@gradlogic.com` / `gradlogic123`
2. Go to **Colleges → Add New College** (`/app/superadmin/colleges/new`)
3. Fill college details and set an **Initial Campus Administrator** email + temporary password
4. Or open an existing college → add campus admin via campus admin assignment API/UI
5. Login at https://gradlogic.atherasys.com/auth/login with the new college admin email/password

**Suggested QA test account (create once, then share):**

| Field | Suggested value |
|-------|-----------------|
| Role | `college_admin` |
| Email | `qa.campus.admin@gradlogic.com` (or your domain) |
| Password | *(set when creating — store securely)* |
| College | Any approved college in prod |

### Option B — Seeded campuses (if DB seed was applied)

If `seedCollegesStudents.ts` was run on the environment:

| Field | Value |
|-------|-------|
| **Email pattern** | `admin.{college-slug}@nallasconnect.edu.in` |
| **Example** | `admin.iit-madras@nallasconnect.edu.in` |
| **Password** | `TalentSecure@2025` |
| **Role** | `college` (treated as college admin) |

Other seeded examples:

| College | Email |
|---------|-------|
| IIT Madras | `admin.iit-madras@nallasconnect.edu.in` |
| NIT Trichy | `admin.nit-trichy@nallasconnect.edu.in` |
| VIT Vellore | `admin.vit@nallasconnect.edu.in` |
| Anna University | `admin.anna-univ@nallasconnect.edu.in` |
| PSG | `admin.psg@nallasconnect.edu.in` |

> **Note:** Seed accounts may **not** exist on production. Confirm with Super Admin → Users, or create Option A credentials first.

### API login (Postman / curl)

```bash
curl -X POST https://api.gradlogic.atherasys.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "YOUR_COLLEGE_ADMIN_EMAIL",
    "password": "YOUR_PASSWORD"
  }'
```

Use returned `accessToken` as `Authorization: Bearer <token>`.

### Access-control accounts (must NOT reach college portal)

| Role | Email | Password | Expected |
|------|-------|----------|----------|
| Super Admin | `admin@gradlogic.com` | `gradlogic123` | SuperAdmin portal, not college portal |
| HR | `hr@gradlogic.com` | `gradlogic123` | HR dashboard |
| Student | *(campus student email)* | *(student password)* | Student portal only |

---

## 3. Portal Navigation Map

Base URL: `https://gradlogic.atherasys.com`

| Section | Route | Full URL | Status |
|---------|-------|----------|--------|
| Dashboard | `/app/college-portal/dashboard` | …/app/college-portal/dashboard | Active |
| Students | `/app/college-portal/students` | …/app/college-portal/students | Active |
| Student detail | `/app/college-portal/students/:id` | …/app/college-portal/students/:id | Active |
| Question Bank | `/app/college-portal/question-bank` | …/question-bank | Coming soon |
| Workflows | `/app/college-portal/workflows` | …/workflows | Coming soon |
| Tests & Assessments | `/app/college-portal/assessments` | …/assessments | Active (drives) |
| Analytics & Reports | `/app/college-portal/analytics` | …/analytics | Active |
| Soft Skills | `/app/college-portal/soft-skills` | …/soft-skills | Coming soon |
| Technical Skills | `/app/college-portal/technical-skills` | …/technical-skills | Coming soon |
| Settings | `/app/college-portal/settings` | …/settings | Active |
| LMS modules | `/app/college-portal/lms/:moduleKey` | …/lms/… | When enabled |

### Related monitoring (same college roles)

| Feature | Route |
|---------|-------|
| Live exam monitoring | `/app/admin/monitoring` (if enabled for role) |
| Proctoring monitor | `/app/proctoring` |
| Legacy college dashboard redirect | `/app/college-dashboard` → college portal |

---

## 4. Suggested Test Flow

1. Login as college admin → confirm redirect to `/app/college-portal/dashboard`
2. Dashboard KPIs load (students, drives, placement, integrity)
3. Students list — search, filter, open detail
4. Add / edit student (positive + validation)
5. Bulk CSV import (if available)
6. Assessments — view drives assigned to this campus only
7. Analytics — charts and exports
8. Settings — daily practice target / campus config
9. Confirm cannot access `/app/superadmin/*`
10. Logout

---

## 5. Validation Scenarios

### A. Authentication & access

| # | Type | Scenario | Expected |
|---|------|----------|----------|
| 1 | + | Login with valid college admin | Lands on college portal dashboard |
| 2 | + | Logout | Back to login; session cleared |
| 3 | − | Wrong password | Clear error |
| 4 | − | Super admin URL `/app/superadmin/users` while logged in as college admin | Blocked / redirected |
| 5 | − | Student credentials on college portal URL | Blocked |

### B. Dashboard

| # | Type | Scenario | Expected |
|---|------|----------|----------|
| 1 | + | Open dashboard | KPI cards load (students, drives, placement) |
| 2 | + | Click Manage Students | Opens students page |
| 3 | − | API failure | Error banner, no crash |

### C. Students (B4–B9)

| # | Type | Scenario | Expected |
|---|------|----------|----------|
| 1 | + | List students for this campus only | Only own college students |
| 2 | + | Search by name/email | Filtered results |
| 3 | + | Add student (name, email, roll, degree) | Success |
| 4 | − | Add with empty required fields | Validation errors |
| 5 | + | Bulk CSV import | Import summary (imported / failed) |
| 6 | − | Duplicate email in CSV | Reported as duplicate |
| 7 | + | Edit CGPA / branch | Saved and reflected |
| 8 | + | Open student detail | Assessments, integrity, placement visible |
| 9 | − | Access student from another college by ID | 403 / not found |

### D. Assessments / drives (B1–B3, B10–B15)

| # | Type | Scenario | Expected |
|---|------|----------|----------|
| 1 | + | See drives assigned to this campus | Drive list shows assigned drives |
| 2 | − | Drive for another campus only | Not visible |
| 3 | + | Open drive details | Name, schedule, rule, proctoring shown |
| 4 | + | Enroll students into published drive | Enrollment success |
| 5 | − | Enroll into completed drive | Blocked / disabled |

### E. Monitoring & results (B16–B24)

| # | Type | Scenario | Expected |
|---|------|----------|----------|
| 1 | + | Live monitoring during active exam | Sessions with time remaining / status |
| 2 | + | Tab-switch / face violation appears | Listed under integrity |
| 3 | + | Integrity score visible | Score shown per student |
| 4 | + | Results after drive ends | Scores + pass/fail |
| 5 | + | Filter Passed | Only passers shown |
| 6 | + | Download results | CSV/XLSX downloads |

### F. Analytics & settings

| # | Type | Scenario | Expected |
|---|------|----------|----------|
| 1 | + | Analytics page loads | Performance / placement / integrity charts |
| 2 | + | Settings — update daily practice target | Saves successfully |
| 3 | − | Empty analytics period | Empty state, no crash |

---

## 6. Quick Smoke Checklist (~20 min)

- [ ] Login as college admin works
- [ ] Redirects to `/app/college-portal/dashboard`
- [ ] Dashboard KPIs visible
- [ ] Students list loads (campus-scoped)
- [ ] Open one student detail
- [ ] Assessments / drives list loads
- [ ] Analytics page loads
- [ ] Settings page loads
- [ ] Cannot open SuperAdmin portal
- [ ] Logout works

---

## 7. Bug Report Template

```
Title: [College Portal] Short description

Steps to Reproduce:
1. Login at https://gradlogic.atherasys.com/auth/login as <college_admin>
2. Navigate to /app/college-portal/...
3. ...

Expected Result:
...

Actual Result:
...

Environment:
- URL: https://gradlogic.atherasys.com
- API: https://api.gradlogic.atherasys.com
- Browser: ...
- Role: college_admin

Severity: Critical / High / Medium / Low
Screenshot: [attach]
```

---

## 8. Related Documentation

| Document | Purpose |
|----------|---------|
| `ADMIN_PORTAL_TEST_HANDOVER.md` | SuperAdmin portal testing |
| `WORKFLOW_SCENARIOS.md` | Full B1–B24 campus admin workflows |
| `ADMIN_CREDENTIALS.md` | SuperAdmin / API credentials (local) |
| `MOBILE_APP_SPEC.md` | Student mobile; college monitoring stays on web |

---

**Prepared for:** QA / UAT team  
**First step for QA:** Ask Super Admin to confirm a college_admin account exists, or create one (Option A), then share email + password for this checklist.
