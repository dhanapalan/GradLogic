# End-to-End Workflow Scenarios

**Document Purpose**: Capture realistic user journeys across all three portals  
**Review Status**: Awaiting validation  
**Created**: 2026-07-23

---

## Scenario 1: Student Adaptive Learning Journey

### Context
- Student: Alice (newly enrolled, no practice history)
- Goal: Identify weak areas and get personalized learning recommendations
- Expected Duration: 15 minutes total

### Steps

| # | Actor | Action | Expected Result | Data Changes | Status |
|---|-------|--------|-----------------|--------------|--------|
| 1 | Alice | Login to student portal | Dashboard loads, "Home" tab selected | JWT token created | ✅ |
| 2 | Alice | Click "Adaptive Learning" in sidebar | AdaptiveLearningPage loads | - | ✅ |
| 3 | System | Fetch skill accuracy | Shows all 8 categories (0 attempts each) | GET `/adaptive-learning/track` | ✅ |
| 4 | Alice | See cold-start state | "No practice history yet. Start with easy questions." | accuracy=0 for all | ✅ |
| 5 | Alice | Click "Practice" → "Question Bank" | PracticePage loads with easy questions | - | ✅ |
| 6 | Alice | Answer 5 questions (3 correct, 2 wrong) in "Reasoning" category | Session saved | 5x `practice_attempts` inserted | ✅ |
| 7 | Alice | Return to Adaptive Learning | Page refreshes | GET `/adaptive-learning/track` recalculated | ✅ |
| 8 | System | Recalculate weak skills | "Reasoning: 60% accuracy (3/5 correct)" | accuracy=0.6, attempts=5 | ✅ |
| 9 | Alice | See recommendation | "Next: Medium difficulty Reasoning questions" | recommendDifficulty returns "medium" | ✅ |
| 10 | Alice | View learning path | Shows "Step 1: Reasoning → 15 min estimated" | generateLearningPath returns 5 steps | ✅ |
| 11 | Alice | Click "Start Learning Path" | Navigates to practice with Step 1 | - | ✅ |

### Validation Checklist
- [ ] AdaptiveLearningPage renders without errors
- [ ] Cold-start state shows all 8 categories (reasoning, maths, programming, etc.)
- [ ] Skill accuracy recalculates after practice attempts
- [ ] Weak skills properly ranked (lowest accuracy first)
- [ ] Difficulty recommendation scales: easy→medium→hard based on accuracy
- [ ] Learning path generated with ≤5 steps
- [ ] Time estimates reasonable (5-120 minutes)
- [ ] API response times <1 second for all endpoints
- [ ] No 404 errors on practice questions referenced in path

### Edge Cases to Test
1. **Cold Start**: Student with 0 attempts → should return "easy" difficulty
2. **Tie Break**: Two categories with same accuracy → ranked by attempts (fewer = higher priority)
3. **No Lessons Available**: Category with no matching learning_modules → falls back gracefully
4. **Large Practice History**: Student with 1000+ attempts → performance stays <1s

---

## Scenario 2: College Admin Billing & Subscription

### Context
- College: XYZ University (newly onboarded)
- Admin: Dr. Sharma (college_admin role)
- Goal: Set up subscription, manage billing, download invoice
- Expected Duration: 20 minutes

### Steps

