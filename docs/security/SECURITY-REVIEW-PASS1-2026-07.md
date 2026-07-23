# GradLogic / TalentSecure-AI — Security Review (Static, Pass 1)

**Date:** 2026-07-21
**Scope of this pass:** Static (SAST) review of authentication, authorization,
API configuration, injection surfaces, secrets, file upload, and client XSS
sinks. Roles considered: Super Admin, College Admin/Faculty, Student.

**Explicitly NOT covered (requires a running instance + seeded role accounts):**
Dynamic testing (DAST) — live IDOR probing across all ~80 route groups, payload
execution, session fixation/replay, 2FA bypass, served security headers, SSRF,
and exam/proctoring business-logic abuse. These are listed under
"Requires dynamic testing" and are **unverified**, not cleared.

> This is a first pass. It is not a completed comprehensive pentest. Findings
> below are either verified in code or high-confidence from configuration.

---

## Risk summary

| Sev | Count | Headline |
|-----|-------|----------|
| Critical | 2 | Auth-token signing secret & Supabase service_role key exposed |
| High | 3 | Rate limiting disabled in prod · weak default secrets · stored XSS |
| Medium | 4 | Open self-registration · inconsistent upload validation · CSP · non-constant-time key compare |
| Low/Info | 3 | Global 10MB body limit · non-unique phone · cookie SameSite review |

