# GradLogic — Workflow Scenarios

Complete end-to-end workflow documentation covering all roles: **Admin (HR)**, **Campus Admin**, and **Candidate (Student)**.

- `[+]` = Positive / happy-path scenario
- `[-]` = Negative / error / edge scenario

---

## Table of Contents

1. [Phase 1 — Admin Workflows](#phase-1--admin-workflows)
   - [A1–A5: User & Campus Management](#a1a5-user--campus-management)
   - [A6–A10: Assessment Rules](#a6a10-assessment-rules)
   - [A11–A15: Question Bank](#a11a15-question-bank)
   - [A16–A25: Drive Lifecycle](#a16a25-drive-lifecycle)
2. [Phase 2 — Campus Admin Workflows](#phase-2--campus-admin-workflows)
   - [B1–B3: Drive Visibility](#b1b3-drive-visibility)
   - [B4–B9: Student Management](#b4b9-student-management)
   - [B10–B15: Student Enrollment](#b10b15-student-enrollment)
   - [B16–B24: Monitoring & Results](#b16b24-monitoring--results)
3. [Phase 3 — Candidate Workflows](#phase-3--candidate-workflows)
   - [C1–C5: Registration & Onboarding](#c1c5-registration--onboarding)
   - [C6–C20: Portal & Exam Flow](#c6c20-portal--exam-flow)
   - [C21–C26: Results & Learning](#c21c26-results--learning)
4. [Phase 4 — End-to-End Workflows](#phase-4--end-to-end-workflows)
5. [Phase 5 — Edge Cases](#phase-5--edge-cases)
6. [Full Scenario Count](#full-scenario-count)

---

## Phase 1 — Admin Workflows

> **Role:** HR Admin  
> **Access:** Full platform control — users, campuses, assessment rules, question bank, drives

---

### A1–A5: User & Campus Management

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| A1 | `[+]` | Create a campus admin user with name, email, and role `college_admin` | User is created; success toast shown |
| A1 | `[-]` | Create a user with a duplicate email address | Error: "Email already exists" |
| A2 | `[+]` | Create a college staff user (`college_staff`) under a campus | User is created successfully |
| A3 | `[+]` | Create a new campus with name, code, and city | Campus appears in the campus list |
| A3 | `[-]` | Submit the create campus form with required fields missing | Validation error: "Required" |
| A4 | `[+]` | Deactivate an existing campus admin user | User status changes to "Inactive" |
| A5 | `[-]` | Attempt to delete a campus that has active drives | Blocked with error: "Campus has active drives" |

---

### A6–A10: Assessment Rules

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| A6 | `[+]` | Create an assessment rule with skill distribution (duration 90 min, 50 questions) | Rule is saved; success message shown |
| A6 | `[-]` | Create an assessment rule without a name | Validation error: "Name is required" |
| A7 | `[+]` | Open a saved rule and verify all fields (cutoff 60, duration 90, questions 50) persist | All values displayed correctly |
| A8 | `[+]` | Verify proctoring mode is saved as STRICT on the rule detail page | "Strict" mode is shown |
| A9 | `[+]` | Clone an existing rule to create a new independent version | Cloned rule appears as Version 2 |
| A10 | `[-]` | Attempt to archive a rule that is linked to active drives | Blocked with error: "Rule has active drives" |

---

### A11–A15: Question Bank

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| A11 | `[+]` | Add an MCQ question with 4 options, difficulty Medium, category Reasoning, and a correct answer | Question saved successfully |
| A11 | `[-]` | Save an MCQ question without selecting the correct answer | Validation error: "Correct answer is required" |
| A12 | `[+]` | Add a coding question (Reverse a Linked List) with 2 test cases — one visible, one hidden | Question saved with both test cases |
| A13 | `[+]` | Bulk upload 50 questions via CSV | "50 imported, 0 failed" shown |
| A13 | `[-]` | Bulk upload a CSV where 5 questions are duplicates | "5 duplicates" reported separately from imported count |
| A14 | `[-]` | Attempt to deactivate a question that is used in an active drive | Blocked with warning: "Question is used in active drives" |
| A15 | `[+]` | View category distribution of uploaded questions (reasoning, maths, programming, verbal) | Correct counts displayed per category |

---

### A16–A25: Drive Lifecycle

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| A16 | `[+]` | Create a placement drive by selecting an assessment rule → status is DRAFT | Drive created; status shows "Draft" |
| A16 | `[-]` | Create a drive without selecting an assessment rule | Validation error: "Assessment rule is required" |
| A17 | `[+]` | Trigger pool generation for a DRAFT drive | Status changes to "Generating / Pending" |
| A18 | `[+]` | View approved pool — verify skill/difficulty distribution totals (50 questions) | Distribution counts displayed correctly |
| A19 | `[+]` | Reject the generated pool with a reason (e.g., "Poor quality maths questions") | Pool goes back to "Generating" for regeneration |
| A20 | `[+]` | Approve the generated pool | Drive status changes to "Ready" |
| A21 | `[+]` | Assign the drive to one campus (MIT College) | Campus appears in the drive's assigned campuses list |
| A22 | `[+]` | Assign the drive to multiple campuses | Both campuses recorded; assignment count = 2 |
| A23 | `[+]` | Publish drive with a future scheduled date | Drive status changes to "Scheduled / Published" |
| A24 | `[-]` | Attempt to publish a drive with a past date | Rejected with error: "Scheduled start must be in the future" |
| A25 | `[+]` | Cancel a published drive | Drive status changes to "Cancelled" |

---

## Phase 2 — Campus Admin Workflows

> **Role:** Campus Admin  
> **Access:** Own campus drives, students, enrollment, monitoring, results

---

### B1–B3: Drive Visibility

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| B1 | `[+]` | Campus admin logs in and sees drives that admin has assigned to their campus | Assigned drive appears in campus drive list |
| B2 | `[+]` | Open drive details — verify name, schedule, assessment rule, and proctoring mode are correct | All details shown correctly |
| B2 | `[-]` | Navigate to a drive detail page with an invalid or wrong drive ID | "Drive not found / 404" shown |
| B3 | `[-]` | Campus admin of Campus A cannot see drives assigned only to Campus B | Drive list is empty; "No drives" message shown |

---

### B4–B9: Student Management

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| B4 | `[+]` | Add a single student manually (name, email, roll number, degree) | "Student added successfully" |
| B4 | `[-]` | Submit the add student form with required fields empty | Validation errors shown |
| B5 | `[+]` | Bulk import 100 students via CSV file | "100 imported, 0 failed" confirmed |
| B6 | `[-]` | Bulk import a CSV that contains 1 duplicate email in the same campus | "1 duplicate" reported separately |
| B7 | `[-]` | Import a student whose email is already registered to a different campus | Error: "Student already belongs to another campus" |
| B8 | `[+]` | Edit an existing student's CGPA and branch — save changes | "Saved / Updated" shown; new CGPA reflected |
| B9 | `[+]` | Remove a student from the campus | Student removed; their drive enrollments are also removed |

---

### B10–B15: Student Enrollment

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| B10 | `[+]` | Enroll all campus students into a published drive in one click | "3 students enrolled" confirmed |
| B11 | `[+]` | Enroll a filtered subset of students (e.g., CGPA ≥ 8.5) into a drive | Only eligible students enrolled |
| B12 | `[-]` | Attempt to enroll a student who has already completed the drive | Blocked: "Student already completed this drive" |
| B13 | `[+]` | Remove an enrolled student from a drive before the exam starts | Student removed from drive; "Unenrolled" shown |
| B14 | `[+]` | Enroll additional students after the drive is already published | Enrollment succeeds; students can take the exam |
| B15 | `[-]` | Attempt to enroll students into a COMPLETED drive | Enroll button is disabled / hidden; action blocked |

---

### B16–B24: Monitoring & Results

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| B16 | `[+]` | View live monitoring dashboard during an active drive | Real-time session list shows student name, question number, time remaining, status |
| B17 | `[+]` | A student who switched tabs is flagged — violation appears in the list | Tab-switch violation shown in Integrity / Violations tab |
| B18 | `[+]` | Integrity score for a student in an active session is visible in monitoring | Score (e.g., 78) shown beside student name |
| B19 | `[+]` | Face-not-detected violation appears as an alert in the monitoring panel | "FACE_NOT_DETECTED" violation listed |
| B20 | `[+]` | After drive ends, results page shows all students with score and pass/fail status | Full results table visible |
| B21 | `[+]` | Filter results by "Passed" — only passing students are displayed | Failed students hidden from view |
| B22 | `[+]` | View integrity report for a flagged student — violation timeline shows type and timestamp | TAB_SWITCH and FACE_NOT_DETECTED events listed in timeline |
| B23 | `[+]` | Click "Download Results" — file download is triggered | CSV or XLSX file downloaded |
| B24 | `[+]` | Integrity heatmap shows risk score distribution (low / medium / high) | Heatmap rendered with correct counts |

---

## Phase 3 — Candidate Workflows

> **Role:** Student / Candidate  
> **Access:** Own profile, assigned drives, exam sessions, results, LMS programs

---

### C1–C5: Registration & Onboarding

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| C1 | `[+]` | Student self-registers with a valid name, email, and password | Redirected to onboarding wizard |
| C2 | `[-]` | Register with an email that is already in use | Error: "Email already registered" |
| C2 | `[-]` | Submit the registration form with the email field empty | Validation error: "Email is required" |
| C3 | `[+]` | Complete the onboarding wizard (personal details + academic details) | Profile marked complete; redirected to student portal |
| C4 | `[-]` | Student with an incomplete profile tries to access the student portal directly | Redirected back to the onboarding wizard |
| C5 | `[+]` | Upload a PDF resume and JPG photo during onboarding | Files saved; "Uploaded successfully" shown |
| C5 | `[-]` | Upload a non-PDF file (e.g., .txt) as the resume | Format error: "PDF only" |

---

### C6–C20: Portal & Exam Flow

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| C6 | `[+]` | Assigned and published drive appears on the student portal home | Drive card visible with name and schedule |
| C7 | `[-]` | A DRAFT drive (not yet published) is not visible on the student portal | No "Start Exam" button; drive not shown |
| C8 | `[-]` | A CANCELLED drive shows "Cancelled" status with no Start button | Status label "Cancelled"; Start button absent |
| C9 | `[+]` | Exam instructions page shows duration, question count, cutoff score, and proctoring rules | All values (90 min, 50 questions, 60% cutoff, webcam required) displayed |
| C10 | `[+]` | Student starts the exam within the scheduled window — session is created | Redirected to exam player URL |
| C11 | `[-]` | Student attempts to start the exam before the scheduled start time | Error: "Exam has not started yet" |
| C12 | `[-]` | Student attempts to start the exam after the deadline has passed | Error: "Drive has closed. The exam window has passed." |
| C13 | `[+]` | Student selects an MCQ answer and navigates to the next question — answer is auto-saved | Auto-save API called; answer preserved |
| C14 | `[+]` | Student submits code for a coding question — test case results are shown (2 passed, 1 failed) | Test result breakdown displayed |
| C15 | `[-]` | Student switches tabs 3 times — on the 3rd switch a final warning is shown; 4th terminates | Warning shown on violation; exam termination triggered |
| C16 | `[-]` | Student's face moves out of the webcam frame — proctoring engine fires "face not detected" | Warning banner: "Face not detected — look at the camera" |
| C17 | `[+]` | Student closes the browser mid-exam and reopens — existing session is detected | "Resume exam" option shown on the instructions page |
| C18 | `[+]` | Student reconnects after a network drop — exam resumes from last saved question | Saved progress is restored; countdown continues |
| C19 | `[+]` | Student clicks "Submit Exam" and confirms — submission is recorded | Redirected to results / score page |
| C20 | `[-]` | Student attempts to retake a drive they have already completed | Error: "Attempt limit reached. You have already completed this exam." |

---

### C21–C26: Results & Learning

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| C21 | `[+]` | Student views their result page after submission — score, pass/fail, and cutoff comparison shown | Score "72", "Passed", cutoff "60" all visible |
| C21 | `[+]` | Student who failed sees "Failed" status with score below cutoff | Score "45", "Failed" shown |
| C22 | `[+]` | Student who received integrity violations sees a flag notice on their result page | "Flagged / Under integrity review" banner visible |
| C23 | `[-]` | Student accesses results before admin has released them | "Pending / Results not released yet" message shown |
| C24 | `[+]` | Student takes a mock exam — no webcam required, feedback shown after completion | No camera prompt; "80 score / feedback" displayed |
| C25 | `[+]` | Student enrolls in an LMS program — program added to "My Learning" | "Enrolled" confirmation; program in My Learning list |
| C25 | `[-]` | Student attempts to enroll in a program they are already enrolled in | Error: "Already enrolled in this program" |
| C26 | `[+]` | Student completes a module — progress updates to 100% and a certificate is issued | "100% / Certificate issued" shown |

---

## Phase 4 — End-to-End Workflows

> Multi-role tests that chain Admin → Campus Admin → Student actions in a single test run.

| ID | Type | Scenario | Roles Involved |
|----|------|----------|---------------|
| E1 | `[+]` | Admin creates drive, approves pool, assigns campus, publishes → Campus admin enrolls students → Student starts exam → Admin views results | Admin, Campus Admin, Student |
| E2 | `[+]` | Campus admin bulk imports 50 students → Admin publishes drive → Students see the drive on their portal | Campus Admin, Admin, Student |
| E3 | `[+]` | Student is flagged for cheating → Admin reviews violation → Admin confirms and marks exam invalid | Student (proctoring), Admin |
| E4 | `[+]` | Admin shortlists a passing student → schedules an interview → releases a job offer | Admin, Student |
| E5 | `[+]` | Drive assigned to 2 campuses → both campuses enroll students → Admin sees combined leaderboard with all students | Admin, Campus Admin (×2), Student |

---

## Phase 5 — Edge Cases

| ID | Type | Scenario | Expected Outcome |
|----|------|----------|-----------------|
| X1 | `[-]` | Admin attempts to delete a drive that has active (live) exam sessions | Blocked: "Cannot delete drive with active sessions. Terminate all sessions first." |
| X2 | `[-]` | Campus admin of Campus A tries to access a drive or students belonging to Campus B | 403 Forbidden: "Access denied. Drive belongs to another campus." |
| X3 | `[-]` | Student tries to access the Admin HR dashboard URL directly | Redirected to student portal or login |
| X3 | `[-]` | Campus admin tries to access the admin-only drive creation page | Redirected to college dashboard or forbidden |
| X4 | `[-]` | Admin triggers pool generation but the question bank has insufficient questions (need 10, have 3) | Error: "Insufficient questions in bank for programming (hard): need 10, have 3" |
| X5 | `[-]` | Two students with the same roll number are added to the same campus | Error: "Duplicate roll number: MIT001 already exists in this campus" |
| X6 | `[+]` | Drive is published with 0 enrolled students — admin opens dashboard | Drive dashboard shows "0 participants / No students enrolled" |
| X7 | `[-]` | Admin tries to approve the pool for a COMPLETED drive | Approve Pool button is hidden / absent for completed drives |
| X8 | `[-]` | Student accumulates max violations — proctoring engine fires auto-terminate | Exam forcibly ended; partial score computed and "AUTO_TERMINATED" status shown |
| X9 | `[+]` | Campus admin downloads results for a drive where 0 students completed | Empty report returned; download does not crash |
| X10 | `[-]` | Inactive student attempts a "Forgot Password" reset | Blocked: "Account is inactive. Contact your campus admin." |
| X-B | `[-]` | Unauthenticated user navigates to a protected route (e.g., /app/hr-dashboard) | Redirected to login page |

---

## Full Scenario Count

| Phase | Role | Scenarios |
|-------|------|-----------|
| Phase 1 — Admin | HR Admin | A1–A25 → **32 tests** (positive + negative per scenario) |
| Phase 2 — Campus Admin | Campus Admin | B1–B24 → **26 tests** |
| Phase 3 — Candidate | Student | C1–C26 → **23 tests** |
| Phase 4 — E2E | Multi-role | E1–E5 → **5 tests** |
| Phase 5 — Edge Cases | All roles | X1–X10 + Bonus → **12 tests** |
| **Total** | | **~98 test scenarios** |

---

## Workflow State Machine

```
DRIVE LIFECYCLE
───────────────
  [DRAFT] 
    │  Admin creates drive from rule
    ▼
  [GENERATING]
    │  Pool generation triggered
    ▼
  [POOL_READY]
    │  Admin reviews pool
    ├─ Reject ──► [GENERATING] (regenerate)
    └─ Approve ──►
  [READY]
    │  Admin assigns campuses + sets schedule
    ▼
  [SCHEDULED / PUBLISHED]
    │  Exam window opens
    ▼
  [ACTIVE]  ◄── Students taking exam (live monitoring)
    │
    ▼
  [COMPLETED]  ──► Results released ──► Shortlist / Offers
    │
    └─ (at any point) Admin cancels ──► [CANCELLED]


STUDENT EXAM SESSION
────────────────────
  [ENROLLED]
    │  Student logs in during exam window
    ▼
  [IN_PROGRESS]
    │  Auto-save on every answer
    │  Proctoring: tab-switch, face-detection, webcam
    ├─ Max violations ──► [AUTO_TERMINATED]
    ├─ Network drop   ──► [PAUSED] ──► Resume ──► [IN_PROGRESS]
    └─ Student submits ──►
  [SUBMITTED]
    │
    ▼
  [RESULT_PENDING]
    │  Admin releases results
    ▼
  [RESULT_RELEASED]  ──► Shortlisted / Interview / Offer
```

---

*Document generated from Playwright e2e test suite in `client/tests/e2e/`*