| # | Actor | Action | Expected Result | Data Changes | Status |
|---|-------|--------|-----------------|--------------|--------|
| 1 | Dr. Sharma | Login to college portal | Dashboard loads | JWT token created | ✅ |
| 2 | Dr. Sharma | Navigate to Billing → Subscriptions | BillingPage loads, shows plans | GET `/billing/plans` | ✅ |
| 3 | System | Display subscription plans | Shows 3 plans (Starter ₹5K, Pro ₹15K, Enterprise ₹50K) | - | ✅ |
| 4 | Dr. Sharma | Click "Select Pro Plan" | Modal opens: "Confirm Pro subscription?" | - | ✅ |
| 5 | Dr. Sharma | Confirm selection | POST `/billing/subscribe` with plan_id | `subscriptions` row inserted (status='pending_payment') | ✅ |
| 6 | System | Generate invoice & payment intent | Returns Stripe payment intent + client_secret | `invoices` row inserted (status='pending') | ✅ |
| 7 | Dr. Sharma | Stripe checkout loads | Payment form renders (card field, email, etc.) | - | ✅ |
| 8 | Dr. Sharma | Enter test card `4242 4242 4242 4242` | Card validation passes | - | ✅ |
| 9 | Dr. Sharma | Click "Pay ₹15,000" | Stripe processes, shows confirmation | Stripe returns `payment_intent.succeeded` | ✅ |
| 10 | System | Webhook receives payment event | POST `/billing/webhook/stripe` with signature | Signature verified, event processed | ✅ |
| 11 | System | Update invoice & subscription | Invoice marked `paid`, subscription status='active' | DB updates: invoices.status='paid', subscriptions.status='active' | ✅ |
| 12 | Dr. Sharma | See success message | "Subscription activated! You have access to 50 students." | - | ✅ |
| 13 | Dr. Sharma | Navigate to Invoices | Invoice list shows paid invoice | GET `/billing/invoices` | ✅ |
| 14 | Dr. Sharma | Click "Download PDF" | PDF generates and downloads | PUT `/billing/invoices/:id/download` → PDF stream | ✅ |
| 15 | Dr. Sharma | Open PDF locally | Professional invoice with college name, amount, GST | - | ✅ |

### Validation Checklist
- [ ] BillingPage loads without errors
- [ ] Stripe payment element renders correctly
- [ ] Test card `4242 4242 4242 4242` accepted
- [ ] Webhook signature verification passes
- [ ] Invoice automatically marked as paid after successful payment
- [ ] Subscription status changes from 'pending_payment' → 'active'
- [ ] PDF invoice downloads successfully
- [ ] PDF contains: invoice number, college name, amount, tax, dates
- [ ] Billing contact creation works (optional: Dr. Sharma adds GST number)
- [ ] API response times <2 seconds even during payment processing

### Edge Cases to Test
1. **Failed Payment**: Use card `4000 0000 0000 0002` → invoice stays 'pending', subscription NOT activated
2. **Disputed Payment**: Use card `4000 0000 0000 9995` → invoice marked 'disputed'
3. **Webhook Delay**: Simulate delayed webhook → invoice eventually updates (idempotency check)
4. **Missing Signature**: POST webhook without `stripe-signature` header → 400 Forbidden
5. **Duplicate Webhook**: Send same event twice → idempotent (no duplicate invoice)

---

## Scenario 3: Career/Placement Module Removed (Regression Check)

### Context
- Goal: Verify Career/Placement features are cleanly removed from student portal
- Expected: No broken links, no orphaned UI elements, no 404s
- Check Duration: 10 minutes

### Steps

| # | Actor | Action | Expected Result | Status |
|---|-------|--------|-----------------|--------|
| 1 | Student | Login to student portal | Dashboard loads | ✅ |
| 2 | Student | Check sidebar navigation | NO "Coach" tab visible | ✅ |
| 3 | Student | Check dashboard cards | NO "Career Prep" card visible | ✅ |
| 4 | Student | Check dashboard cards | NO "AI Mock Interview" card visible | ✅ |
| 5 | Student | Navigate to `/app/student-portal/placement-coach` | 404 Not Found or redirect to home | ✅ |
| 6 | Student | Navigate to `/app/student-portal/mock-interview` | 404 Not Found or redirect to home | ✅ |
| 7 | Student | View results page | NO "Mock Interview Notification" banner | ✅ |
| 8 | Student | View results page | NO "Placement Coach" quick action | ✅ |
| 9 | Student | View soft skills page | NO "AI Mock Interview" card | ✅ |
| 10 | Student | Check exam results | NO "View Placement Score" button | ✅ |
| 11 | System | Check browser console | NO 404 errors for removed pages | ✅ |
| 12 | System | Check network tab | NO failed requests to `/placement-coach` routes | ✅ |
| 13 | College Admin | Check recruitment section | NO recruitment module in SuperAdmin (future removal) | ⏳ |

### Validation Checklist
- [ ] No "Coach" tab in StudentPortalLayout navigation
- [ ] No "AI Coach" section in sidebar
- [ ] No Career Prep dashboard zone
- [ ] No mock interview cards anywhere in student portal
- [ ] PlacementCoachPage.tsx deleted from codebase
- [ ] MockInterview* files deleted
- [ ] placementCoachService.ts deleted
- [ ] No `placement-coach` or `mock-interview` routes in App.tsx
- [ ] No broken image/resource links in console
- [ ] SuperAdmin recruitment still intact (for college monitoring only)

