# Blood Bank Management System (BBMS): Team 9

![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/postgresql-17-4169E1?logo=postgresql&logoColor=white)

A web application for managing blood donors, donations, blood stock and blood requests.
Software Engineering (UE24CS341A) mini-project, Section C, PES University, Bangalore.

> **Status: end-to-end prototype complete.**
> The backend (38 suites, 302 tests) and frontend are fully wired. All four user roles have working workflows. Password reset, donations (including failed screening), stock management, requests (FEFO), and reports are implemented and verified.

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
| Donor | Register, view real eligibility status, and view donation history |
| Hospital/Patient | Register, search stock, and submit/track blood requests |
| Staff | Register donors, record donations, manage stock, and process requests |
| Admin | Manage accounts, view audit logs, and access reports |

Requirements are traced to the SRS, SAD and Test Plan (see [Documentation](#documentation)).

---

## Project status

### Implemented and verified

| Area | Requirement | Issue / branch |
|---|---|---|
| Request ID on every response | SAD 4.4 | #4 |
| Sessions (15-min idle, HttpOnly, Secure) | NFR-SEC-04 | #4 |
| RBAC (deny by default, 403 + audit) | NFR-SEC-02 | #4 |
| Input validation | NFR-SEC-05 | #4 |
| CSRF double-submit (`csrf-csrf@4`) | SAD 3.6 | #4 |
| Standard error shape | SAD 4.4 | #4 |
| Atomic transactions | NFR-QUAL-03 | #4 |
| Audit trail writer | NFR-SEC-02 | #4 |
| Registration (`POST /api/auth/register`) | FR-AUTH-01, FR-AUTH-02, NFR-SEC-01 | #5 |
| Login by email + password, with lockout (`POST /api/auth/login`) | FR-AUTH-03, FR-AUTH-04 | #6 |
| Logout (`POST /api/auth/logout`) | FR-AUTH-07 | #6 |
| Password reset (one-time, 15-min token) | FR-AUTH-05 | #14 |
| Own profile (view/update name, phone, address) | FR-AUTH-06 | #14 |
| Admin user management: create Staff, list/filter, activate/deactivate, change role, last-admin protection | FR-ADM-01 to FR-ADM-06 | #7 |
| Audit log viewer (admin only) | FR-ADM-05 | #7 |
| Audit retention job (365 days, daily at 02:00) | NFR-SEC-06 | #8 |
| Donor profile management | FR-DON-01 to FR-DON-03, FR-DON-07 | #9 |
| Donor eligibility engine with config-driven ineligibility reasons | FR-DON-04, FR-DON-05, BR-03 | #10 |
| Donor account linking and own donation history | FR-DON-06, FR-DON-08 | #15 |
| Blood donation recording (Passed / Failed screening), unit creation, last-donation update | FR-DNR-01 to FR-DNR-05 | #17 |
| Donation correction within 24 hours with audit trail | FR-DNR-06 | #19 |
| Stock summary by group/status, expiry date, low-stock and expiring-soon alerts | FR-STK-01, FR-STK-02, FR-STK-04, FR-STK-05 | #12 |
| Discard unit with mandatory reason, non-negative stock guard | FR-STK-06, FR-STK-07 | #13 |
| Search blood stock and eligible donors | FR-SRCH-01 to FR-SRCH-06 | #16 |
| Blood request handling (submit, pending queue, approve with FEFO, reject, issue, cancel) | FR-REQ-01 to FR-REQ-08 | #17 |
| Reports (stock, donation, request) with CSV/PDF export | FR-RPT-01 to FR-RPT-06 | #18 |
| Frontend wired to backend (all 4 roles, real API calls, CSRF, session) | SAD 4.5 | #11 |
| NFR hardening (performance indexes, TLS config, log redaction, health monitoring) | NFR-SEC-03, NFR-SEC-07, NFR-PERF | #24 |

### Deviations & known limitations

- **Password reset email is deferred.** The reset token is returned in the response body in dev mode (SMTP integration is a follow-up).
- **Donor dashboard eligibility:** the backend computes eligibility and returns it in `/api/donors/me/donations`. The frontend does not duplicate the logic.
- **Screening status:** kept in the donation form (FR-DNR-04). A "Failed" screening correctly prevents blood unit creation.
- **Registration form:** asks for User account details (email, phone, password), not donor health metrics (weight, DOB). Health metrics are captured by Staff during donor registration.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Node.js 20+ with Express 4 |
| Database | PostgreSQL 17 (dev uses port **5433**) |
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
|   |   +-- modules/          audit, auth, admin, donors, donations, stock, search, requests, reports, health
|   +-- README.md             backend setup, verification, deviations
+-- frontend/                 React (Vite) client
|   +-- src/
|   |   +-- services/api.js   Centralized fetch with CSRF + credentials
|   |   +-- context/          AuthContext (real login/logout, 15-min idle timer)
|   |   +-- pages/            Login, Register, Dashboards, Forms, Requests, Stock, Reports
+-- docs/                     SRS, SAD, Test Plan, RTM, Deviations
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

If your PostgreSQL runs on a different port, set it in `backend/.env`.

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

### 3. Confirm PostgreSQL is running

```powershell
Get-Service postgresql-x64-17
Test-NetConnection localhost -Port 5433
```

Expected: `Status : Running` and `TcpTestSucceeded : True`.

### 4. Configure `backend/.env`

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env`:

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

### 5. Create the database (once)

```powershell
$psql = "D:\Postgres\bin\psql.exe"
& $psql -h localhost -p 5433 -U postgres -d postgres -c "CREATE DATABASE blood_bank;"
```

### 6. Run migrations and seeds

```powershell
npm run db:migrate --prefix backend
npm run db:seed --prefix backend
```

The seed creates one user per role (password `Test@1234`):

| Email | Role |
|---|---|
| `john.doe@example.com` | Donor |
| `hospital@citygen.org` | Hospital/Patient |
| `staff@bloodbank.org` | Staff |
| `admin@bloodbank.org` | Admin |

### 7. Start the apps

```powershell
npm run dev
```

- API: `http://localhost:5000`
- UI: `http://localhost:5173`

### 8. Verify

In a second terminal:

```powershell
curl.exe -s http://localhost:5000/api/health
```

---

## Common commands

| Command | What it does |
|---|---|
| `npm run install:all` | Install dependencies |
| `npm run dev` | Start backend and frontend |
| `npm test` | Run backend Jest + Supertest suites |
| `npm run lint` | Run backend ESLint |
| `npm run db:migrate --prefix backend` | Apply `schema.sql` |
| `npm run db:seed --prefix backend` | Load seed data |
| `npm --prefix frontend run build` | Build the frontend |

> **Warning:** `npm run db:reset --prefix backend` drops all project tables. Do not run it on data you care about.

---

## API endpoints

Base URL: `http://localhost:5000`. Full details in [`backend/README.md`](backend/README.md).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | none | Health check |
| `GET` | `/api/auth/csrf` | none | Issues CSRF token |
| `POST` | `/api/auth/register` | none | Register as Donor or Hospital/Patient |
| `POST` | `/api/auth/login` | none | Authenticate and create session |
| `POST` | `/api/auth/logout` | session | End session |
| `POST` | `/api/auth/forgot-password` | none | Request reset token (dev returns token) |
| `POST` | `/api/auth/reset-password` | none | Use reset token to set new password |
| `GET` | `/api/auth/me` | session | Get own profile |
| `PUT` | `/api/auth/me` | session | Update own profile |
| `POST` | `/api/donors` | Staff/Admin | Register a donor |
| `GET` | `/api/donors` | Staff/Admin | List/filter donors |
| `GET` | `/api/donors/{id}/eligibility` | Staff/Admin | Check eligibility with reasons |
| `GET` | `/api/donors/me/donations` | Donor | Own donation history + eligibility |
| `POST` | `/api/donations` | Staff/Admin | Record a donation (Passed/Failed) |
| `PUT` | `/api/donations/{id}` | Staff/Admin | Correct a donation (24h window) |
| `GET` | `/api/stock/summary` | Staff/Admin | Grouped stock with alerts |
| `GET` | `/api/stock/units` | Staff/Admin | Individual units with expiry |
| `PATCH` | `/api/stock/units/{id}/discard` | Staff/Admin | Discard with reason |
| `GET` | `/api/search/stock` | Hospital/Patient, Staff | Search stock by group |
| `GET` | `/api/search/donors` | Staff/Admin | Search eligible donors |
| `POST` | `/api/requests` | Hospital/Patient | Submit blood request |
| `GET` | `/api/requests/mine` | Hospital/Patient | View own requests |
| `PATCH` | `/api/requests/{id}/cancel` | Hospital/Patient | Cancel a Pending request |
| `GET` | `/api/requests/pending` | Staff/Admin | Pending queue (Urgent first) |
| `PATCH` | `/api/requests/{id}/approve` | Staff/Admin | Approve and reserve (FEFO) |
| `PATCH` | `/api/requests/{id}/reject` | Staff/Admin | Reject with reason |
| `PATCH` | `/api/requests/{id}/issue` | Staff/Admin | Issue reserved units |
| `GET` | `/api/reports/stock` | Staff/Admin | Stock report |
| `GET` | `/api/reports/donation` | Staff/Admin | Donation report |
| `GET` | `/api/reports/request` | Staff/Admin | Request report |
| `GET` | `/api/reports/{type}/export` | Staff/Admin | CSV/PDF export |
| `POST` | `/api/admin/users` | Admin | Create a Staff account |
| `GET` | `/api/admin/users` | Admin | List/filter users |
| `PATCH` | `/api/admin/users/{id}/status` | Admin | Activate/deactivate |
| `PATCH` | `/api/admin/users/{id}/role` | Admin | Assign role |
| `GET` | `/api/admin/audit-logs` | Admin | View audit log |

All errors use one shape: `{ "error": { "code", "message", "requestId" } }` (SAD 4.4). State-changing requests need an `x-csrf-token` header from `GET /api/auth/csrf`.

---

## Testing

```powershell
npm run lint
npm test
npm --prefix frontend run build
```

Current state on `main`:
- **Backend:** 38 suites, 302 tests passing.
- **Frontend:** builds successfully.

Suites requiring a live PostgreSQL use `describeIfDb` and skip automatically when `DATABASE_URL` is unset (so CI without a database passes).

---

## Development workflow

1. Branch from `main`.
2. Implement against the SRS, SAD and STP. Note deviations in the PR.
3. Run `npm run lint` and `npm test` before pushing.
4. Open a PR against `main` with `Closes #N` and the STP test cases covered.
5. Merge after CI is green and a reviewer approves.

Never commit `backend/.env`, `cookies.txt` or `body.json`.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `EADDRINUSE: address already in use :::5000` | Previous `nodemon` running. `Get-NetTCPConnection -LocalPort 5000 -State Listen` then `Stop-Process`. |
| `connect ECONNREFUSED ::1:5432` | Wrong port. Dev DB is on **5433**. Check `backend/.env`. |
| `EBADCSRFTOKEN` from `curl` | Call `GET /api/auth/csrf` first; send `x-csrf-token` on mutating requests. |
| Login fails for known account | Account may be locked after 5 failed attempts. See `backend/README.md`. |
| `LAST_ADMIN` on admin action | You tried to deactivate the last active admin. |
| Frontend shows blank or errors | Restart Vite: `Ctrl+C` then `npm run dev --prefix frontend`. |

---

## Documentation

| Document | Location |
|---|---|
| Requirements Traceability Matrix | [`docs/RTM.md`](docs/RTM.md) |
| Architecture Deviations Register | [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) |
| SRS v1.1 | [`docs/SRS_bbms.pdf`](docs/SRS_bbms.pdf) |
| SAD v1.0 | [`docs/sad_bbms_09.pdf`](docs/sad_bbms_09.pdf) |
| STP v1.0 | [`docs/BBMS_Software_Test_Plan_v1.0.pdf`](docs/BBMS_Software_Test_Plan_v1.0.pdf) |
| Backend setup & deviations | [`backend/README.md`](backend/README.md) |

---

## Team

| Role | Name | SRN |
|---|---|---|
| Product Owner | Harsimran Kaur | PES1UG24CS187 |
| QA Lead | Dheepak Seetharam | PES1UG24CS152 |
| Test Engineer | Chukkapalli Rohan | PES1UG24CS135 |
| Developer | Gautam Prasanth Nair | PES1UG24CS169 |

PES University, Bangalore. Software Engineering (UE24CS341A), Section C, Team 9.
