# End-to-End Workflow Tests

This directory contains **complete business workflow tests** instead of isolated feature tests. Each workflow represents a real user journey from start to finish.

## Philosophy

- **One test = One complete workflow** (not multiple granular tests)
- **Independent**: Each workflow can run standalone, in any order, multiple times
- **Realistic**: Tests real business processes, not feature fragments
- **Reusable**: Same workflows run against local/sandbox/production (config-only changes)
- **Idempotent**: Tests generate unique data (timestamps) so they can re-run safely

## Workflow Inventory

### Workflow 1: College Onboarding ✅ (Template)
**File**: `workflow-1-college-onboarding.spec.ts`  
**Duration**: 3-5 minutes  
**Steps**:
1. Super Admin login
2. Create new college
3. Generate college admin credentials
4. Activate college
5. Verify college admin can login

**Output State**: collegeId, collegeName, collegeAdminEmail, etc.  
**Next Workflow**: Workflow 2 (Student Onboarding)

### Workflow 2: Student Onboarding (TBD)
**Duration**: 3-5 minutes  
**Steps**:
1. College Admin login (uses Workflow 1 state)
2. Create department (if required)
3. Register/bulk upload students
4. Activate students
5. Verify student login

**Output State**: studentEmails[], departmentId, etc.  
**Next Workflow**: Workflow 3 (Question Bank)

### Workflow 3: Question Bank Workflow (TBD)
**Duration**: 5-10 minutes  
**Steps**:
1. Super Admin login
2. Generate AI Question Bank
3. Review/Edit/Approve questions
4. Publish to Global Repository
5. Assign to college

**Output State**: questionBankId, questionCount, etc.  
**Next Workflow**: Workflow 4 (Assessment)

### Workflow 4: Assessment Workflow (TBD)
**Duration**: 3-5 minutes  
**Steps**:
1. College Admin login
2. Import/Select Question Bank (from Workflow 3)
3. Create Assessment
4. Create Assessment Campaign
5. Assign to students (from Workflow 2)
6. Publish

**Output State**: assessmentId, campaignId, etc.  
**Next Workflow**: Workflow 5 (Learning)

### Workflow 5: Student Learning Workflow (TBD)
**Duration**: 5-15 minutes  
**Steps**:
1. Student login
2. Access Learning Hub
3. Complete learning material
4. Practice questions
5. Attempt mock assessment
6. Track progress

**Output State**: learningProgress, practiceAttempts, mockScore, etc.  
**Next Workflow**: Workflow 6 (Examination)

### Workflow 6: Student Examination Workflow (TBD)
**Duration**: 10-20 minutes  
**Steps**:
1. Student login
2. Start assessment
3. Complete all questions
4. Submit assessment
5. Verify evaluation
6. Verify results
7. Check analytics/score

**Output State**: attemptId, score, percentage, etc.  
**Final Outcome**: Complete student journey validated

---

## Workflow State Management

Each workflow maintains its own state file:
- Location: `.runtime/workflow-{name}-state.json`
- Scoped: Workflows don't interfere with each other
- Persistent: State available to downstream workflows

### Usage

```typescript
import { workflowState } from "../helpers/workflow-state";

// Read state
const state = workflowState("college-onboarding");
const { collegeId, collegeName } = state.read();

// Write state
state.write({
  collegeId: "123e4567-e89b-12d3-a456-426614174000",
  collegeName: "Test College",
  collegeAdminEmail: "admin@college.edu",
});

// Clear state (for cleanup)
state.clear();
```

---

## Running Workflows

### Run All Workflows
```bash
cd client
npx playwright test --config=playwright.sprint1a.config.ts tests/e2e/sprint-1a/workflows/
```

### Run Single Workflow
```bash
npx playwright test --config=playwright.sprint1a.config.ts tests/e2e/sprint-1a/workflows/workflow-1-college-onboarding.spec.ts
```

### Run with HTML Report
```bash
npx playwright test --config=playwright.sprint1a.config.ts tests/e2e/sprint-1a/workflows/ --reporter=html
npx playwright show-report
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test --config=playwright.sprint1a.config.ts tests/e2e/sprint-1a/workflows/ --headed
```

### Run Against Different Environment
```bash
# Local (default)
npx playwright test tests/e2e/sprint-1a/workflows/

# Sandbox
BASE_URL=https://sandbox.talentsecure.com npx playwright test tests/e2e/sprint-1a/workflows/

# Production
BASE_URL=https://talentsecure.com npx playwright test tests/e2e/sprint-1a/workflows/
```

---

## Workflow Pattern Template

Use this as a template when creating new workflows:

```typescript
import { test, expect } from "../fixtures/test.fixture";
import { BASE_URL, ROUTES, ADMIN, STUDENT } from "../config/env";
import { workflowState } from "../helpers/workflow-state";
import { clearAuthSession } from "../helpers/session";

test.describe("WORKFLOW N: [Description]", () => {
  test.setTimeout(300_000); // 5 minutes

  test("Complete: [Step1] → [Step2] → ... → [StepN]", async ({
    // Inject needed page objects
    loginPage,
    dashboardPage,
    page,
    request,
  }) => {
    const state = workflowState("[workflow-name]");
    const timestamp = Date.now();

    // ============================================
    // STEP 1: [Description]
    // ============================================
    console.log("[Workflow N] Step 1: [Description]...");
    // Test code here
    console.log("[Workflow N] ✓ Step 1 complete");

    // ============================================
    // STEP 2: [Description]
    // ============================================
    // Test code here

    // ============================================
    // FINAL: Save State
    // ============================================
    state.write({
      key1: value1,
      key2: value2,
      workflowCompletedAt: new Date().toISOString(),
    });

    console.log(`✓ Workflow N complete`);
  });
});
```

---

## Debugging Workflows

### Enable Detailed Logging
Workflows include `console.log()` statements. View them in:
- Playwright HTML report (Attachments → Console)
- Terminal output (with `--reporter=list`)

### Capture Screenshots
```typescript
await page.screenshot({ path: `./screenshots/workflow-1-step-5.png` });
```

### Trace Files
```bash
npx playwright test --config=playwright.sprint1a.config.ts --trace=on
```

### Headed Mode with Debugging
```bash
npx playwright test --headed --debug --config=playwright.sprint1a.config.ts
```

---

## State Files (for reference)

After running workflows, check:
- `.runtime/workflow-college-onboarding-state.json`
- `.runtime/workflow-student-onboarding-state.json`
- etc.

Each file contains the outputs needed by downstream workflows.

---

## Transition from Feature Tests

These workflows **replace** the old feature tests in `specs/`:
- Old: `flow-01-superadmin-onboarding.spec.ts` + `flow-02-college-crud.spec.ts` + `flow-03-college-admin-credentials.spec.ts` = multiple tests, multiple files
- New: `workflow-1-college-onboarding.spec.ts` = one complete workflow

**Benefits**:
- ✅ Single source of truth for college onboarding
- ✅ Easier to debug (one test = one workflow)
- ✅ More realistic (tests complete process, not fragments)
- ✅ Better for cross-environment testing (same test, different config)

---

## Checklist for New Workflows

When creating a new workflow:

- [ ] Create spec file: `workflow-N-[name].spec.ts`
- [ ] Use `workflowState("[name]")` for state management
- [ ] Include `console.log()` for each major step
- [ ] Save final state with `state.write()`
- [ ] Test independently (before chaining with other workflows)
- [ ] Add to this README
- [ ] Update npm scripts if needed

---

## Questions?

Each workflow includes detailed comments and console logging. Read the workflow spec and trace/video artifacts in Playwright reports for debugging.