### Edge Cases to Test
1. **Direct URL Access**: Student bookmarked old placement-coach URL → graceful 404
2. **Old Cache**: Browser cached old navigation → clear cache, verify new nav loads
3. **Deep Links**: Emails/notifications with old links → redirect or 404, not crash

---

## Scenario 4: SuperAdmin College Onboarding (Zero-State Checklist)

### Context
- Actor: Super Admin
- Goal: Onboard new college (XYZ University) with zero-state checklist
- Expected Duration: 25 minutes
- Related: Commit 38238bf (zero-state onboarding checklist added)

### Steps

| # | Actor | Action | Expected Result | Data Changes | Status |
|---|-------|--------|-----------------|--------------|--------|
| 1 | Super Admin | Login to SuperAdmin portal | Dashboard loads | - | ✅ |
| 2 | Super Admin | Navigate to Colleges → Create New | College creation form opens | - | ✅ |
| 3 | Super Admin | Enter college details (name, email, code) | Form validates | - | ✅ |
| 4 | Super Admin | Click "Create College" | College created with status='pending' | `colleges` row inserted | ✅ |
| 5 | System | Show onboarding checklist | Displays 5-step checklist: | - | ✅ |
| | | | 1. ☐ Create admin user | | |
| | | | 2. ☐ Import students (bulk) | | |
| | | | 3. ☐ Set up question bank | | |
| | | | 4. ☐ Create first assessment | | |
| | | | 5. ☐ Approve subscription | | |
| 6 | Super Admin | Click "Step 1: Create Admin User" | Admin creation form opens | - | ✅ |
| 7 | Super Admin | Enter admin email, generate password | Admin user created | `users` row inserted (role='college_admin') | ✅ |
| 8 | System | Mark step 1 complete | ☑ Step 1 checked | - | ✅ |
| 9 | Super Admin | Click "Step 2: Bulk Import Students" | Shows CSV template download | - | ✅ |
| 10 | Super Admin | Upload CSV (100 students) | Validation shows "100 rows valid, 0 errors" | - | ✅ |
| 11 | Super Admin | Confirm import | Students imported | 100x `student_details` rows inserted | ✅ |
| 12 | System | Mark step 2 complete | ☑ Step 2 checked | - | ✅ |
| 13 | Super Admin | Skip steps 3-4 (college admin will do) | Checklist shows progress (2/5) | - | ✅ |
| 14 | Super Admin | Click "Step 5: Approve Subscription" | Subscription approval form opens | - | ✅ |
| 15 | Super Admin | Select "Pro Plan", approve | Subscription created | `subscriptions` row inserted (status='active') | ✅ |
| 16 | System | Mark step 5 complete | ☑ Step 5 checked, Onboarding 100% complete | College status → 'active' | ✅ |
| 17 | Super Admin | See success banner | "College XYZ University is ready to go!" | - | ✅ |

### Validation Checklist
- [ ] Zero-state checklist visible for newly created colleges
- [ ] All 5 steps clearly labeled with icons (☐/☑)
- [ ] Completion progress shown (e.g., "2 of 5 complete")
- [ ] Step links navigate to correct forms (college admin, bulk import, etc.)
- [ ] College status changes from 'pending' → 'active' when checklist complete
- [ ] CSV template includes required columns (name, email, student_id, program, department, batch)
- [ ] Bulk import validates and shows error count before confirming
- [ ] Subscription pre-filled in step 5 (no double-signup needed)

### Edge Cases to Test
1. **Incomplete Onboarding**: Admin leaves after step 2 → can resume later, progress saved
2. **CSV with Errors**: Upload CSV with 5 bad rows out of 100 → shows errors, allows retry
3. **Duplicate Emails**: CSV has duplicate student emails → validation catches, prevents import
4. **Approval Rejected**: Super admin rejects college in step 5 → sends notification to college admin

---

## Scenario 5: Student Takes Proctored Assessment

### Context
- Student: Bob (has practice history)
- Assessment: "Pre-Placement Mock Test" (60 min, 30 questions)
- Goal: Complete assessment, get auto-graded results
- Expected Duration: 70 minutes (assessment + results)

