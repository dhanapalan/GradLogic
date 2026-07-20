# Wave 1 — UAT Go / No-Go

Audience: Product owner / college pilot sponsor.  
Environment: Demo College + seeded student.

## Preconditions

- [ ] API healthy (`/api/health`)
- [ ] Client reachable (`admin.localhost:5173` or agreed URL)
- [ ] Super Admin, College Admin, Student passwords known
- [ ] ≥15 published questions in platform bank (aptitude/python)

## Path A acceptance (must pass)

| # | Story | Pass |
|---|-------|------|
| UAT-A1 | SA shows published questions in QB browse | ☐ |
| UAT-A2 | Collection filled from bank | ☐ |
| UAT-A3 | Practice drive assembled and pool approved | ☐ |
| UAT-A4 | Demo College assigned; drive Ready/Published | ☐ |
| UAT-A5 | College Admin sees drive under Campus Drives | ☐ |
| UAT-A6 | Student sees drive under Tests | ☐ |
| UAT-A7 | Student can open instructions / start exam | ☐ |
| UAT-A8 | (Stretch) Student submits; score visible to student & college | ☐ |

**Go:** UAT-A1–A7 pass. **No-Go:** any of A1–A6 fail.

## Path B acceptance (pilot optional)

| # | Story | Pass |
|---|-------|------|
| UAT-B1 | Campus QB has Active questions | ☐ |
| UAT-B2 | Assessment published | ☐ |
| UAT-B3 | Campaign live in window | ☐ |
| UAT-B4 | Student completes My Assessments attempt | ☐ |
| UAT-B5 | Faculty sees results/integrity | ☐ |

## Onboarding acceptance (regression)

| # | Story | Pass |
|---|-------|------|
| UAT-O1 | Create college + TPO credentials | ☐ |
| UAT-O2 | College admin password change | ☐ |
| UAT-O3 | Register student + student login/onboarding | ☐ |

Automate via `npm run test:sprint1a` when env matches.

## Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Product | | | Go / No-Go |
| QA | | | Go / No-Go |
| Eng | | | Go / No-Go |
