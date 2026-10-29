# Blood Bank Management System (BBMS): Team 9

![Status](https://img.shields.io/badge/status-work%20in%20progress-orange)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/postgresql-17-4169E1?logo=postgresql&logoColor=white)

A web application for managing blood donors, donations, blood stock and blood requests.
Software Engineering (UE24CS341A) mini-project, Section C, PES University, Bangalore.

> **Status: work in progress.**
> The middleware layer, registration, login, logout, donor profile management and eligibility, admin user management and audit retention are implemented.
> Password reset, donation, stock, request and report modules are being built on their own branches.
> See [Project status](#project-status).

---

## Contents

1. [Overview](#overview)
2. [Project status](#project-status)
3. [Tech stack](#tech-stack)
4. [Repository structure](#repository-structure)
5. [Prerequisites](#prerequisites)
6. [Quick start: first-time setup](#quick-start-first-time-setup)
7. [Common commands](#common-commands)
8. [API endpoints](#api-endpoints)
9. [Testing](#testing)
10. [Development workflow](#development-workflow)
11. [Troubleshooting](#troubleshooting)
12. [Documentation](#documentation)
13. [Team](#team)

---

## Overview

BBMS supports four user roles:

| Role | Purpose |
|---|---|
| Donor | Register, view eligibility and donation history |
| Hospital/Patient | Register and request blood |
| Staff | Record donations, manage stock, handle requests |
| Admin | Manage accounts and view reports |

Requirements are traced to the SRS, SAD and Test Plan (see [Documentation](#documentation)).

---

## Project status

### Implemented and verified

| Area | Requirement | Issue / branch |
|---|---|---|
| Request ID on every response | SAD 4.4 | #4 `feature/nfr-sec-mw` |
| Sessions (15-min idle, HttpOnly, Secure) | NFR-SEC-04 | #4 |
| RBAC (deny by default, 403 + audit) | NFR-SEC-02 | #4 |
| Input validation | NFR-SEC-05 | #4 |
| CSRF double-submit (`csrf-csrf@4`) | SAD 3.6 | #4 |
| Standard error shape | SAD 4.4 | #4 |
| Atomic transactions | NFR-QUAL-03 | #4 |
| Audit trail writer | NFR-SEC-02 | #4 |
| Registration (`POST /api/auth/register`) | FR-AUTH-01, FR-AUTH-02, SAD 4.3 | #5 `feature/auth-register` |
| Password policy + bcrypt hashing | NFR-SEC-01 | #5 |
| Auth data-access layer | SAD C4 | #5 |
| Login by email + password, with lockout (`POST /api/auth/login`) | FR-AUTH-03, FR-AUTH-04 | #6 `feature/auth-login` |
| Logout (`POST /api/auth/logout`) | FR-AUTH-07 | #6 |
| Session expiry tests | NFR-SEC-04 | #6 |
| Admin user management: create Staff, list/filter, activate/deactivate, change role, last-admin protection | FR-ADM-01 to FR-ADM-06 | #7 `feature/admin-users` |
| Audit log viewer (admin only) | FR-ADM-05 | #7 |
| Audit retention job (365 days, daily at 02:00) | NFR-SEC-06 | #8 `feature/audit-retention` |
| Donor profile management | FR-DON-01 to FR-DON-03, FR-DON-07 | #9 |
| Donor eligibility engine with config-driven ineligibility reasons | FR-DON-04, FR-DON-05, BR-03 | #10 |
| Stock summary by group/status, expiry date, low-stock and expiring-soon alerts | FR-STK-01, FR-STK-02, FR-STK-04, FR-STK-05 | #12 |
| Discard unit with mandatory reason, non-negative stock guard | FR-STK-06, FR-STK-07 | #13 |

Key files live under `backend/src/middleware/`, `backend/src/database/transaction.js`, `backend/src/modules/audit/`, `backend/src/modules/auth/` and `backend/src/modules/admin/`.

### Not yet implemented

Owned by other stories. Do not assume they exist.

| Module | Requirements |
|---|---|
| Password reset | FR-AUTH-05 |
| Donor donation history and donation workflows | Remaining FR-DON requirements; FR-DNR-01 to FR-DNR-06 |
| Blood donation recording | FR-DNR-01 to FR-DNR-06 |
| Midnight auto-expiry job | FR-STK-03 |
| Blood request handling with FEFO | FR-REQ-01 to FR-REQ-08 |
| Reports | FR-RPT-01 to FR-RPT-06 |
| UI beyond the health-check page | n/a |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Node.js 20+ with Express 4 |
| Database | PostgreSQL 17 (dev uses port **5433**, not the default 5432) |
| Security | express-session, `csrf-csrf@4`, helmet, bcrypt |
| Background jobs | node-cron (audit retention) |
| Tests | Jest + Supertest, ESLint |

---

## Repository structure

```
se-mini-project-team9-blood-bank/
+-- backend/                  Express API
|   +-- src/
|   |   +-- app.js            middleware chain
|   |   +-- server.js         HTTP listener
|   |   +-- routes.js         route mounting
|   |   +-- middleware/       requestId, session, rbac, validate, csrf, errorHandler
|   |   +-- database/         pool, transaction helper, schema, seeds, migrate/seed/reset
|   |   +-- modules/          audit, auth, admin, health
|   +-- README.md             backend setup, verification, deviations
+-- frontend/                 React (Vite) client
+-- docs/                     SRS, SAD, Test Plan
+-- README.md                 this file
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 or later | Verified with 24.15.0 |
| npm | bundled with Node | |
| PostgreSQL | 17 | Verified with `postgresql-x64-17` on port **5433** |
| Git | any recent version | |

If your PostgreSQL runs on a different port, set it in `backend/.env` (step 4 below).

---

## Quick start: first-time setup

Run everything from the repository root.

### 1. Clone

```powershell
git clone https://github.com/blood-bank-management-team-9/se-mini-project-team9-blood-bank.git
cd se-mini-project-team9-blood-bank
git checkout main
```

### 2. Install dependencies

```powershell
npm run install:all
```

This installs the root, `backend/` and `frontend/` dependencies.

### 3. Confirm PostgreSQL is running

```powershell
Get-Service postgresql-x64-17
Test-NetConnection localhost -Port 5433
```

Expected: `Status : Running` and `TcpTestSucceeded : True`.
If the service is stopped, run `Start-Service postgresql-x64-17`.
If your PostgreSQL uses the default port 5432, use `5432` in the steps below.

### 4. Configure `backend/.env`

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` with at least:

```dotenv
PORT=5000
NODE_ENV=development

DATABASE_URL=postgresql://postgres:<your-password>@localhost:5433/blood_bank
DB_HOST=localhost
DB_PORT=5433
DB_NAME=blood_bank
DB_USER=postgres
DB_PASSWORD=<your-password>

SESSION_SECRET=<random 48-byte base64>
CSRF_SECRET=<random 48-byte base64>
```

Generate each secret (run twice, one output per secret):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Never commit `backend/.env`** (it is gitignored) and never paste secrets into chat or PRs.

### 5. Create the database (once per machine)

```powershell
$psql = "D:\Postgres\bin\psql.exe"   # adjust to your install location
& $psql -h localhost -p 5433 -U postgres -d postgres -c "CREATE DATABASE blood_bank;"
```

Skip this if the database already exists.

### 6. Run migrations and seeds

```powershell
npm run db:migrate --prefix backend
npm run db:seed --prefix backend
```

The seed creates one user per role:

| User ID | Role |
|---|---|
| `USR-DNR01` | Donor |
| `USR-HSP01` | Hospital/Patient |
| `USR-STF01` | Staff |
| `USR-ADM01` | Admin |

Seed password for all seeded users is `Test@1234` (per `seeds.sql`).

Seeding is required for authentication flows, admin endpoints and the test suites that use a live database.

### 7. Start the apps

```powershell
npm run dev                      # API and UI together
npm run dev --prefix backend     # API only
```

- API: `http://localhost:5000`
- UI: `http://localhost:5173`

Expected backend output: `API listening on port 5000`

### 8. Verify the backend

In a second terminal:

```powershell
curl.exe -s http://localhost:5000/api/health
```

Expected: `{"status":"ok","service":"blood-bank-api","timestamp":"..."}`

For the full verification sequence (sessions, RBAC, audit rows, registration), see [`backend/README.md`](backend/README.md).

---

## Common commands

From the repository root:

| Command | What it does |
|---|---|
| `npm run install:all` | Install root, backend and frontend dependencies |
| `npm run dev` | Start backend and frontend together |
| `npm run dev --prefix backend` | Start only the backend |
| `npm test` | Run backend Jest + Supertest suites |
| `npm run lint` | Run backend ESLint |
| `npm run db:migrate --prefix backend` | Apply `schema.sql` |
| `npm run db:seed --prefix backend` | Load seed data |
| `npm --prefix frontend run build` | Produce the production frontend build |

> **Warning:** do not run `npm run db:reset --prefix backend` on a database whose data you care about.
> It drops the project tables and re-runs migrations.

---

## API endpoints

Base URL: `http://localhost:5000`. Details and conventions are in [`backend/README.md`](backend/README.md).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | none | Health check |
| `GET` | `/api/auth/csrf` | none | Issues a CSRF token (sets `bbms.csrf` cookie) |
| `GET` | `/api/auth/me` | session | Returns current session user |
| `GET` | `/api/auth/staff-only` | Staff | Demonstrates RBAC allow and 403 paths |
| `POST` | `/api/auth/demo-validate` | none | Demonstrates `VALIDATION_ERROR` shape |
| `POST` | `/api/auth/__dev-session` | none, **test-only** | Creates a session for a seeded user |
| `POST` | `/api/auth/__dev-logout` | none, **test-only** | Destroys the current session |
| `POST` | `/api/auth/register` | none | Register as Donor or Hospital/Patient (FR-AUTH-01, FR-AUTH-02, NFR-SEC-01) |
| `POST` | `/api/auth/login` | none | Authenticate by email + password. Returns session cookie on success (FR-AUTH-03, FR-AUTH-04) |
| `POST` | `/api/auth/logout` | session | Ends the current session and clears the cookie (FR-AUTH-07) |
| `GET` | `/api/stock/summary` | Staff, Admin | Counts per group x status, low-stock and expiring-soon alerts (FR-STK-01, 04, 05) |
| `GET` | `/api/stock/units?bloodGroup=&status=` | Staff, Admin | Units, earliest expiry first, with `expiringSoon` tag (FR-STK-01, 02, 05) |
| `PATCH` | `/api/stock/units/:unitId/discard` | Staff, Admin | Discard with mandatory reason (Expired, Hemolyzed, Contaminated, Leakage, Test Positive); audited (FR-STK-06, 07) |
| `POST` | `/api/donors` | Staff, Admin | Register and validate a donor (FR-DON-01, FR-DON-02) |
| `GET` | `/api/donors?status=&bloodGroup=&q=` | Staff, Admin | List and filter donor profiles |
| `GET` | `/api/donors/{id}` | Staff, Admin | Read a donor profile |
| `GET` | `/api/donors/{id}/eligibility` | Staff, Admin | Evaluate donor eligibility and return ineligibility reasons (FR-DON-04, FR-DON-05, BR-03) |
| `PUT` | `/api/donors/{id}` | Staff, Admin | Update a donor profile (FR-DON-03) |
| `PATCH` | `/api/donors/{id}/status` | Staff, Admin | Deactivate or reactivate a donor (FR-DON-07) |
| `POST` | `/api/admin/users` | Admin | Create a Staff account (FR-ADM-01) |
| `GET` | `/api/admin/users?role=&status=&q=` | Admin | List and filter users (FR-ADM-02) |
| `PATCH` | `/api/admin/users/{id}/status` | Admin | Activate/deactivate user; blocks last-admin deactivation (FR-ADM-03, FR-ADM-06) |
| `PATCH` | `/api/admin/users/{id}/role` | Admin | Assign or change a user's role; blocks last-admin demotion (FR-ADM-04, FR-ADM-06) |
| `GET` | `/api/admin/audit-logs?limit=` | Admin | Read recent audit rows (FR-ADM-05) |

- The `__dev-*` routes exist only when `NODE_ENV !== 'production'`. They are test helpers and should be removed once nothing depends on them.
- All errors use one shape: `{ "error": { "code", "message", "requestId" } }` (SAD 4.4).
- State-changing requests need an `x-csrf-token` header obtained from `GET /api/auth/csrf`.

---

## Testing

```powershell
npm run lint                         # ESLint (backend)
npm test                             # Jest + Supertest (backend)
npm --prefix frontend run build      # frontend build check
```

Run `npm test` and record the current suite and test totals in your PR description. Do not copy old numbers into this file.

Suites that need a live PostgreSQL use `describeIfDatabase` and **skip automatically** when `DATABASE_URL` is not set, so CI without a database does not fail:

- `backend/src/database/transaction.test.js` (NFR-QUAL-03)
- `backend/src/modules/auth/auth.register.test.js` (FR-AUTH-01, FR-AUTH-02)
- `backend/src/modules/auth/auth.login.test.js` (FR-AUTH-03, FR-AUTH-04, FR-AUTH-07)
- `backend/src/modules/admin/admin.test.js` (FR-ADM-01 to FR-ADM-06)
- `backend/src/modules/audit/audit.retention.test.js` (NFR-SEC-06)

---

## Development workflow

1. Branch from `main` (or from the active feature branch if your work depends on unmerged middleware).
2. Implement against the SRS, SAD and STP. Note any deviations in the PR description.
3. Run `npm run lint` and `npm test` before pushing.
4. Open a PR against `main` with:
   - `Closes #N`
   - the requirements, SAD reference and STP test cases it covers
   - explicit deviations the reviewer must acknowledge
5. Merge after CI is green and a reviewer approves.

Keep PRs focused. A documentation rewrite goes in its own `docs/` branch, not inside a feature PR.
Never commit `backend/.env`, `cookies.txt` or `body.json`.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `EADDRINUSE: address already in use :::5000` | A previous `nodemon` is still running. Run `Get-NetTCPConnection -LocalPort 5000 -State Listen \| Select-Object -ExpandProperty OwningProcess`, then `Stop-Process -Id <pid> -Force`. |
| `connect ECONNREFUSED ::1:5432` | Wrong port. The dev DB is on **5433**. Check `DATABASE_URL` and `DB_PORT` in `backend/.env`. |
| `connect ECONNREFUSED` on `npm test` | `backend/.env` is missing or `DATABASE_URL` is unset. See step 4. |
| `EBADCSRFTOKEN` from `curl` | Call `GET /api/auth/csrf` first, keep the cookie jar, and send `x-csrf-token` on the POST. CSRF is bypassed only under `NODE_ENV=test`. |
| `400 NO_ACTIVE_USER` from `__dev-session` | Seeds not loaded. Run `npm run db:seed --prefix backend`. |
| Login keeps failing for a known account | The account may be locked after repeated failed attempts. See `backend/README.md`. |
| `LAST_ADMIN` on admin deactivation | You tried to deactivate or demote the last active admin. Protected by FR-ADM-06. |
| `audit_log violates foreign key constraint` | The session user's ID does not exist in `users`. Use a seeded user. |
| `password authentication failed` | `DB_PASSWORD` or `DATABASE_URL` in `backend/.env` is wrong. |

---

## Documentation

| Document | Location |
|---|---|
| Requirements Traceability Matrix (RTM) | [`docs/RTM.md`](docs/RTM.md) |
| Architecture Deviations Register | [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) |
| Production Nginx TLS Config | [`docs/nginx/bbms.conf`](docs/nginx/bbms.conf) |
| SRS v1.1 | [`docs/SRS_bbms.pdf`](docs/SRS_bbms.pdf) |
| SAD v1.0 | [`docs/sad_bbms_09.pdf`](docs/sad_bbms_09.pdf) |
| STP v1.0 | [`docs/BBMS_Software_Test_Plan_v1.0.pdf`](docs/BBMS_Software_Test_Plan_v1.0.pdf) |
| Backend setup, verification and deviations | [`backend/README.md`](backend/README.md) |

---

## Team

| Role | Name | SRN |
|---|---|---|
| Product Owner | Harsimran Kaur | PES1UG24CS187 |
| QA Lead | Dheepak Seetharam | PES1UG24CS152 |
| Test Engineer | Chukkapalli Rohan | PES1UG24CS135 |
| Developer | Gautam Prasanth Nair | PES1UG24CS169 |

PES University, Bangalore. Software Engineering (UE24CS341A), Section C, Team 9.
