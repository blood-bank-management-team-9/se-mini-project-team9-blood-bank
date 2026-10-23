# Blood Bank Management System: Backend

![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express-REST%20API-000000?logo=express)
![PostgreSQL](https://img.shields.io/badge/postgresql-17-4169E1?logo=postgresql&logoColor=white)
![Status](https://img.shields.io/badge/status-partial%20implementation-orange)

REST API for the **Blood Bank Management System (BBMS)**, Team 9.
Built with Node.js, Express and PostgreSQL. It implements the C3 API Layer, meaning the middleware chain, security controls, authentication and data-access primitives, as specified in SAD v1.0.

> **Scope of this README: backend only.** Frontend and team-level documentation live elsewhere in the repository.

> **Status: partial implementation.**
> Implemented: request tracing, sessions, RBAC, CSRF, validation, error handling, transactions, audit logging, registration, login (with lockout), logout, donor profile management and eligibility, admin user management, and audit retention.
> Not implemented: password reset, donation, stock, request and report modules (see [Section 11](#11-not-in-this-branch)).

---

## Contents

1. [Overview](#1-overview)
2. [Requirements traceability](#2-requirements-traceability)
3. [Prerequisites](#3-prerequisites)
4. [Setup](#4-setup)
5. [Running the server](#5-running-the-server)
6. [API reference](#6-api-reference)
7. [Verification](#7-verification)
8. [Automated tests](#8-automated-tests)
9. [Project structure](#9-project-structure)
10. [Middleware order](#10-middleware-order-do-not-reorder)
11. [Not in this branch](#11-not-in-this-branch)
12. [Known deviations](#12-known-deviations)
13. [Troubleshooting](#13-troubleshooting)
14. [Contributing](#14-contributing)
15. [References](#15-references)

---

## 1. Overview

### Architecture

```
Client
  |
  v
+----------------------- Express (C3 API Layer) -----------------------+
| requestId -> helmet -> cors -> json -> cookies -> morgan -> session  |
|                  -> CSRF                                             |
|                              |                                       |
|                              v                                       |
|                   routes -> validate -> requireRole -> handler       |
|                              |                                       |
|                notFound -> errorHandler (SAD 4.4 error shape)        |
+------------------------------|---------------------------------------+
                               v
                    withTransaction / audit repository
                               v
                         PostgreSQL 17
```

Background: `node-cron` runs the audit retention job daily at 02:00 (Section 6.4).

### Design principles

- **Deny by default.** Protected routes require an explicit `requireRole(...)`. Denials return `403` and write an audit row.
- **One error shape everywhere:** `{ "error": { "code", "message", "requestId" } }` (SAD 4.4).
- **Traceable.** Every response carries an `X-Request-Id`, and the same ID appears in error bodies.
- **Atomic writes.** Multi-step database changes go through `withTransaction(fn)`.
- **Parameterised SQL only.** No string-built queries.
- **Layered auth module.** Routes call the service, and the service calls the repository (SAD C4).

### Implemented in this branch

| Concern | Reference | File |
|---|---|---|
| Request ID on every response | SAD 4.4 | `src/middleware/requestId.js` |
| Sessions (15-min idle, HttpOnly, Secure in prod) | NFR-SEC-04 | `src/middleware/session.js` |
| RBAC (deny by default, 403 + audit row) | NFR-SEC-02 | `src/middleware/rbac.js` |
| Input validation (`VALIDATION_ERROR`) | NFR-SEC-05 | `src/middleware/validate.js` |
| CSRF protection (double-submit, `csrf-csrf@4`) | SAD 3.6 / C3 | `src/middleware/csrf.js` |
| Standard error shape | SAD 4.4 | `src/middleware/errorHandler.js` |
| Atomic transactions | NFR-QUAL-03 | `src/database/transaction.js` |
| Audit trail writer | NFR-SEC-02 / C12 | `src/modules/audit/audit.repository.js` |
| Audit retention (365 days) | NFR-SEC-06 / C12 | `src/modules/audit/audit.retention.js` |
| User registration (Donor, Hospital/Patient) | FR-AUTH-01, FR-AUTH-02, NFR-SEC-01 | `src/modules/auth/` |
| **Login by email + password, with lockout** | FR-AUTH-03, FR-AUTH-04 | `src/modules/auth/` |
| **Logout (session destroyed, cookie cleared)** | FR-AUTH-07 | `src/modules/auth/` |
| Login/logout audit events | NFR-SEC-06 | `src/modules/auth/auth.service.js` |
| Donor profile CRUD, validation, status changes and audit events | FR-DON-01, FR-DON-02, FR-DON-03, FR-DON-07 | `src/modules/donors/` |
| Config-driven eligibility evaluation with specific ineligibility reasons | FR-DON-04, FR-DON-05, BR-03 | `src/modules/donors/donorEligibility.js` |
| Admin user management (staff create, list, status, role) | FR-ADM-01 to FR-ADM-06 | `src/modules/admin/` |
| Audit log viewer (admin only) | FR-ADM-05 | `src/modules/admin/` |
| Demonstration and test-only routes | n/a | `src/modules/auth/auth.routes.js` |

---

## 2. Requirements traceability

| Requirement | Where it is satisfied | How to verify |
|---|---|---|
| FR-AUTH-01, FR-AUTH-02 | `POST /api/auth/register` | [Section 7.9](#79-registration-fr-auth-01-fr-auth-02-nfr-sec-01), `auth.register.test.js` |
| FR-AUTH-03, FR-AUTH-04 | `POST /api/auth/login` | `auth.login.test.js` |
| FR-AUTH-07 | `POST /api/auth/logout` | `auth.login.test.js` |
| FR-DON-01, FR-DON-02, FR-DON-03, FR-DON-07 | `/api/donors*` | `donors.test.js` (STP TC-22, TC-36) |
| FR-DON-04, FR-DON-05, BR-03 | `GET /api/donors/{id}/eligibility` | `donorEligibility.test.js`, `donors.test.js` (STP TC-23) |
| FR-ADM-01 to FR-ADM-06 | `/api/admin/users*` | `admin.test.js` |
| NFR-SEC-06 | Audit writes + 365-day retention | `auth.login.test.js`, `admin.test.js`, `audit.retention.test.js` |
| NFR-SEC-01 | Registration credential handling | [Section 7.9](#79-registration-fr-auth-01-fr-auth-02-nfr-sec-01) |
| NFR-SEC-02 | RBAC middleware + audit writer | [Section 7.5](#75-rbac-denial-as-donor-nfr-sec-02) and [Section 7.6](#76-confirm-the-audit-row-nfr-sec-02-logging-clause) |
| NFR-SEC-04 | Session middleware (15-min idle expiry) | [Section 7.3](#73-create-a-donor-session-nfr-sec-04), [Section 7.4](#74-authenticated-request-nfr-sec-04), `session.test.js` |
| NFR-SEC-05 | Validation middleware | `POST /api/auth/demo-validate`, `validate.test.js` |
| NFR-QUAL-03 | Transaction helper | `transaction.test.js` |
| SAD 4.4 | Error handler | Every error response in [Section 7](#7-verification) |

---

## 3. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | Verified with 24.15.0 |
| PostgreSQL | 17 | Verified on port **5433** (not the default 5432) |
| Shell | PowerShell 7+, Git Bash, or `curl.exe` | `curl.exe` ships with Windows 10/11 |

If your PostgreSQL uses a different port, change `DATABASE_URL` and `DB_PORT` in `backend/.env`.

---

## 4. Setup

### 4.1 Install dependencies

From the repository root:

```powershell
npm run install:all
# or backend only:
npm install --prefix backend
```

### 4.2 Configure environment

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env`. **Never commit this file.**

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | HTTP port (default `5000`) |
| `NODE_ENV` | no | `development`, `test` or `production` |
| `DATABASE_URL` | yes | `postgresql://postgres:<password>@localhost:5433/blood_bank` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | yes | Discrete DB settings (`DATABASE_URL` is preferred) |
| `SESSION_SECRET` | **yes in production** | Random 48-byte base64 |
| `CSRF_SECRET` | **yes in production** | Random 48-byte base64 |

Generate a secret:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

In development the code falls back to unsafe defaults. Set real values anyway so your environment matches production.

### 4.3 Create the database (once per machine)

```powershell
$psql = "D:\Postgres\bin\psql.exe"   # adjust to your install location
& $psql -h localhost -p 5433 -U postgres -d postgres -c "CREATE DATABASE blood_bank;"
```

### 4.4 Migrate and seed

```powershell
npm run db:migrate --prefix backend
npm run db:seed --prefix backend
```

| Seeded user | Role |
|---|---|
| `USR-DNR01` | Donor |
| `USR-HSP01` | Hospital/Patient |
| `USR-STF01` | Staff |
| `USR-ADM01` | Admin |

Seed password for all seeded users is `Test@1234` (per `seeds.sql`).

**Seeding is required for verification.** `__dev-session` and the admin user-management endpoints look up real users and return `404` or `400 NO_ACTIVE_USER` if none exist.

---

## 5. Running the server

| Command | Purpose |
|---|---|
| `npm run dev --prefix backend` | Start with auto-reload (nodemon) |
| `npm test --prefix backend` | Run the Jest suites |
| `npm run test:coverage --prefix backend` | Tests with coverage (not enforced in CI) |
| `npm run lint --prefix backend` | ESLint |
| `npm run db:migrate --prefix backend` | Apply `schema.sql` |
| `npm run db:seed --prefix backend` | Load `seeds.sql` |

Expected startup output:

```
[audit-retention] scheduled daily at 02:00
API listening on port 5000
```

The retention job is scheduled only when `NODE_ENV !== 'test'`.

---

## 6. API reference

Base URL: `http://localhost:5000`

### 6.1 Endpoints

Only these routes are mounted. Everything else is future work.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | none | Health check |
| `GET` | `/api/auth/csrf` | none | Issues a CSRF token (sets `bbms.csrf` cookie) |
| `GET` | `/api/auth/me` | session | Returns current session user |
| `GET` | `/api/auth/staff-only` | Staff | Demonstrates RBAC allow and 403 paths |
| `POST` | `/api/auth/demo-validate` | none | Demonstrates the `VALIDATION_ERROR` shape |
| `POST` | `/api/auth/__dev-session` | none, **test-only** | Creates a session for a seeded user by role |
| `POST` | `/api/auth/__dev-logout` | none, **test-only** | Destroys the current session |
| `POST` | `/api/auth/register` | none | Register as Donor or Hospital/Patient (FR-AUTH-01, FR-AUTH-02, NFR-SEC-01) |
| `POST` | `/api/auth/login` | none | Authenticate by email + password. Returns session cookie on success (FR-AUTH-03, FR-AUTH-04) |
| `POST` | `/api/auth/logout` | session | Ends the current session and clears the cookie (FR-AUTH-07) |
| `POST` | `/api/donors` | Staff, Admin | Register and validate a donor (FR-DON-01, FR-DON-02) |
| `GET` | `/api/donors?status=&bloodGroup=&q=` | Staff, Admin | List and filter donor profiles |
| `GET` | `/api/donors/{id}` | Staff, Admin | Read a donor profile |
| `GET` | `/api/donors/{id}/eligibility` | Staff, Admin | Evaluate eligibility using system configuration and return reason codes/messages (FR-DON-04, FR-DON-05, BR-03) |
| `PUT` | `/api/donors/{id}` | Staff, Admin | Update a donor profile (FR-DON-03) |
| `PATCH` | `/api/donors/{id}/status` | Staff, Admin | Deactivate or reactivate a donor (FR-DON-07) |
| `POST` | `/api/admin/users` | Admin | Create a Staff account (FR-ADM-01) |
| `GET` | `/api/admin/users?role=&status=&q=` | Admin | List and filter users (FR-ADM-02) |
| `PATCH` | `/api/admin/users/{id}/status` | Admin | Activate/deactivate user; blocks last-admin deactivation (FR-ADM-03, FR-ADM-06) |
| `PATCH` | `/api/admin/users/{id}/role` | Admin | Assign or change a user's role; blocks last-admin demotion (FR-ADM-04, FR-ADM-06) |
| `GET` | `/api/admin/audit-logs?limit=` | Admin | Read recent audit rows (FR-ADM-05) |

> **Security:** `__dev-session` and `__dev-logout` exist only when `NODE_ENV !== 'production'`.
> Real login and logout now exist, so these helpers should be removed once nothing depends on them.

The eligibility response includes `eligible`, `evaluatedAt`, `nextEligibleDate`, and `ineligibilityReasons` (each with a stable `code` and human-readable `message`). Rules are loaded from `system_config` on each check: minimum/maximum age, minimum weight, and the sex-based donation interval. Profile validation accepts otherwise valid ineligible records so that this endpoint can explain why they cannot donate.

### 6.2 Conventions

- **Format:** JSON request and response bodies (`Content-Type: application/json`).
- **CSRF:** every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) must send the `x-csrf-token` header. Get the token from `GET /api/auth/csrf` and reuse the same cookie jar.
- **Sessions:** cookie `bbms.sid`, 15-minute idle timeout.
- **Tracing:** every response includes `X-Request-Id`.

### 6.3 Error format (SAD 4.4)

```json
{
  "error": {
    "code": "ACCESS_DENIED",
    "message": "access denied",
    "requestId": "..."
  }
}
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body failed validation |
| 400 | `NO_ACTIVE_USER` | `__dev-session`: no active user for that role |
| 401 | `UNAUTHENTICATED` | No session |
| 401 | `INVALID_CREDENTIALS` | Unknown email or wrong password |
| 403 | `ACCESS_DENIED` | Authenticated but role not permitted (audited) |
| 403 | `ACCOUNT_INACTIVE` | Login: correct password but account inactive |
| 403 | `SELF_ACTION_DENIED` | Admin changing own status or role |
| 403 | `EBADCSRFTOKEN` | Missing or invalid CSRF token |
| 404 | `NOT_FOUND` | Unknown route or unknown user |
| 409 | `ACCOUNT_EXISTS` | Duplicate email/phone |
| 409 | `LAST_ADMIN` | Last active admin cannot be deactivated or demoted |
| 423 | `ACCOUNT_LOCKED` | Login lockout; `{minutesLeft}` in body |

### 6.4 Background jobs

| Job | Schedule | File | Purpose |
|---|---|---|---|
| Audit retention | Daily at 02:00 local time | `src/modules/audit/audit.retention.js` | Deletes `audit_log` rows older than 365 days (NFR-SEC-06) |

The scheduler is `node-cron`, started from `src/server.js` when `NODE_ENV !== 'test'`.

---

## 7. Verification

These steps prove each requirement on a live server. Run them in a **second** terminal while the server runs in the first.

- Use **`curl.exe`**, not `Invoke-WebRequest -WebSession`, which is unreliable on Windows PowerShell 5.1.
- Run each command on its own.
- Keep `cookies.txt` and `body.json` out of git (add them to `.gitignore`, or delete them in [Section 7.11](#711-clean-up)).

Login and logout are covered by `auth.login.test.js` (see [Section 8](#8-automated-tests)).

### 7.1 Health check

```powershell
curl.exe -s http://localhost:5000/api/health
```

Expected: `{"status":"ok","service":"blood-bank-api","timestamp":"..."}`

### 7.2 Fetch a CSRF token (creates a session)

```powershell
Remove-Item cookies.txt -ErrorAction SilentlyContinue
$token = (curl.exe -s -c cookies.txt http://localhost:5000/api/auth/csrf | ConvertFrom-Json).csrfToken
"Token length: $($token.Length)"
```

Expected: `Token length: 129`. `cookies.txt` now holds `bbms.sid` and `bbms.csrf`.

### 7.3 Create a Donor session (NFR-SEC-04)

```powershell
'{"role":"Donor"}' | Out-File -Encoding ascii -NoNewline body.json
curl.exe -s -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/__dev-session `
  -H "Content-Type: application/json" `
  -H "x-csrf-token: $token" `
  --data-binary "@body.json"
```

Expected: `{"ok":true,"user":{"userId":"USR-DNR01","role":"Donor","name":"John Doe (Donor)"}}`

### 7.4 Authenticated request (NFR-SEC-04)

```powershell
curl.exe -s -b cookies.txt http://localhost:5000/api/auth/me
```

Expected: `{"user":{"userId":"USR-DNR01","role":"Donor","name":"John Doe (Donor)"}}`

### 7.5 RBAC denial as Donor (NFR-SEC-02)

```powershell
curl.exe -s -o - -w "`nHTTP %{http_code}`n" -b cookies.txt http://localhost:5000/api/auth/staff-only
```

Expected:

```
{"error":{"code":"ACCESS_DENIED","message":"access denied","requestId":"..."}}
HTTP 403
```

### 7.6 Confirm the audit row (NFR-SEC-02, logging clause)

```powershell
& $psql -h localhost -p 5433 -U postgres -d blood_bank -c "SELECT user_id, action, entity_id, created_at FROM audit_log WHERE action = 'ACCESS_DENIED' ORDER BY created_at DESC LIMIT 3;"
```

Expected: at least one row like:

```
 user_id   |    action     |        entity_id         |         created_at
-----------+---------------+--------------------------+----------------------------
 USR-DNR01 | ACCESS_DENIED | GET /api/auth/staff-only | 2026-10-19 23:22:48+05:30
```

If no row appears, the audit foreign key failed. Check that `USR-DNR01` exists ([Section 4.4](#44-migrate-and-seed)).

### 7.7 RBAC allow path as Staff

```powershell
$token2 = (curl.exe -s -b cookies.txt -c cookies.txt http://localhost:5000/api/auth/csrf | ConvertFrom-Json).csrfToken
'{"role":"Staff"}' | Out-File -Encoding ascii -NoNewline body.json
curl.exe -s -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/__dev-session `
  -H "Content-Type: application/json" `
  -H "x-csrf-token: $token2" `
  --data-binary "@body.json"
curl.exe -s -b cookies.txt http://localhost:5000/api/auth/staff-only
```

Expected: both calls return `{"ok":true,"user":{"userId":"USR-STF01",...}}`.

### 7.8 Validation error shape (NFR-SEC-05)

```powershell
'{}' | Out-File -Encoding ascii -NoNewline body.json
curl.exe -s -o - -w "`nHTTP %{http_code}`n" -b cookies.txt -X POST http://localhost:5000/api/auth/demo-validate `
  -H "Content-Type: application/json" `
  -H "x-csrf-token: $token2" `
  --data-binary "@body.json"
```

Expected: HTTP 400 with `error.code` equal to `VALIDATION_ERROR`.

### 7.9 Registration (FR-AUTH-01, FR-AUTH-02, NFR-SEC-01)

Register a new Donor, then confirm the password is stored as a bcrypt hash and not as plaintext.

```powershell
$token3 = (curl.exe -s -b cookies.txt -c cookies.txt http://localhost:5000/api/auth/csrf | ConvertFrom-Json).csrfToken
'{"name":"Test User","email":"test1@test.local","phone":"9876500001","password":"ValidPass123","role":"Donor"}' | Out-File -Encoding ascii -NoNewline body.json
curl.exe -s -o - -w "`nHTTP %{http_code}`n" -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/register `
  -H "Content-Type: application/json" `
  -H "x-csrf-token: $token3" `
  --data-binary "@body.json"
```

Expected:

```
{"userId":"USR-DNR02","role":"Donor","message":"Account created successfully"}
HTTP 201
```

The response does not echo the password. Now confirm the stored hash:

```powershell
& $psql -h localhost -p 5433 -U postgres -d blood_bank -c "SELECT user_id, LEFT(password_hash, 7) AS hash_prefix FROM users WHERE email = 'test1@test.local';"
```

Expected:

```
 user_id   | hash_prefix
-----------+-------------
 USR-DNR02 | $2b$10$
```

The `$2b$10$` prefix shows a bcrypt hash at 10 rounds, not plaintext (NFR-SEC-01).
Repeat with `"role":"Hospital/Patient"` and a new email and phone to cover FR-AUTH-02.
Registering the same email again will fail, so use a fresh email each run or reseed the database.

### 7.10 Admin user management (FR-ADM-01 to FR-ADM-06)

Log in as the seeded admin, then create a Staff account and list users.

```powershell
$tokenA = (curl.exe -s -c admin-cookies.txt http://localhost:5000/api/auth/csrf | ConvertFrom-Json).csrfToken
'{"email":"admin@bloodbank.org","password":"Test@1234"}' | Out-File -Encoding ascii -NoNewline body.json
curl.exe -s -b admin-cookies.txt -c admin-cookies.txt -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -H "x-csrf-token: $tokenA" `
  --data-binary "@body.json"
```

Expected: `{"userId":"USR-ADM01","name":"System Administrator","role":"Admin"}`

Then create a Staff:

```powershell
$tokenB = (curl.exe -s -b admin-cookies.txt -c admin-cookies.txt http://localhost:5000/api/auth/csrf | ConvertFrom-Json).csrfToken
'{"name":"Test Staff","email":"staff.test@test.local","phone":"9876500099","temporaryPassword":"TempPass123"}' | Out-File -Encoding ascii -NoNewline body.json
curl.exe -s -b admin-cookies.txt -c admin-cookies.txt -X POST http://localhost:5000/api/admin/users `
  -H "Content-Type: application/json" `
  -H "x-csrf-token: $tokenB" `
  --data-binary "@body.json"
```

Expected: `201 {"userId":"USR-STF02","name":"Test Staff","role":"Staff","status":"Active"}`

List users:

```powershell
curl.exe -s -b admin-cookies.txt "http://localhost:5000/api/admin/users?role=Staff"
```

Expected: `{"users":[{...}],"total":N}` with only Staff rows.

### 7.11 Clean up

```powershell
Remove-Item cookies.txt, admin-cookies.txt, body.json -ErrorAction SilentlyContinue
```

---

## 8. Automated tests

```powershell
npm test --prefix backend
npm run lint --prefix backend
```

| Suite | Covers |
|---|---|
| `health.test.js` | Health route and `NOT_FOUND` shape |
| `rbac.test.js` | Role allow/deny logic |
| `validate.test.js` | `VALIDATION_ERROR` shape |
| `session.test.js` | Session behaviour and idle expiry |
| `database.test.js` | Pool and connectivity |
| `transaction.test.js` | Commit and rollback (**needs a live PostgreSQL**) |
| `auth.register.test.js` | Registration (**needs a live PostgreSQL**) |
| `auth.login.test.js` | Login, lockout and logout (**needs a live PostgreSQL**) |
| `admin.test.js` | Admin user management and audit (**needs a live PostgreSQL**) |
| `audit.retention.test.js` | Audit log retention deletes rows older than 365 days (NFR-SEC-06, **needs a live PostgreSQL**) |

All suites should pass and lint should print nothing (0 errors, 0 warnings).
Suites that need a database skip automatically when `DATABASE_URL` is not set.
Current state at the time of writing: **14 suites, 88 tests**.

---

## 9. Project structure

```
backend/
+-- package.json
+-- .env.example                  # SESSION_SECRET / CSRF_SECRET placeholders
+-- src/
    +-- app.js                    # middleware chain (see Section 10)
    +-- server.js                 # HTTP listener + audit retention cron
    +-- config.js
    +-- routes.js                 # mounts /health, /auth and /admin
    +-- middleware/
    |   +-- requestId.js          # req.id + X-Request-Id
    |   +-- session.js            # express-session + connect-pg-simple
    |   +-- rbac.js               # requireRole(...): deny by default, 403 + audit
    |   +-- validate.js           # express-validator runner -> VALIDATION_ERROR
    |   +-- csrf.js               # csrf-csrf@4 double-submit config
    |   +-- errorHandler.js       # notFound + errorHandler (SAD 4.4 shape)
    |   +-- *.test.js             # rbac, validate, session
    +-- database/
    |   +-- db.js                 # pg Pool (DATABASE_URL preferred)
    |   +-- transaction.js        # withTransaction(fn): BEGIN/COMMIT/ROLLBACK
    |   +-- schema.sql, seeds.sql
    |   +-- migrate.js, seed.js, reset.js
    |   +-- *.test.js             # database, transaction
    +-- modules/
        +-- audit/
        |   +-- audit.repository.js       # parameterised INSERT into audit_log
        |   +-- audit.retention.js        # daily 365-day retention job
        |   +-- audit.retention.test.js
        +-- auth/
        |   +-- auth.routes.js        # register, login, logout, demo and test-only routes
        |   +-- auth.service.js       # password policy, hashing, login and lockout logic
        |   +-- auth.repository.js    # data access
        |   +-- auth.*.test.js        # register, login
        +-- admin/
        |   +-- admin.routes.js       # /api/admin/users* and audit-logs
        |   +-- admin.service.js      # user management + last-admin protection
        |   +-- admin.repository.js   # data access
        |   +-- admin.test.js
        +-- health/               # health.routes.js, health.test.js
```

---

## 10. Middleware order (do not reorder)

Defined in `src/app.js`. The order is required by the SAD and by library contracts.

| # | Middleware | Why it must be here |
|---|---|---|
| 1 | `requestId` | Sets `req.id`; everything else may log it |
| 2 | `helmet` | Security headers |
| 3 | `cors` | Cross-origin policy |
| 4 | `express.json` | Body parsing |
| 5 | `cookie-parser` | Populates `req.cookies`; required by `csrf-csrf` |
| 6 | `morgan` (non-test) | Request logging |
| 7 | `sessionMiddleware` | Populates `req.session`; required by CSRF and RBAC |
| 8 | `doubleCsrfProtection` (non-test) | Needs cookies and session |
| 9 | `/api` routes | |
| 10 | `notFound` | |
| 11 | `errorHandler` | Must be last; 4-argument signature |

Two reorderings fail silently:

- `cookie-parser` after CSRF causes `TypeError: Cannot read properties of undefined (reading 'bbms.csrf')`.
- `sessionMiddleware` after CSRF means `getSessionIdentifier` has no session to read.

---

## 11. Not in this branch

Owned by other stories. Do not assume they exist.

- Password reset (FR-AUTH-05)
- Donation recording and unit creation
- Stock management and the expiry job
- Blood request approval with FEFO
- Reports (CSV / PDF export)
- Production CSRF token issuance from a UI route

---

## 12. Known deviations

1. **`health.test.js` was updated** to expect `res.body.error.code === 'NOT_FOUND'` instead of `res.body.error === 'Not found'`, as SAD 4.4 requires.
2. **`session.test.js` does not assert HttpOnly/Secure flags.** `express-session` does not expose its cookie config publicly. The flags are set in code and checked by inspection only.
3. **CSRF is bypassed when `NODE_ENV=test`** to keep Jest/Supertest deterministic. The production path is active.
4. **`csrf-csrf@4` requires `getSessionIdentifier`.** It returns a random `csrfId` stored in `req.session`, created lazily on first use. It does not use `req.sessionID`, which `express-session` leaves unset when `saveUninitialized: false` and no session exists yet.
5. **`__dev-session` uses a real seeded user.** `audit_log.user_id` is a foreign key to `users.user_id`, so a fabricated ID would make `ACCESS_DENIED` inserts fail silently and violate NFR-SEC-02's logging clause.
6. **`__dev-session` and `__dev-logout` are test-only** (guarded by `NODE_ENV !== 'production'`). Real login and logout now exist, so these helpers should be removed once no test or workflow depends on them.
7. **Database-backed suites need a live PostgreSQL** (`transaction`, `auth.register`, `auth.login`, `admin`, `audit.retention`). They clean up after themselves and skip when `DATABASE_URL` is unset, so CI without a database does not fail.
8. **`SESSION_SECRET` and `CSRF_SECRET` are mandatory in production.** Placeholders are in `backend/.env.example`.
9. **Audit retention (NFR-SEC-06).** The retention job runs daily at 02:00 local time and deletes `audit_log` rows older than 365 days (`src/modules/audit/audit.retention.js`). The 365-day period is hard-coded to match the SRS text ("keep these logs for 1 year"). Making it configurable via `system_config` is a future enhancement, not a current requirement.

---

## 13. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `EADDRINUSE: address already in use :::5000` | A previous `nodemon` is still running. Find it with `Get-NetTCPConnection -LocalPort 5000 -State Listen \| Select-Object -ExpandProperty OwningProcess`, stop it with `Stop-Process -Id <pid> -Force`, then restart. |
| `Cannot read properties of undefined (reading 'bbms.csrf')` | `cookie-parser` is missing or mounted after CSRF. See [Section 10](#10-middleware-order-do-not-reorder). |
| `EBADCSRFTOKEN` on POST | Missing `x-csrf-token` header, or the token came from a different cookie jar. CSRF is bypassed under `NODE_ENV=test` but active in `development`. |
| `400 NO_ACTIVE_USER` from `__dev-session` | No active user for that role. Run `npm run db:seed --prefix backend`. |
| Login keeps failing for a known account | The account may be locked after repeated failed attempts. See the lockout logic in `src/modules/auth/auth.service.js`. |
| `audit_log violates foreign key constraint` | The audit writer got a `user_id` that does not exist, usually from a session built with a fabricated ID. Use a seeded user. |
| `LAST_ADMIN` on admin deactivation | You tried to deactivate the last active admin. Protected by FR-ADM-06. |
| `connect ECONNREFUSED ::1:5432` | Migrate/seed loaded the wrong `.env`. Run from `backend/` or use `--prefix backend`. |
| `password authentication failed` | `DB_PASSWORD` or `DATABASE_URL` in `backend/.env` is wrong. |

---

## 14. Contributing

1. Branch from `main`, using a short descriptive name (for example `feature/auth-login`).
2. Do not overwrite teammates' files, including the root `README.md`. Add to them and ask before replacing.
3. Keep SQL parameterised and wrap multi-step writes in `withTransaction`.
4. Return errors in the SAD 4.4 shape. Never send raw exceptions to the client.
5. Add or update tests for every behaviour change, and run `npm test` and `npm run lint` before pushing.
6. Never commit `.env`, `cookies.txt` or credentials.
7. In the PR description, list the requirement IDs addressed and any deviations from the SAD.
8. Keep the endpoints table in [Section 6.1](#61-endpoints) in sync with every mounted route.

---

## 15. References

- SRS v1.1: `docs/SRS_bbms.docx.pdf` (Sections 5, 6)
- SAD v1.0: `docs/sad_bbms_09.pdf` (Sections 3.6, 3.9, 4.3, 4.4, ADR-04)
- STP v1.0: `docs/test_plan_bbms.pdf` (Sections 5.1, 13.1, 13.2)
- Digital Personal Data Protection Act, 2023 (India)
- `csrf-csrf` v4 and `express-session` documentation
- `node-cron` documentation