# Sprint 1A — GradLogic College Admin Portal (Playwright E2E)

Production-oriented **Page Object Model** suite for the nine critical college-admin business flows.

## Browser & artifacts (required)

| Setting | Value |
|---------|--------|
| Browser | Chromium |
| Mode | **headed** (`headless: false`) |
| slowMo | `400` ms (override with `SLOW_MO`) |
| Viewport | `1600×900` |
| Video | on |
| Trace | on |
| Screenshots | on (+ per-step under `test-results/sprint-1a/steps/`) |
| Console / network | captured via fixtures (`ConsoleMonitor`, `NetworkMonitor`) |
| Interactions | highlight-on-click + natural typing (`pressSequentially`) |

## Folder structure

```
client/tests/e2e/sprint-1a/
├── config/env.ts                 # URLs, credentials, routes
├── fixtures/test.fixture.ts      # POM + monitor fixtures
├── components/                   # ConfirmModal, AppNav
├── pages/                        # Page objects (auth, superadmin, campus, student)
├── utils/                        # assertions, monitors, interactions
├── data/factories.ts             # Unique college/student payloads
├── helpers/runtime-state.ts      # Cross-flow credential hand-off
├── specs/
│   ├── flow-01-super-admin-login.spec.ts
│   ├── flow-02-college-crud.spec.ts
│   ├── flow-03-college-admin-credentials.spec.ts
│   ├── flow-04-college-admin-login.spec.ts
│   ├── flow-05-campus-dashboard.spec.ts
│   ├── flow-06-student-registration.spec.ts
│   ├── flow-07-student-login.spec.ts
│   ├── flow-08-student-onboarding.spec.ts
│   └── flow-09-student-dashboard.spec.ts
└── README.md
```

Config entrypoint: `client/playwright.sprint1a.config.ts`

## Flows

| # | Flow | Spec |
|---|------|------|
| 1 | Super Admin Login → Dashboard KPIs / nav / profile / notifications → Logout | `flow-01-…` |
| 2 | College CRUD (create, edit, deactivate cancel/confirm, activate, grid, details) | `flow-02-…` |
| 3 | College Admin credential generation (username, temp password, email, copy) | `flow-03-…` |
| 4 | College Admin login → forced password reset → policy → dashboard → logout | `flow-04-…` |
| 5 | Campus dashboard KPIs / charts / activity / nav | `flow-05-…` |
| 6 | Student registration → verify in grid | `flow-06-…` |
| 7 | Student login → forced password reset → dashboard → logout | `flow-07-…` |
| 8 | Student onboarding (resume skip allowed) → submit success | `flow-08-…` |
| 9 | Student dashboard progress / assessments / recommendations / notifications | `flow-09-…` |

### Edge cases (negative / boundary)

See `specs/edge-cases/README.md`. Run with `npm run test:sprint1a:edge`.

### Quality / stability / diagnostics

See [`QUALITY.md`](./QUALITY.md). Automatically enabled via fixtures + `gradlogic-summary` reporter:

- Console / JS / unhandled rejection gates  
- Network 4xx/5xx / timeout / retry / slow detection  
- API validators (headers, auth, schema, rules, timing)  
- Lifecycle screenshots + full video/trace  
- Step JSONL logging + performance metrics  
- HTML · JUnit · JSON · execution/failure summaries with artifact links  

### Onboarding step mapping (product brief → live UI)

The live wizard in `StudentOnboardingWizard.tsx` is:

`Welcome → Personal → Academic → Skills → Career Goals → Resume Upload → Terms & Privacy → Success`

Brief items *Interests / Certifications / Review* map to **Skills / Career Goals / Terms**. Resume skip is allowed (empty file continues).

## Step validation gate

Every major POM action can call `validateStep()` which asserts:

- Page loaded / spinner gone  
- URL  
- Breadcrumb (when present)  
- Page title / heading  
- Success toast (when expected)  
- No unexpected JS / console errors  
- API success (via `NetworkMonitor`)  
- Required controls visible  
- Step screenshot  

## Credentials

Defaults (override with env):

| Role | Env | Default |
|------|-----|---------|
| Super Admin | `S1A_SUPERADMIN_EMAIL` / `S1A_SUPERADMIN_PASSWORD` | `admin@gradlogic.com` / `Admin123` |
| Seeded College Admin | `S1A_COLLEGE_EMAIL` / `S1A_COLLEGE_PASSWORD` | `college@gradlogic.com` / `gradlogic123` |
| Post-reset password | `S1A_STRONG_PASSWORD` | `GradLogic@2026!` |

Generated TPO / student temp passwords from Flows 2–3 / 6 are stored in:

`client/tests/e2e/sprint-1a/.runtime/sprint1a-state.json`

and consumed by later flows. Run the suite **in order** (default `workers: 1`).

## Execution

From `client/`:

```bash
# Full Sprint 1A (headed Chromium, artifacts on)
npm run test:sprint1a

# Single flow
npx playwright test -c playwright.sprint1a.config.ts flow-01

# UI mode
npm run test:sprint1a:ui

# HTML report
npm run test:sprint1a:report

# Against production QA
BASE_URL=https://gradlogic.atherasys.com \
API_URL=https://api.gradlogic.atherasys.com/api \
S1A_SUPERADMIN_PASSWORD='…' \
npm run test:sprint1a
```

Prerequisites for local runs: Vite client (`npm run dev`) and API on `:5050` (config auto-starts Vite when `BASE_URL` is localhost).

## Reports & artifacts

| Artifact | Location |
|----------|----------|
| HTML report | `client/playwright-report/sprint-1a/` |
| Videos / traces / screenshots | `client/test-results/sprint-1a/` |
| Step screenshots | `client/test-results/sprint-1a/steps/` |
| JUnit / JSON | `client/test-results/sprint-1a/junit.xml`, `results.json` |

Open a failed trace:

```bash
npx playwright show-trace test-results/sprint-1a/**/trace.zip
```

## Coding standards

- One Page Object per screen; no raw selectors in specs  
- Fixtures own monitor lifecycle  
- Unique factory data per run (no hard-coded college/student emails)  
- Role tab **must** match account role (enforced by product login)  
- Prefer role / name / `#id` / `[name=…]` locators (app has no `data-testid` yet)  
- Serial mode within mutating flows; shared runtime state across dependent flows  