### Steps

| # | Actor | Action | Expected Result | Data Changes | Status |
|---|-------|--------|-----------------|--------------|--------|
| 1 | Bob | Login to student portal | Dashboard loads | - | ✅ |
| 2 | Bob | Navigate to Assessments → My Assessments | Shows available campaigns | GET `/student/assessments` | ✅ |
| 3 | Bob | Click "Pre-Placement Mock Test" | Assessment detail page opens | - | ✅ |
| 4 | Bob | Click "Start Exam" | Exam instructions shown (30 questions, 60 min, auto-graded) | - | ✅ |
| 5 | Bob | Read instructions, click "Begin" | Timer starts (60:00), Q1 loads | `exam_attempts` row inserted | ✅ |
| 6 | Bob | Answer Q1-Q30 in 58 minutes | Exam engine validates each response | 30x responses stored in `exam_attempts` | ✅ |
| 7 | Bob | Click "Submit Assessment" | Confirmation modal: "Are you sure?" | - | ✅ |
| 8 | Bob | Confirm submission | Exam ends, auto-grading starts | exam_attempts.status='submitted' | ✅ |
| 9 | System | Auto-grade (multiple choice answers) | Score calculated: 24/30 = 80% | `marks_scored` row inserted | ✅ |
| 10 | System | Generate result PDF/report | Shows questions, answers, score breakdown | - | ✅ |
| 11 | Bob | See results page | "Score: 80/100 (Pass)" with breakdown by topic | - | ✅ |
| 12 | Bob | Click "View Detailed Report" | Shows each Q: correct/incorrect, topic, difficulty | - | ✅ |
| 13 | Bob | Click "Download Result" | PDF downloads | - | ✅ |
| 14 | System | Update adaptive learning | Skill accuracy recalculated with this attempt | practice_attempts updated for each Q | ✅ |
| 15 | Bob | Return to dashboard | See "Latest Result: 80%" in widget | - | ✅ |

### Validation Checklist
- [ ] Exam engine loads without lag
- [ ] Timer counts down accurately (real-time)
- [ ] Questions display with images/formatting intact
- [ ] Answer selections persist (no data loss on scroll)
- [ ] Auto-grading calculates score correctly (multiple choice)
- [ ] Result page shows pass/fail threshold met
- [ ] Detailed report breaks down by topic/difficulty
- [ ] PDF download includes all assessment details
- [ ] Skill accuracy recalculated post-assessment
- [ ] Adaptive learning reflects new performance data

### Edge Cases to Test
1. **Time Expires**: Bob runs out of time at Q28 → auto-submit remaining answers
2. **Browser Close**: Bob closes tab mid-exam → session saved, can resume
3. **Network Dropout**: Connectivity lost for 10 sec during exam → buffered, auto-recover
4. **Manual Grade Override**: Instructor manually grades Q5 → final_score updates, student notified

---

## Scenario 6: College Admin Creates & Launches Assessment Campaign

### Context
- College: XYZ University
- Admin: Dr. Sharma (college_admin)
- Goal: Create assessment, launch to students, monitor results
- Expected Duration: 30 minutes

### Steps

