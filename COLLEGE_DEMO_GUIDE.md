# GradLogic — College Demo Guide

**Audience:** College leadership, Training & Placement Office (TPO), campus admins  
**Product:** GradLogic Campus Portal  
**Demo length:** 30–45 minutes (core) · optional +15 min student experience  
**Date prepared:** 2026-07-16  

---

## 1. One-minute pitch

GradLogic helps your campus run the full placement-readiness loop in one place:

**Students → Assessments → Integrity → Results → Analytics → Placement readiness**

Placement cells stop juggling spreadsheets, WhatsApp lists, and separate exam tools. Faculty and TPOs get campus-scoped visibility; students get a clear assessment and practice journey.

| For the college | What GradLogic delivers |
|-----------------|-------------------------|
| TPO / Placement cell | Campaigns, drives, eligibility, results, readiness views |
| Faculty / proctors | Assessment integrity, violation timeline, campaign monitoring |
| Students | My assessments, practice, learning companion, results |
| Leadership | Dashboard KPIs by year / department / batch |

---

## 2. Demo environment & accounts

| Item | Value |
|------|-------|
| **App URL** | https://gradlogic.atherasys.com |
| **Login** | https://gradlogic.atherasys.com/auth/login |
| **College portal** | https://gradlogic.atherasys.com/app/college-portal/dashboard |
| **API** | https://api.gradlogic.atherasys.com |

### Recommended demo accounts

Confirm passwords on the day of the demo (seed/prod may differ).

| Role | Suggested account | Portal after login |
|------|-------------------|--------------------|
| **College admin** | `college@democollege.edu` or `college@gradlogic.com` | College portal |
| **Student** | `student4@democollege.edu` (or another Demo College student) | Student portal |
| Password (typical demo) | `gradlogic123` | — |

> **Prep tip:** Log in as college admin and student once the morning of the demo. If login fails, create/reset via Super Admin → Colleges / Users before the session.

### Browser prep (presenter)

1. Use Chrome, two windows side-by-side (or two profiles): **College** and **Student**.
2. Disable pop-up blockers for the demo domain.
3. Zoom to ~110% for projector readability.
4. Have a sample student CSV ready if you will show bulk upload.

---

## 3. Agenda (suggested timing)

| Time | Segment | Goal |
|------|---------|------|
| 0–3 min | Welcome & pitch | Why GradLogic for campuses |
| 3–8 min | Login & dashboard | Campus command center |
| 8–16 min | Students | Roster, eligibility, bulk ops |
| 16–26 min | Assessments & campaigns | How exams go live |
| 26–32 min | Results, analytics, integrity | Trust & outcomes |
| 32–38 min | Campus drives / placement | Hiring connection (if data exists) |
| 38–45 min | Student view (optional) | What learners see |
| Close | Q&A + next steps | Pilot / onboarding |

---

## 4. Live demo script

### Act 1 — Login & campus dashboard (5 min)

1. Open https://gradlogic.atherasys.com/auth/login  
2. Choose the **College** role tab (if shown) and sign in as college admin.  
3. Land on **Dashboard** (`/app/college-portal/dashboard`).

**Talking points**

- “This is your campus command center — only your college’s data.”
- Point out KPIs: students, assessments/campaigns, placement signals, integrity.
- Show filters (academic year / department / batch / semester) if populated.
- Click through a KPI into Students or Campaigns to show navigation is intentional.

**If charts are empty:** Say “Empty until campaigns run — we’ll show the flow next,” then move to Students.

---

### Act 2 — Student management (8 min)

Navigate: **Students** → `/app/college-portal/students`

**Show**

1. Search and filters (department, batch, placement status if available).  
2. Open one student → detail (profile, documents/eligibility panels if present).  
3. **Add student** (or edit) — name, email, roll/ID, degree, CGPA.  
4. Optional: **Bulk upload** — open the CSV modal and explain columns (don’t need a full import mid-demo).

**Talking points**

- Campus-scoped: you never see another college’s students.  
- Bulk upload is how large batches onboard in minutes.  
- Student record is the spine for assessments, eligibility, and placement tracking.

---

### Act 3 — Question bank & assessments (10 min)

#### Question Bank

Navigate: **Question Bank** → `/app/college-portal/question-bank`

- Show campus questions / meta if data exists.  
- Message: “Campus can curate questions; platform also supplies shared banks.”

#### Tests & Assessments

Navigate: **Tests & Assessments** → `/app/college-portal/assessments`

- List assessments available to the campus.  
- Open one and describe sections, duration, and publish state.

#### Assessment Campaigns (highlight)

Navigate: **Assessment Campaigns** → `/app/college-portal/campaigns`

**Show**

1. Campaign list (scheduled / live / completed).  
2. Open a campaign → schedule, audience, proctoring/integrity settings.  
3. If possible: **Results** / **Analytics** / **Integrity** for that campaign  
   (`…/campaigns/:id/results`, `…/analytics`, `…/integrity`).

**Talking points**

- Campaign = “when this assessment runs for which students.”  
- Integrity (tab focus, webcam/proctoring signals) builds employer and college trust.  
- Results feed readiness — not just a score dump.

---

### Act 4 — Analytics, integrity & settings (6 min)

| Nav item | Route | What to say |
|----------|-------|-------------|
| **Analytics & Reports** | `/app/college-portal/analytics` | Cohort performance, department comparisons |
| **Integrity** | `/app/college-portal/integrity` | Campus-wide integrity overview |
| **Settings** | `/app/college-portal/settings` | Practice targets / campus config |

