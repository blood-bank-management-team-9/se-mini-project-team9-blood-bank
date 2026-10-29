# Requirements Traceability Matrix (RTM)

**Project:** Blood Bank Management System (BBMS) - Team 9  
**Specification References:** SRS v1.1 Appendix C, SAD v1.0 Section 3.8, STP v1.0 Section 13.2  
**Milestone:** Sprint 2 Completion  

**Requirements Summary:** 79 Requirements Total (54 Functional Requirements, 19 Non-Functional Requirements, 6 Business Rules).

---

## 1. Functional Requirements (FR) Traceability

| Sl. | Req ID | Description | Component | SAD Ref | STP Test Case | Status | Test / Evidence File |
|---|---|---|---|---|---|---|---|
| 1 | **FR-AUTH-01** | Register account (Donor, Hospital/Patient) | C4 Auth Service, C3 Validation | 4.3 `POST /api/auth/register` | TC-01 | Implemented (main) | `backend/src/modules/auth/auth.register.test.js` |
| 2 | **FR-AUTH-02** | Reject duplicate email or phone | C4 Auth Service, C17 DB Unique | 4.3 `POST /api/auth/register` (409) | TC-19 | Implemented (main) | `backend/src/modules/auth/auth.register.test.js` |
| 3 | **FR-AUTH-03** | Login by role with session | C4 Auth Service, C3 Session, C1 | 4.2 SD-1, 4.3 `POST /api/auth/login` | TC-19 | Implemented (main) | `backend/src/modules/auth/auth.login.test.js` |
| 4 | **FR-AUTH-04** | Account lockout after 5 failed attempts | C4 Auth Service, C13 Config | 4.2 SD-1, 4.3 (423 ACCOUNT_LOCKED) | TC-02 | Implemented (main) | `backend/src/modules/auth/auth.login.test.js` |
| 5 | **FR-AUTH-05** | Password reset with 15-min token | C4 Auth Service, C14 Email | 4.3 `forgot-password`, `reset-password` | TC-20 | Planned (Sprint 3) | `backend/src/modules/auth/` |
| 6 | **FR-AUTH-06** | Manage own user profile | C4 Auth Service | 4.3 `GET, PUT /api/auth/me` | TC-20 | Implemented (main) | `backend/src/modules/auth/auth.me.test.js` |
| 7 | **FR-AUTH-07** | Logout and terminate session | C4 Auth Service, C3 Session | 4.3 `POST /api/auth/logout`, ADR-04 | TC-18 | Implemented (main) | `backend/src/modules/auth/auth.login.test.js` |
| 8 | **FR-ADM-01** | Create Staff user account | C5 Admin Service | 4.3 `POST /api/admin/users` | TC-21 | Implemented (main) | `backend/src/modules/admin/admin.test.js` |
| 9 | **FR-ADM-02** | View and filter user accounts | C5 Admin Service | 4.3 `GET /api/admin/users` | TC-21 | Implemented (main) | `backend/src/modules/admin/admin.test.js` |
| 10 | **FR-ADM-03** | Activate / deactivate user account | C5 Admin Service, C4 Session | 4.3 `PATCH .../status` | TC-11 | Implemented (main) | `backend/src/modules/admin/admin.test.js` |
| 11 | **FR-ADM-04** | Change user role | C5 Admin Service | 4.3 `PATCH .../role` | TC-21 | Implemented (main) | `backend/src/modules/admin/admin.test.js` |
| 12 | **FR-ADM-05** | Audit log viewer for Admin | C12 Audit & Logging, C5 Admin | 4.3 `GET /api/admin/audit-logs`, 4.4 | TC-21 | Implemented (main) | `backend/src/modules/admin/admin.test.js` |
| 13 | **FR-ADM-06** | Protect last remaining active admin | C5 Admin Service | 4.3 `PATCH .../status` (409) | TC-11 | Implemented (main) | `backend/src/modules/admin/admin.test.js` |
| 14 | **FR-DON-01** | Add donor record (Staff only) | C6 Donor Service | 4.3 `POST /api/donors` | TC-22 | Implemented (main) | `backend/src/modules/donors/donors.routes.test.js` |
| 15 | **FR-DON-02** | Validate donor demographic & contact data | C6 Donor Service, C3 Validation | 4.3 `POST /api/donors` (400, 409) | TC-22 | Implemented (main) | `backend/src/modules/donors/donors.routes.test.js` |
| 16 | **FR-DON-03** | Update donor contact & history | C6 Donor Service, C12 Audit | 4.3 `PUT /api/donors/:id` | TC-23 | Implemented (main) | `backend/src/modules/donors/donors.routes.test.js` |
| 17 | **FR-DON-04** | Donor eligibility engine (age, weight, intervals) | C6 Eligibility Engine, C13 Config | 4.1 Eligibility, 4.2 SD-2 | TC-03 | Implemented (main) | `backend/src/modules/donors/donorEligibility.test.js` |
| 18 | **FR-DON-05** | Return specific ineligibility reasons & next date | C6 Eligibility Engine | 4.3 `GET /api/donors/:id`, 4.1 | TC-23 | Implemented (main) | `backend/src/modules/donors/donorEligibility.test.js` |
| 19 | **FR-DON-06** | Donor views own donation history | C6 Donor Service, C3 Filter | 4.3 `GET /api/donors/me/donations` | TC-24 | Planned (Sprint 3) | `backend/src/modules/donors/` |
| 20 | **FR-DON-07** | Deactivate donor record (no hard delete) | C6 Donor Service | 4.3 `PATCH /api/donors/:id/status` | TC-25 | Implemented (main) | `backend/src/modules/donors/donors.routes.test.js` |
| 21 | **FR-DON-08** | Link donor record to authenticated user account | C6 Donor Service, C4 Auth | 4.3 `GET /api/donors/me/donations` | TC-24 | Planned (Sprint 3) | `backend/src/modules/donors/` |
| 22 | **FR-SRCH-01** | Search available blood stock by group | C7 Search Service | 4.3 `GET /api/search/stock` | TC-12 | In review (PR #48) | `backend/src/modules/search/search.test.js` |
| 23 | **FR-SRCH-02** | Stock result detail by role (Staff vs Public) | C7 Search Service | 4.3 `GET /api/search/stock` | TC-12 | In review (PR #48) | `backend/src/modules/search/search.test.js` |
| 24 | **FR-SRCH-03** | Search eligible donors (Staff only) | C7 Search Service, C6 Engine | 4.3 `GET /api/search/donors` | TC-26 | In review (PR #48) | `backend/src/modules/search/search.test.js` |
| 25 | **FR-SRCH-04** | Restrict donor search to Staff/Admin (403 for others, audited) | C3 RBAC, C12 Audit | 3.9 STRIDE, 4.3 (403) | TC-09 | In review (PR #48) | `backend/src/modules/search/search.test.js` |
| 26 | **FR-SRCH-05** | User-friendly "No matching results found" message | C7 Search Service, C1 Frontend | 4.3 `GET /api/search/stock`, 4.4 | TC-12 | In review (PR #48) | `frontend/src/__tests__/search.test.jsx` |
| 27 | **FR-SRCH-06** | Paginate donor search results (20/page) | C7 Search Service | 4.3 `GET /api/search/donors` (page) | TC-26 | In review (PR #48) | `backend/src/modules/search/search.test.js` |
| 28 | **FR-DNR-01** | Record blood collection (Staff only) | C8 Donation Service | 4.2 SD-2, 4.3 `POST /api/donations` | TC-04 | In review (PR #56) | `backend/src/modules/donations/donation.routes.test.js` |
| 29 | **FR-DNR-02** | Prevent recording donation for ineligible donor | C8 Donation Service, C6 Engine | 4.2 SD-2 (422 NOT_ELIGIBLE) | TC-27 | In review (PR #56) | `backend/src/modules/donations/donation.routes.test.js` |
| 30 | **FR-DNR-03** | Create blood unit on Passed screening | C8 Donation Service, C9 Stock | 4.2 SD-2, 4.1 Unit IDs | TC-04 | In review (PR #56) | `backend/src/modules/donations/donation.routes.test.js` |
| 31 | **FR-DNR-04** | Record screening failure with notes without creating unit | C8 Donation Service | 4.2 SD-2 (Failed branch) | TC-05 | In review (PR #56) | `backend/src/modules/donations/donation.routes.test.js` |
| 32 | **FR-DNR-05** | Atomically update donor last_donation_date within transaction | C8 Donation Service, C6 Donor | 4.2 SD-2 | TC-27 | In review (PR #56) | `backend/src/modules/donations/donation.routes.test.js` |
| 33 | **FR-DNR-06** | Allow correction of donation details within 24h window | C8 Donation Service, C12 Audit | 4.3 `PUT /api/donations/:id`, 3.9 | TC-27 | In review (PR #55) | `backend/src/modules/donations/donation.correction.test.js` |
| 34 | **FR-STK-01** | View stock summary by group and status | C9 Stock Service | 4.3 `GET /api/stock/summary` | TC-28 | Implemented (main) | `backend/src/modules/stock/stock.service.test.js` |
| 35 | **FR-STK-02** | Assign shelf-life expiry to blood units (default 35 days) | C9 Stock Service, C13 Config | 4.1 IDs, 3.6 `blood_units` | TC-28 | Implemented (main) | `backend/src/modules/stock/stock.service.test.js` |
| 36 | **FR-STK-03** | Midnight auto-expire job for expired units | C15 Scheduler, C9 Stock Service | 3.5 ADR-05, 3.7 | TC-06 | Planned (Sprint 3) | `backend/src/modules/stock/` |
| 37 | **FR-STK-04** | Trigger Low-Stock alerts when units < threshold | C9 Stock Service, C13 Config | 4.3 `GET /api/stock/summary`, 4.5 | TC-07 | Implemented (main) | `backend/src/modules/stock/stock.service.test.js` |
| 38 | **FR-STK-05** | Trigger Expiring-Soon alerts (within 7 days) | C9 Stock Service, C1 Frontend | 4.3 `GET /api/stock/units`, 4.5 | TC-28 | Implemented (main) | `backend/src/modules/stock/stock.service.test.js` |
| 39 | **FR-STK-06** | Manually discard damaged/unsafe unit with reason | C9 Stock Service, C12 Audit | 4.3 `PATCH .../discard` | TC-29 | Implemented (main) | `backend/src/modules/stock/stock.discard.test.js` |
| 40 | **FR-STK-07** | Derived stock counts prevent negative balance | C9 Stock Service, C16 Transactions | 3.5 ADR-06, 3.6, 4.2 SD-3 | TC-29 | Implemented (main) | `backend/src/modules/stock/stock.discard.test.js` |
| 41 | **FR-REQ-01** | Submit blood request (Hospital/Patient) | C10 Request Service | 4.3 `POST /api/requests` | TC-30 | Implemented | `backend/src/modules/requests/requests.test.js` |
| 42 | **FR-REQ-02** | Validate blood request parameters | C10 Request Service, C3 Validation | 4.3 `POST /api/requests` (400) | TC-13 | Implemented | `backend/src/modules/requests/requests.routes.test.js` |
| 43 | **FR-REQ-03** | Assign Request ID and set initial Pending state | C10 Request Service | 4.3 `POST /api/requests`, 4.1 | TC-30 | Implemented | `backend/src/modules/requests/requests.test.js` |
| 44 | **FR-REQ-04** | Prioritize queue: Urgent before Normal, then FIFO | C10 Request Service | 4.3 `GET /api/requests/pending` | TC-14 | Planned (Sprint 3) | `backend/src/modules/requests/` |
| 45 | **FR-REQ-05** | Staff approve request and reserve units (FEFO) | C10 Request Service, C9 Stock | 4.2 SD-3, 4.3 `.../approve` | TC-08 | Planned (Sprint 3) | `backend/src/modules/requests/` |
| 46 | **FR-REQ-06** | Staff reject request with mandatory reason | C10 Request Service, C12 Audit | 4.3 `.../reject` | TC-31 | Planned (Sprint 3) | `backend/src/modules/requests/` |
| 47 | **FR-REQ-07** | Issue reserved units and record dispatch | C10 Request Service, C9 Stock | 4.3 `.../issue` | TC-15 | Planned (Sprint 3) | `backend/src/modules/requests/` |
| 48 | **FR-REQ-08** | Requester track status and cancel pending request | C10 Request Service | 4.3 `GET /requests/mine`, `PATCH .../cancel` | TC-30 | Implemented | `backend/src/modules/requests/requests.test.js` |
| 49 | **FR-RPT-01** | Stock summary by blood group with optional status filter | C11 Report Service | 4.3 `GET /api/reports/stock` | TC-10 | In review (PR #50) | `backend/src/modules/reports/reports.test.js` |
| 50 | **FR-RPT-02** | Donation report by date range, blood group, status | C11 Report Service | 4.3 `GET /api/reports/donation` | TC-32 | In review (PR #50) | `backend/src/modules/reports/reports.test.js` |
| 51 | **FR-RPT-03** | Blood request history with request and decision timestamps | C11 Report Service | 4.3 `GET /api/reports/request` | TC-32 | In review (PR #50) | `backend/src/modules/reports/reports.test.js` |
| 52 | **FR-RPT-04** | Filter reports by date range, blood group, status | C11 Report Service | 4.3 `GET /api/reports/:type` (filters) | TC-32 | In review (PR #50) | `backend/src/modules/reports/reports.test.js` |
| 53 | **FR-RPT-05** | Export reports to CSV and PDF formats | C11 Report Service | 4.3 `GET /api/reports/:type/export` | TC-10 | In review (PR #51) | `backend/src/modules/reports/reports.test.js` |
| 54 | **FR-RPT-06** | Restrict report access to Staff & Admin roles | C11 Report Service, C3 RBAC | 4.3 (Staff, Admin), 4.4 | TC-09 | In review (PR #50) | `backend/src/modules/reports/reports.test.js` |

---

## 2. Non-Functional Requirements (NFR) Traceability

| Sl. | Req ID | Metric / Specification | Component | Architecture Ref | STP Test Case | Status | Test / Evidence File |
|---|---|---|---|---|---|---|---|
| 55 | **NFR-PERF-01** | Search response time < 3s for 95% queries | C7 Search, C16/C17 Indexes | SAD 3.6 Indexes, 4.4 | TC-17 | In review (PR #52) | `backend/src/middleware/nfr.test.js` |
| 56 | **NFR-PERF-02** | Page load time < 3s under standard broadband | C1 Client, C2 Nginx | SAD 4.5 UX, 4.4 Monitoring | TC-19 | In review (PR #52) | `docs/BROWSER_COMPATIBILITY.md` |
| 57 | **NFR-PERF-03** | Support 50 concurrent logged-in users under 3s SLA | C3, C16 Connection Pool | SAD 3.6, 4.4 Monitoring | TC-17 | In review (PR #52) | `backend/src/middleware/nfr.test.js` |
| 58 | **NFR-PERF-04** | Generate reports up to 12 months in < 10s (500 row cap) | C11 Reports, C17 Indexes | SAD 4.3, 3.6 Indexes | TC-32 | In review (PR #50) | `backend/src/modules/reports/reports.service.js` |
| 59 | **NFR-SAF-01** | Never issue Expired, Discarded or reserved unit | C9 Stock, C10 Requests | SAD 3.5 ADR-05, 4.1 Unit States | TC-06, TC-15 | Planned (Sprint 3) | `backend/src/modules/requests/` |
| 60 | **NFR-SAF-02** | Confirm recipient blood group match on issue | C10 Requests, C1 Frontend | SAD 4.3 `.../issue` confirmMatch | TC-15 | Planned (Sprint 3) | `backend/src/modules/requests/` |
| 61 | **NFR-SAF-03** | Daily automated database backup with 30d retention | C15 Scheduler, pg_dump | SAD 3.6 Infrastructure, 3.7 | TC-34 | Planned (Sprint 3) | `backend/src/jobs/backup.js` |
| 62 | **NFR-SEC-01** | Passwords hashed with bcrypt (>= 10 rounds) | C4 Auth Service | SAD 3.9 STRIDE, 4.1 Security | TC-01 | Implemented (main) | `backend/src/modules/auth/auth.register.test.js` |
| 63 | **NFR-SEC-02** | RBAC server-side enforcement on all protected routes | C3 RBAC Middleware | SAD 3.9 STRIDE, 4.4 Errors | TC-09 | Implemented (main) | `backend/src/modules/auth/auth.rbac.test.js` |
| 64 | **NFR-SEC-03** | Encrypted transport: HTTPS with TLS 1.2+ & HSTS | C2 Nginx, Helmet HSTS | SAD 3.6, 3.9 STRIDE | TC-35 | In review (PR #52) | `backend/src/middleware/nfr.test.js` |
| 65 | **NFR-SEC-04** | HttpOnly, Secure, SameSite cookies with 15m idle expiry | C3 Session Middleware | SAD 3.5 ADR-04, 3.6 Sessions | TC-18 | Implemented (main) | `backend/src/middleware/session.test.js` |
| 66 | **NFR-SEC-05** | Parameterised queries to eliminate SQL injection | C16 Data Access Layer | SAD 3.9 STRIDE, 4.3 | TC-16 | Implemented (main) | `backend/src/database/db.js` |
| 67 | **NFR-SEC-06** | Tamper-evident Audit log retained for 365 days | C12 Audit, Node Cron | SAD 3.6, 4.4 Logging | TC-21 | Implemented (main) | `backend/src/modules/audit/audit.retention.test.js` |
| 68 | **NFR-SEC-07** | Zero personal data (passwords, phones, emails) in logs | C12 Audit, Log Redactor | SAD 3.9, 4.4 Logging | TC-35 | In review (PR #52) | `backend/src/middleware/nfr.test.js` |
| 69 | **NFR-QUAL-01** | System usability, responsive layout from 360px | C1 Web Client | SAD 4.5 UX Design | TC-36 | Implemented (main) | `frontend/src/__tests__/browserCompatibility.test.jsx` |
| 70 | **NFR-QUAL-02** | System availability >= 99% with `/api/health` monitoring | C2, C15, Health Module | SAD 4.4 Monitoring, 3.7 | TC-37 | In review (PR #52) | `backend/src/modules/health/health.test.js` |
| 71 | **NFR-QUAL-03** | Transaction atomicity across donation and stock | C16 Transaction Manager | SAD 4.1 Transactions, 4.2 SD-2 | TC-33 | Implemented (main) | `backend/src/database/transaction.test.js` |
| 72 | **NFR-QUAL-04** | Modular monolith maintainability and testability | C3 to C11 Modules | SAD 3.5 ADR-01, 4.1 Structure | TC-37 | Implemented (main) | `backend/src/modules/health/health.test.js` |
| 73 | **NFR-QUAL-05** | Browser compatibility: Chrome, Firefox, Edge, Safari | C1 Web Client | SAD 3.6, 4.5 UX Design | TC-36 | In review (PR #52) | `docs/BROWSER_COMPATIBILITY.md` |

---

## 3. Business Rules (BR) Traceability

| Sl. | BR ID | Description | Components | Design Reference | STP Test Case | Status | Test / Evidence File |
|---|---|---|---|---|---|---|---|
| 74 | **BR-01** | Only Staff add donors/donations; only Admin manages staff/roles | C3 RBAC, C5, C6, C8 | SAD 3.9, 4.3 Access | TC-21, TC-22 | Implemented (main) | `backend/src/modules/admin/admin.test.js` |
| 75 | **BR-02** | Users view only their own requests / donation history | C3 Filter, C6, C10 | SAD 4.3 `/requests/mine`, `/donors/me` | TC-24, TC-30 | Implemented for request history | `backend/src/modules/requests/requests.test.js` |
| 76 | **BR-03** | Ineligible donor cannot donate until next eligible date | C6 Eligibility, C8 | SAD 4.1 Eligibility, 4.2 SD-2 | TC-03, TC-27 | Implemented (main) | `backend/src/modules/donors/donorEligibility.test.js` |
| 77 | **BR-04** | Earliest-expiry blood unit issued first (FEFO) | C9 Stock, C10 Requests | SAD 4.2 SD-3, 3.5 ADR-06 | TC-08 | Planned (Sprint 3) | `backend/src/modules/requests/` |
| 78 | **BR-05** | Urgent requests processed before Normal requests | C10 Request Service | SAD 4.3 `GET /api/requests/pending` | TC-14 | Planned (Sprint 3) | `backend/src/modules/requests/` |
| 79 | **BR-06** | Only Staff approve or reject blood requests | C3 RBAC, C10 Requests | SAD 4.2 SD-3, 4.3 `.../approve`, `.../reject` | TC-31 | Planned (Sprint 3) | `backend/src/modules/requests/` |