| # | Actor | Action | Expected Result | Data Changes | Status |
|---|-------|--------|-----------------|--------------|--------|
| 1 | Dr. Sharma | Login to college portal | Dashboard loads | - | ✅ |
| 2 | Dr. Sharma | Navigate to Assessments → Create New | Assessment creation form opens | - | ✅ |
| 3 | Dr. Sharma | Enter assessment details | Name, description, duration (60 min), pass score (70%) | - | ✅ |
| 4 | Dr. Sharma | Select questions from question bank | Adds 25 questions (8 easy, 10 medium, 7 hard) | - | ✅ |
| 5 | Dr. Sharma | Configure settings | Shuffle: yes, show answers: after_completion, proctoring: monitored | - | ✅ |
| 6 | Dr. Sharma | Click "Save as Draft" | Assessment created with status='draft' | `assessments` row inserted | ✅ |
| 7 | Dr. Sharma | Review questions, click "Publish" | Assessment status='published' | assessments.status='published', published_at=NOW() | ✅ |
| 8 | Dr. Sharma | Navigate to Campaigns → Create New | Campaign creation form opens | - | ✅ |
| 9 | Dr. Sharma | Enter campaign details | Name: "March Aptitude Test", select assessment, set dates | - | ✅ |
| 10 | Dr. Sharma | Select target cohort | "Batch 2024, Department: CSE" (150 students) | - | ✅ |
| 11 | Dr. Sharma | Configure rules | Attempt limit: 1, late submission: allowed (12 hours) | - | ✅ |
| 12 | Dr. Sharma | Click "Launch Campaign" | Campaign created, emails sent to 150 students | `campaigns` row inserted, 150x `campaign_students` rows | ✅ |
| 13 | Students | Receive email | "Assessment launched: March Aptitude Test" | - | ✅ |
| 14 | Dr. Sharma | Navigate to Campaign Analytics | Dashboard shows real-time metrics | GET `/assessments/{id}/analytics` | ✅ |
| 15 | System | Display analytics | Started: 45/150, Completed: 30/150, Avg Score: 75% | - | ✅ |
| 16 | Dr. Sharma | Click "View Detailed Report" | Shows individual scores, completion time, cheating risk flags | - | ✅ |
| 17 | Dr. Sharma | Filter by cheating risk | Shows 2 students with high risk scores | cheating_logs with risk_score > 0.7 | ✅ |
| 18 | Dr. Sharma | Click "Review for Manual Grading" | Shows Q24 (essay) for 3 students | essay questions flagged for manual grading | ✅ |
| 19 | Dr. Sharma | Grade essay (Q24) for student 1 | Assigns 8/10, saves | `marks_scored` updated for essay Q | ✅ |
| 20 | System | Recalculate final score | Student 1: 75 (auto) + 8 (manual) / 83 (max) = 77% | final_score recalculated | ✅ |
| 21 | Dr. Sharma | Download results CSV | CSV includes: student, score, completion time, pass/fail | - | ✅ |

### Validation Checklist
- [ ] Assessment creation form validates all required fields
- [ ] Question selection shows preview (text, difficulty, options)
- [ ] Configuration options (shuffle, proctoring, show answers) persist
- [ ] Publish changes assessment.status='published' and published_at timestamp
- [ ] Campaign launch creates campaign_students entries for all cohort students
- [ ] Emails sent with assessment link and deadline
- [ ] Analytics dashboard loads without lag
- [ ] Real-time completion counts update as students finish
- [ ] Cheating risk scores calculated and displayed
- [ ] Manual grading interface handles essay responses
- [ ] Final scores recalculated after manual grading
- [ ] CSV export includes all required columns

### Edge Cases to Test
1. **No Questions Selected**: Dr. Sharma tries to publish with 0 questions → validation error
2. **Cohort Empty**: Selected cohort has 0 students → warning shown, campaign still creates
3. **Deadline Passed**: Campaign deadline 2 hours ago → shows "Closed" but late submissions allowed
4. **Concurrent Edits**: Dr. Sharma and another admin edit campaign simultaneously → last write wins (conflict handled)

---

## Scenario 7: SuperAdmin Approves College & Manages Subscription

### Context
- New college applied for platform
- Super Admin needs to: review, approve, set subscription tier
- Expected Duration: 10 minutes

### Steps

| # | Actor | Action | Expected Result | Data Changes | Status |
|---|-------|--------|-----------------|--------------|--------|
| 1 | Super Admin | Login to SuperAdmin | Dashboard loads | - | ✅ |
| 2 | Super Admin | Navigate to Colleges → Approvals | Shows 3 pending colleges | GET `/superadmin/colleges?status=pending` | ✅ |
| 3 | Super Admin | Click "ABC University" (pending) | College detail page opens | - | ✅ |
| 4 | Super Admin | Review college info | Name, city, contact, admin user info | - | ✅ |
| 5 | Super Admin | Click "Approve College" | Approval form opens | - | ✅ |
| 6 | Super Admin | Select subscription tier | "Pro: ₹15,000/month" | - | ✅ |
| 7 | Super Admin | Add approval notes | "NAAC Grade: A+, Tier-1 eligible" | - | ✅ |
| 8 | Super Admin | Click "Approve" | College approved, subscription activated | colleges.approval_status='approved', subscriptions.status='active' | ✅ |
| 9 | System | Send notification to college | Email: "Your college has been approved!" | - | ✅ |
| 10 | Super Admin | View college in Active list | ABC University now in "Active Colleges" | - | ✅ |
| 11 | Super Admin | Navigate to Analytics | See new college in cross-tenant dashboard | - | ✅ |

