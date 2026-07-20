# Wave 1 — RBAC & Auth Security

## Authentication

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| SEC-AUTH-01 | Valid login per role | JWT/accessToken issued | PARTIAL |
| SEC-AUTH-02 | Wrong password | 401; no token | PARTIAL |
| SEC-AUTH-03 | Tab/role mismatch | Client rejects with toast; stays on login | PARTIAL |
| SEC-AUTH-04 | Expired / invalid token | API 401 | BACKLOG |
| SEC-AUTH-05 | Forced password reset | Temp password → setup-password | AUTOMATED |
| SEC-AUTH-06 | Session clear on role switch | No SA token used as college | PARTIAL |
| SEC-AUTH-07 | Concurrent login policy | Document product behavior | BACKLOG |

## Authorization / RBAC

| ID | Check | Pass criteria | Status |
|----|-------|---------------|--------|
| SEC-RBAC-01 | SA can manage drives/QB | 2xx on manage APIs | PARTIAL |
| SEC-RBAC-02 | College cannot POST `/api/drives` | 403 | BACKLOG |
| SEC-RBAC-03 | College sees only own campus drives | `/api/campus/drives` scoped | PARTIAL |
| SEC-RBAC-04 | Student cannot access `/app/superadmin` | Redirect / guard | PARTIAL |
| SEC-RBAC-05 | Student exam only if assigned | enroll/start fails otherwise | BACKLOG |
| SEC-RBAC-06 | Faculty vs college_admin permissions | Document + spot-check | BACKLOG |

## Broken access / IDOR

| ID | Check | Status |
|----|-------|--------|
| SEC-IDOR-01 | College A cannot read College B students by id | BACKLOG |
| SEC-IDOR-02 | Student cannot fetch another drive session | BACKLOG |
| SEC-IDOR-03 | Direct URL to `/drives/:otherId` as college | BACKLOG |

## Injection / XSS / CSRF (Wave 1 smoke)

| ID | Check | Status |
|----|-------|--------|
| SEC-INJ-01 | College name XSS reflected escaped | PARTIAL (edge unicode) |
| SEC-INJ-02 | SQL injection in search params | BACKLOG |
| SEC-CSRF-01 | Cookie/SameSite posture documented | BACKLOG |

## Secrets & data exposure

| ID | Check | Status |
|----|-------|--------|
| SEC-SEC-01 | AI API keys not returned in clear to browser | MANUAL |
| SEC-SEC-02 | Password hashes not in API responses | MANUAL |
| SEC-SEC-03 | Secure headers (Helmet etc.) | BACKLOG |

## OWASP Top 10 (Wave 2 suite)

Track formal coverage in Wave 2: A01 Broken Access Control through A10 SSRF — map each to API/UI cases. Status: **BACKLOG**.
