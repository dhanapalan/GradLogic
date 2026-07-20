# Path A — Platform QB → College → Student

End-to-end validation of the Assessment Hub assignment path:

**Question Bank (published) → Question Collections → Assessment Builder (drive) → Assign Campus → College review → Student learn / practice / exam → Results**

## Run

```bash
cd client
# local Vite + API must be up (admin.localhost:5173 / :5050)
npm run test:sprint1a:path-a
```

## Gates (flow-15)

| # | Gate | Spec |
|---|------|------|
| 15.1 | QB browse has published rows | UI |
| 15.2 | Collection filled from bank | API ensure + UI |
| 15.3 | Create practice drive from collection | UI |
| 15.4 | Approve question pool | UI (+ API fallback) |
| 15.5 | Assign Demo College | UI (+ API fallback) |
| 15.6 | Mark Ready + Publish | UI (+ API fallback) |
| 15.7 | College sees assigned drive | UI |
| 15.8 | Student Learning Hub | UI |
| 15.9 | Student Practice Hub | UI |
| 15.10 | Student Tests shows drive; start exam best-effort | UI |
| 15.11 | Student Results page | UI |

## Env overrides

| Var | Default |
|-----|---------|
| `S1A_SUPERADMIN_EMAIL` / `PASSWORD` | `admin@gradlogic.com` / `Admin123` |
| `S1A_COLLEGE_EMAIL` / `PASSWORD` | `college@gradlogic.com` / `gradlogic123` |
| `S1A_STUDENT_EMAIL` / `PASSWORD` | `student4@democollege.edu` / `gradlogic123` |
| `BASE_URL` | `http://localhost:5173` (use `http://admin.localhost:5173` if host-gated) |
| `API_URL` | `http://localhost:5050/api` |

Runtime IDs written to `.runtime/sprint1a-state.json` (`pathADriveId`, `pathADriveName`, …).

## Not covered (Path B)

Campus-owned `college_questions` → assessments → campaigns → My Assessments — see `COLLEGE_DEMO_GUIDE.md`.