### Validation Checklist
- [ ] Approval form shows all college details for review
- [ ] Subscription tier selection is mandatory
- [ ] Approval changes college.approval_status to 'approved'
- [ ] College admin receives approval email
- [ ] Subscription auto-created on approval
- [ ] College appears in active list immediately
- [ ] Analytics include new college data (0 students initially)
- [ ] College can't access portal until approval_status='approved'

---

## Scenario 8: Data Isolation - Multi-Tenant Verification

### Context
- Verify row-level isolation works: College A can't see College B data
- Security check: No data leakage between tenants
- Expected Duration: 15 minutes

### Steps

| # | Actor | Action | Expected Result | Validation | Status |
|---|-------|--------|-----------------|------------|--------|
| 1 | College A Admin | Login | JWT contains college_id=A | - | ✅ |
| 2 | College A Admin | GET `/students` | Returns only College A students (50) | college_id=A filter applied | ✅ |
| 3 | Attacker | Try to bypass: GET `/students?college_id=B` | Returns only College A students (ignores query param) | Backend ignores user-supplied college_id | ✅ |
| 4 | Attacker | Try direct API: GET `/api/v1/students/[college-b-student-id]` | 403 Forbidden (not found in College A) | row-level check blocks access | ✅ |
| 5 | Attacker | Try to access College B invoice | GET `/billing/invoices` returns only College A invoices | invoices filtered by college_id from JWT | ✅ |
| 6 | System | Check audit logs | No cross-college access recorded | audit_logs.college_id only shows local | ✅ |
| 7 | Attacker | Try SQL injection: GET `/students?name='); DROP TABLE students;--` | Parameterized queries prevent injection | Zod validation + prepared statements | ✅ |
| 8 | College A Admin | View audit trail | Shows only College A actions (1,000+ entries) | audit_logs WHERE college_id=A | ✅ |
| 9 | College B Admin | View audit trail | Shows only College B actions, NOT College A | audit_logs WHERE college_id=B | ✅ |

### Validation Checklist
- [ ] Every API endpoint filters by college_id from JWT (not from user input)
- [ ] college_id is immutable in JWT (can't be modified by client)
- [ ] All queries use parameterized statements (no SQL injection)
- [ ] Cross-college direct IDs blocked with 403 or 404
- [ ] Audit logs only show current college's actions
- [ ] Soft deletes don't leak data from other colleges
- [ ] No cross-college relationship queries possible (e.g., College A → College B students)

### Edge Cases to Test
1. **JWT Tampering**: Admin modifies JWT to college_id=B → token validation fails, 401
2. **Compromised Token**: Attacker has valid College A token → can only see College A data
3. **Shared Question Bank**: Questions are cross-college (admin_added) → verify college_id checks work
4. **Deleted College**: College C deleted (soft) → students soft-deleted too, not leaked to others

---

## Summary: Validation Coverage

| Scenario | Feature Area | Risk Level | Status |
|----------|--------------|-----------|--------|
| 1 | Adaptive Learning | Medium | ✅ Untested |
| 2 | Billing + Stripe | High | ✅ Untested |
| 3 | Career/Placement Removal | Medium | ✅ Untested |
| 4 | College Onboarding | Low | ✅ Untested |
| 5 | Proctored Assessment | High | ✅ Untested |
| 6 | Campaign Launching | High | ✅ Untested |
| 7 | SuperAdmin Approval | Medium | ✅ Untested |
| 8 | Data Isolation (Security) | Critical | ✅ Untested |

---

## Next Steps for Review

1. **Review Scenarios**: You validate these scenarios for completeness
2. **Identify Gaps**: Note any missing workflows or edge cases
3. **Run Tests**: I can execute validation against each scenario
4. **Document Issues**: Log any failures with reproduction steps
5. **Sign-Off**: Approval before production deployment

**Questions for Your Review**:
- [ ] Are these scenarios comprehensive?
- [ ] Any missing user journeys?
- [ ] Any edge cases not covered?
- [ ] Any concerns about the workflows?

Please review and provide feedback!
