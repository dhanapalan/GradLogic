# Portal Menu Validation

Validates **every sidebar menu** for College Admin, Super Admin, and Student portals, plus **valid / invalid** form data on key screens.

## Specs

| Spec | Portal |
|------|--------|
| `menu-college-admin.spec.ts` | College Admin — 12 menus + student/settings data |
| `menu-super-admin.spec.ts` | Super Admin — full leaf menu walk + college/user data |
| `menu-student.spec.ts` | Student — 9 menus + profile data + cross-portal block |

## Run

```bash
cd client
npx playwright test -c playwright.sprint1a.config.ts menu-college-admin menu-super-admin menu-student

# Or individually
npx playwright test -c playwright.sprint1a.config.ts menu-college-admin
```

## Credentials

| Portal | Env | Default |
|--------|-----|---------|
| Super Admin | `S1A_SUPERADMIN_*` | `admin@gradlogic.com` |
| College Admin | `S1A_COLLEGE_*` or runtime TPO | `college@gradlogic.com` |
| Student | `S1A_STUDENT_*` or runtime student | `student4@democollege.edu` |

## What each menu visit checks

- Page loaded / spinner gone  
- URL matches  
- No login redirect / crash boundary  
- Heading present (soft for Coming Soon pages)  
- Screenshot under `test-results/sprint-1a/steps/`  