Most Critical/High items stem from **configuration and secret hygiene**, not
the application code — which is largely well-built (see "Controls that are
working"). The exception is the stored-XSS finding (H3), which is a code defect.

---

## Critical

### C1 — Auth token signing secrets exposed → full account takeover
- **Module:** `.env` (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`); verified consumer at `server/src/middleware/auth.ts:34`
- **Evidence:** Both secrets were disclosed in plaintext this session and are presumed to be in shell history / prior commits.
- **Impact:** Anyone holding `JWT_SECRET` can **forge a valid access token for any user id and role**, including `super_admin`, with no password. `authenticate()` trusts any token that verifies against this secret. This is complete authentication bypass and privilege escalation.
- **OWASP:** A02 Cryptographic Failures, A07 Auth Failures / API2, API8.
- **Remediation:** Rotate both secrets immediately (new cleaned `.env` already carries fresh values). Rotating invalidates all existing sessions — expected. Purge from git history (`git filter-repo`) and shell history.
- **Re-test:** Confirm a token signed with the old secret is rejected; confirm all users must re-authenticate.

### C2 — Supabase `service_role` key exposed → RLS bypass
- **Module:** `.env` (`S3_SECRET_KEY`, Supabase block)
- **Evidence:** `service_role` JWT disclosed this session.
- **Impact:** The `service_role` key bypasses Supabase Row-Level Security entirely — full read/write to any bucket/table it governs, from anywhere.
- **OWASP:** A02, A01 Broken Access Control.
- **Remediation:** Revoke and reissue in the Supabase dashboard. Note the app currently resolves storage to MinIO (the Supabase block is overridden), so rotation should be low-impact — but the key is still live until revoked.
- **Re-test:** Old key returns 401 against the Supabase S3 endpoint.

---

### C3 — Default super_admin credentials, seeded into production [confirmed]
- **Module:** `docker/init-db/01-schema.sql:157` (admin), `docker/init-db/04-rbac-multitenancy.sql:461` (hr/cxo/engineer)
- **Evidence:** DB query on the validation env returns 4 active accounts — `admin@gradlogic.com` (super_admin), `hr@`, `cto@` (cxo), `engineer@` — all with password **`gradlogic123`**, hardcoded in the repo. `deploy.sh` applies `docker/init-db/*.sql` on every deploy, so these accounts are created in **production** as well. The seed does not set `must_change_password`, so the password never expires.
- **Impact:** Anyone with repo access (or who guesses the default) logs in as **super_admin** on production. Full platform takeover — no exploit needed, just the login form.
- **OWASP:** A07 Auth Failures (default credentials), A05 Misconfiguration.
- **Remediation:** Remove the demo seed users from the production init path (guard behind a `SEED_DEMO=1` flag, or delete them post-bootstrap), and force-rotate any that must exist (`must_change_password=TRUE` + a strong unique password). Never commit real passwords.
- **Re-test:** `POST /api/auth/login` with `gradlogic123` fails for all seeded roles in production.

## High

### H1 — Rate-limit config hygiene (NOT live-exploitable on validation env) [downgraded]
- **Endpoint:** `/api/auth/login`
- **Static evidence:** the reviewed `.env` had `DISABLE_RATE_LIMIT=true` (last of two definitions wins); `server/src/app.ts:147` gates every limiter behind `!DISABLE_RATE_LIMIT`.
- **DYNAMIC RESULT (2026-07-21, corrects the static finding):** against the live validation deployment, 14 failed logins returned **`429` from ~request 10** — the strict auth limiter (`max:10/15min`) **is enforced**. So login is **NOT** brute-forceable on this deployment; the running config differs from the reviewed `.env` (consistent with the deploy/repo mismatch — deployed config is sourced separately).
- **Residual risk:** the canonical `.env` still carries the disabling flag; any environment deployed from it *would* be exposed. Keep `DISABLE_RATE_LIMIT=false` in the source of truth.
- **OWASP:** A07, API4.
- **Re-test:** verified — 429 after 10 failed attempts.

### H2 — Weak / default service credentials
- **Module:** `.env` — `PG_PASSWORD=changeme_strong_password`, `QUESTION_ENGINE_API_KEY=dev-key-question-engine`
- **Impact:** Guessable Postgres password (network-reachable within Docker) and a trivially-guessable API key on the question engine.
- **OWASP:** A05 Misconfiguration, A07.
- **Remediation:** Fresh values in cleaned `.env`. `PG_PASSWORD` change requires recreating the (empty) Postgres volume — see cleaned-env deploy notes.
- **Re-test:** Confirm services authenticate with the new values and the old ones fail.

### H3 — Stored XSS via unsanitized HTML render
- **File/line:** `client/src/components/LessonContentRenderer.tsx:301`
- **Evidence:** `dangerouslySetInnerHTML={{ __html: text }}` on the `isHTML` branch, no sanitizer. The in-code comment states *"sanitise in production with DOMPurify"* — it is not. (The sibling markdown branch at :307 is safe: `markdownToHtml` escapes input first.)
- **Impact:** If lesson/course content flagged `isHTML` is authored or imported by a college admin (or via content import), injected `<script>`/`<img onerror>` executes in **every student's browser** that opens the lesson → session-scoped actions, token-in-memory theft, defacement.
- **OWASP:** A03 Injection (XSS), API8.
- **Remediation:** Sanitize with DOMPurify before render, or drop the raw-HTML branch and route everything through the escaping markdown renderer. Confirm who can set `isHTML` content.
- **Re-test:** Author lesson content containing `<img src=x onerror=alert(1)>`; confirm it renders inert.

---

## Medium

### M1 — Public self-registration endpoint contradicts policy
- **Endpoint:** `POST /api/auth/register/company` (`server/src/routes/auth.routes.ts:83`); client route `/auth/register` still reachable.
- **Impact:** Public account creation, while the stated policy (and the UI changes made this session) is "no self-service registration." Unbounded creation of company/HR accounts.
- **OWASP:** A01, A07.
- **Remediation:** If company self-registration is genuinely intended, keep it but rate-limit + add verification; otherwise disable the route and the client route. **Confirm intent** — this one is a policy question, not a clear bug.
- **Re-test:** `POST /api/auth/register/company` returns 404/403.

### M2 — Inconsistent file-upload validation
- **Module:** e.g. `server/src/routes/campus.questions.routes.ts:8` (`excelUpload`) — size limit only, **no `fileFilter`** / MIME check. `fileFilter` is used in some upload configs but not all.
- **Impact:** Arbitrary file types accepted (only size-bounded). Combined with how files are later served/parsed, this widens the malicious-upload surface.
- **OWASP:** A04 Insecure Design, A08.
- **Remediation:** Add a `fileFilter` allowlisting expected MIME types to every `multer` config; validate magic bytes for parsed formats (xlsx/pdf).
- **Re-test:** Upload a `.php`/`.svg` where an `.xlsx` is expected → rejected.

### M3 — Content-Security-Policy not explicitly set
- **Module:** `server/src/app.ts:100` — `helmet()` is enabled but only cross-origin policies are customized; no explicit CSP for the API/served content.
- **Impact:** Weaker defense-in-depth against XSS (compounds H3). Needs verification against **served** responses (DAST).
- **Remediation:** Define an explicit CSP appropriate to the SPA/API split.
- **Re-test:** Inspect `Content-Security-Policy` on live responses.

### M4 — Non-constant-time service-key comparison
- **File:** `server/src/middleware/auth.ts:110` — `apiKey !== env.AI_ENGINE_API_KEY`
- **Impact:** Theoretical timing side-channel on the AI-engine service key. Low practical risk over a network, but trivially fixable.
- **Remediation:** `crypto.timingSafeEqual`.
- **Re-test:** N/A (code review).

---

## Low / Informational

- **L1 — Global 10MB JSON body limit** (`app.ts:151`) applies to unauthenticated endpoints too; DoS surface, mitigated by rate limiting (once re-enabled). Consider a smaller limit on auth routes.
- **L2 — `phone_number` not unique** (`docker/init-db/02-...sql:26`, index only). Informational; blocks using phone as a login identifier safely (decision this session was to use Student ID instead — correct).
- **L3 — Refresh cookie `SameSite=lax`, `path=/api`** (`server/src/utils/refreshCookie.ts`) with API on a different subdomain than the SPA. Verify refresh works cross-subdomain; no CSRF token exists, but API auth is Bearer-header (not cookie), which limits CSRF exposure. Confirm the refresh endpoint isn't cookie-only-authenticated.

---

## Controls that are working (verified in code)

These are genuinely done right and should be preserved:

- **Parameterized queries** throughout auth/tenant paths; the only string-interpolated SQL found uses a **constant** (`LIMIT ${CAP}`, `CAP = 10000`), not user input.
- **Tenant isolation from the token:** `college_id` is derived from the JWT (`resolveCollegeId`, `campus.students.controller.ts:24`), never from client input, and queries scope with parameterized `WHERE college_id = $1`. Sampled controllers were clean.
- **httpOnly + `secure` (prod) refresh cookie**; access token kept in memory, not localStorage.
- **Per-request revocation check:** every authenticated request re-verifies the user exists and `is_active` (`auth.ts:43`), so disabling an account takes effect immediately.
- **Dedicated auth brute-force limiter** with `skipSuccessfulRequests` (counts only failures) — good design; it is simply disabled by H1's flag.
- **2FA challenge flow** separates challenge tokens from access tokens via a `purpose` claim (`auth.ts:38`).

---

## Requires dynamic testing (unverified — not cleared)

A running instance with a seeded account per role is needed to complete these:

1. **IDOR sweep** across all ~80 route groups — only a few were sampled statically.
2. **Payload execution** — actual XSS/SQLi/SSRF probes against live endpoints.
3. **SSRF** — audit any endpoint that fetches a user-supplied URL (resume-by-URL, image fetch, webhooks). Server→AI-engine calls appear to use a fixed internal URL (low risk) but this needs confirming.
4. **Business logic** — exam attempt tampering, score/readiness manipulation, proctoring bypass, campaign/result integrity.
5. **Session** — fixation, refresh-token replay after logout, 2FA challenge reuse.
6. **Served security headers** — CSP, HSTS, X-Frame-Options as actually returned via nginx + helmet.
7. **The Nest controller surface** — this review focused on the Express app; the duplicated Nest controllers (`server/src/nest/*`) need their own pass.

---

## Dynamic reconnaissance (passive, production — 2026-07-21)

Non-destructive checks against the live site (GET/HEAD only; no auth attempts,
no payloads, no probing). Active DAST (auth enumeration, IDOR, injection) was
**not** run against production — see boundary note below.

**Architecture note:** the SPA is served by **Vercel** (`Server: Vercel`), the
API by **nginx/1.24.0** on the VPS. Frontend and backend deploy through
different pipelines — client changes go to Vercel (likely git auto-deploy),
not `./deploy.sh client`. This split also means frontend security headers are a
**Vercel** concern, not helmet.

### D1 — Frontend (SPA) serves no Content-Security-Policy [Medium, confirmed]
- **Evidence:** `curl -I https://gradlogic.atherasys.com/` returns no `Content-Security-Policy` and no `Permissions-Policy`.
- **Impact:** helmet's CSP applies only to API (nginx) responses. The SPA — where H3's stored XSS executes — has no CSP, so an injected script runs unrestricted (no `script-src` allowlist, no `object-src 'none'`). Compounds H3.
- **Remediation:** Add a `headers` block in `vercel.json` with a CSP suited to the SPA (or a `<meta http-equiv>` CSP as a weaker fallback).
- **Re-test:** `curl -I` shows `Content-Security-Policy` on the document response.

### Confirmed-good (live)
- HTTP→HTTPS **308 redirect** enforced.
- **HSTS** on both surfaces (frontend `max-age=63072000`; API `max-age=31536000; includeSubDomains`).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` on both.
- **No API docs/Swagger exposed** (`/api-docs`, `/swagger`, … all 404).
- **No `X-Powered-By`**; `/api/health` payload minimal (no stack/version leakage beyond app version string).
- API carries a strong CSP (`default-src 'self'; object-src 'none'; …`).

### Info
- `Server: nginx/1.24.0 (Ubuntu)` — minor version disclosure (Low).

---

## Active testing — unauthenticated pass (2026-07-21, validation env)

Non-destructive active probes against the live validation target (no real users
onboarded). Login endpoint was rate-limited by my own testing (self-inflicted,
expires in 15 min — expected).

| Test | Result |
|---|---|
| SQL injection on login (`OR 1=1`, `UNION`, time-based `pg_sleep`) | **Not vulnerable** — all return clean `401`; time-based returned instantly (parameterization confirmed live) |
| User enumeration via error differential | **Not vulnerable** — uniform `"Invalid email or password"` for all inputs |
| Login brute-force / rate limit (H1) | **Enforced** — `429` after ~10 attempts |
| Authz on protected endpoints (no token) | **Enforced** — `/api/superadmin/*`, `/api/campus/students`, `/api/users`, `/api/results`, `/api/billing/invoices` → `401` |
| `/api/billing/plans` unauth `200` | **Intentional** — public pricing catalog only; no tenant data. Not a finding |
| Error handling | Malformed JSON → `500` (should be `400`); responses seen were clean JSON, **no stack-trace leakage observed** |

### New finding
**H4 [Low] — Malformed JSON body returns 500 instead of 400.** The `express.json()`
parse error isn't handled, surfacing as `500 Internal Server Error`. Cosmetic/
correctness; no info leak observed. Add a JSON parse-error handler returning `400`.

### Authenticated pass — partial (2026-07-21, seed accounts only)

Only 4 seed accounts exist (super_admin, hr, cxo, engineer); **no student or
college accounts**, so cross-tenant IDOR could not be exercised. Vertical RBAC
was tested with the non-admin roles:

| Test | Result |
|---|---|
| hr / cxo / engineer → `/api/superadmin/*`, `/api/users`, `/api/audit-logs`, `/api/campus/students` | **all `403`** — no escalation |
| super_admin → same super_admin endpoints (control) | `200` — RBAC is role-discriminating, not blanket-blocking |
| cxo → `POST /api/users` (read-only guard) | `403` — write blocked |

Vertical RBAC verdict: **holds** for the roles testable. Cross-tenant IDOR
(T3/T4) remains **untested** — blocked on the absence of college/student data.

### Still requires AUTHENTICATED testing (needs student + college accounts)
Not yet tested — provide a valid access token for student / college_admin /
super_admin (from browser devtools after login) to run:
- **IDOR / cross-tenant** — college-A token reading college-B students/results.
- **RBAC bypass** — student token against `/api/superadmin/*`, `/api/campus/*`.
- **Business logic** — exam attempt/score tampering, readiness manipulation.
- **Mass assignment** — privilege fields via profile/update endpoints.

---

## OWASP mapping (first-pass posture)

| OWASP API/Top-10 | Posture from this pass |
|---|---|
| A01 Broken Access Control | Tenant scoping good where sampled; **IDOR sweep pending (DAST)**; open register (M1) |
| A02 Cryptographic Failures | **Critical** — secrets exposed (C1, C2) |
| A03 Injection | SQL parameterized (good); **stored XSS confirmed (H3)** |
| A04 Insecure Design | Upload validation gaps (M2) |
| A05 Misconfiguration | Rate limit off (H1), CSP unset (M3), weak defaults (H2) |
| A07 Auth Failures | Brute-force exposure (H1); token-forgery via secret exposure (C1) |
| A08 Integrity Failures | Upload MIME (M2); XSS (H3) |

Full OWASP ASVS verification requires the dynamic pass.

---

## Recommended order of remediation

1. **Rotate all exposed secrets** (C1, C2, H2) — before anything else ships.
2. **Deploy `DISABLE_RATE_LIMIT=false`** (H1).
3. **Fix / sanitize H3** and **decide M1** (register policy).
4. **Stand up a staging instance with seeded role accounts** so the dynamic pass (IDOR, business logic, headers) can actually run.