**Talking points**

- Leadership asks “Are we placement-ready?” — analytics answers by batch and department.  
- Integrity is first-class, not an afterthought.

---

### Act 5 — Campus drives (optional, 5 min)

Navigate: **Campus Drives** → `/app/college-portal/drives`

- Show drives linked to the campus (hiring / mock / practice as available).  
- Open a drive detail: schedule, enrolled students, overview.

**Talking points**

- Bridges campus assessments with company or placement drives.  
- Same student roster — no re-entry.

---

### Act 6 — Student experience (optional, 7 min)

In the second browser window, log in as a **student**.

**Show briefly**

1. Student dashboard / **My Assessments**.  
2. Open an available assessment (instructions → attempt only if a short practice exists).  
3. Mention practice, learning companion, and results analysis if those menus are enabled.

**Talking points**

- Students get a modern exam workspace with clear instructions and integrity expectations.  
- Outcomes loop back to the college portal for TPO action.

---

## 5. Navigation cheat sheet

Base: `https://gradlogic.atherasys.com/app/college-portal`

| Menu | Path | Demo priority |
|------|------|---------------|
| Dashboard | `/dashboard` | Must show |
| Students | `/students` | Must show |
| Student detail / form | `/students/:id`, `/students/new` | Must show |
| Question Bank | `/question-bank` | Nice to have |
| Tests & Assessments | `/assessments` | Must show |
| Assessment Campaigns | `/campaigns` | Must show |
| Campaign results / analytics / integrity | `/campaigns/:id/…` | Must show if data |
| Campus Drives | `/drives` | Nice to have |
| Analytics & Reports | `/analytics` | Must show |
| Integrity | `/integrity` | Nice to have |
| Soft Skills | `/soft-skills` | Optional |
| Technical Skills | `/technical-skills` | Coming soon — skip or mention roadmap |
| Workflows | `/workflows` | Coming soon — skip or mention roadmap |
| Settings | `/settings` | Brief |

---

## 6. Story to tell (end-to-end)

Use this narrative so the demo feels like one story, not a menu tour:

1. **Onboard** the batch (Students / bulk upload).  
2. **Configure** what they will take (Assessments + Question Bank).  
3. **Schedule** a campaign with integrity settings.  
4. **Students attempt** (switch to student login).  
5. **Review** results, analytics, and integrity.  
6. **Act** — identify at-risk / placement-ready cohorts; attach to campus drives.

---

## 7. Likely questions & answers

| Question | Suggested answer |
|----------|------------------|
| Is our data isolated from other colleges? | Yes — campus roles only see their own college’s students, campaigns, and results. |
| Can we import our existing student list? | Yes — bulk CSV upload from the Students page. |
| Do you support proctoring? | Yes — campaign integrity / proctoring settings; faculty can review violation timelines. |
| Who creates questions? | Campus can use its question bank; platform shared banks and AI-assisted authoring are available at platform level. |
| Mobile? | Student web experience works on mobile browsers; native app roadmap exists separately. |
| How long to go live? | Typical pilot: 1 campus + 1 batch + 1 campaign in days once accounts and roster are ready. |
| Pricing / licensing? | Hand off to commercial owner — keep demo focused on product value. |

---

## 8. Day-of checklist

### Before the meeting

- [ ] College admin login works  
- [ ] At least 10–20 demo students visible  
- [ ] At least one assessment + one campaign with results (ideal)  
- [ ] Student login works for a named demo student  
- [ ] Projector / Zoom share tested; bookmarks ready  
- [ ] Confirm API health: https://api.gradlogic.atherasys.com/api/health  

### Avoid during demo

- Super Admin deep menus (unless asked) — stay in the **college** story  
- Creating large data mid-demo (prep beforehand)  
- Pages marked Coming soon (Workflows / Technical Skills) unless framing roadmap  
- Live production password resets with the audience watching  

### After the demo

- [ ] Share this URL + college admin credentials (or invite them to create a pilot campus)  
- [ ] Agree pilot scope: batch size, assessment type (aptitude / coding / mock), timeline  
- [ ] Capture feedback: must-have vs nice-to-have for their TPO process  

---

## 9. Pilot proposal (leave-behind)

Suggested 2-week college pilot:

| Week | Activities |
|------|------------|
| **Week 1** | Create campus · onboard TPO admin · bulk-upload one department · configure one practice + one mock campaign |
| **Week 2** | Run campaign · review integrity & results · TPO workshop on analytics · decide production rollout |

**Success criteria**

- 95%+ of uploaded students can log in and see their assessments  
- Campaign completes with results visible to college admin  
- TPO can export / filter results for placement follow-up  

---

## 10. Related docs (internal)

| Document | Use |
|----------|-----|
| `COLLEGE_ADMIN_PORTAL_TEST_HANDOVER.md` | Detailed QA / UAT checklist |
| `COLLEGE_PORTAL_CRUD_ISOLATION.md` | Multi-tenant isolation notes |
| `ADMIN_PORTAL_TEST_HANDOVER.md` | Super Admin (platform) testing |

---

**Prepared for:** College / TPO product demos  
**Presenter tip:** Lead with the campus problem (fragmented tools + weak integrity), then show the pipeline — don’t open with a feature dump.
