# Requirements Traceability Matrix (RTM)

**Project:** Blood Bank Management System (BBMS) - Team 9  
**Specification References:** SRS v1.0 Appendix C, SAD v1.0 Section 3.8, STP v1.0 Section 13.2  
**Milestone:** Sprint 2 Completion  

---

## 1. Functional Requirements (FR) Traceability

| Sl. | Req ID | Description | Component | SAD Design Ref | STP Test Case | Implementation Status |
|---|---|---|---|---|---|---|
| 1 | **FR-AUTH-01** | Register account (Donor, Hospital/Patient) | C4 Auth Service, C3 Validation | 4.3 `POST /api/auth/register` | TC-01 | Implemented & Verified |
| 2 | **FR-AUTH-02** | Reject duplicate email or phone | C4 Auth Service, C17 DB Unique | 4.3 `POST /api/auth/register` (409) | TC-19 | Implemented & Verified |
| 3 | **FR-AUTH-03** | Login by role with session | C4 Auth Service, C3 Session, C1 | 4.2 SD-1, 4.3 `POST /api/auth/login` | TC-19 | Implemented & Verified |
| 4 | **FR-AUTH-04** | Account lockout after 5 failed attempts | C4 Auth Service, C13 Config | 4.2 SD-1, 4.3 (423 ACCOUNT_LOCKED) | TC-02 | Implemented & Verified |
| 5 | **FR-AUTH-05** | Password reset with 15-min token | C4 Auth Service, C14 Email | 4.3 `forgot-password`, `reset-password` | TC-20 | Implemented & Verified |
| 6 | **FR-AUTH-06** | Manage own user profile | C4 Auth Service | 4.3 `GET, PUT /api/auth/me` | TC-20 | Implemented & Verified |
| 7 | **FR-AUTH-07** | Logout and terminate session | C4 Auth Service, C3 Session | 4.3 `POST /api/auth/logout`, ADR-04 | TC-18 | Implemented & Verified |
| 8 | **FR-ADM-01** | Create Staff user account | C5 Admin Service | 4.3 `POST /api/admin/users` | TC-21 | Implemented & Verified |
| 9 | **FR-ADM-02** | View and filter user accounts | C5 Admin Service | 4.3 `GET /api/admin/users` | TC-21 | Implemented & Verified |
| 10 | **FR-ADM-03** | Activate / deactivate user account | C5 Admin Service, C4 Session | 4.3 `PATCH .../status` | TC-11 | Implemented & Verified |
| 11 | **FR-ADM-04** | Change user role | C5 Admin Service | 4.3 `PATCH .../role` | TC-21 | Implemented & Verified |
| 12 | **FR-ADM-05** | Audit log viewer for Admin | C12 Audit & Logging, C5 Admin | 4.3 `GET /api/admin/audit-logs`, 4.4 | TC-21 | Implemented & Verified |
| 13 | **FR-ADM-06** | Protect last remaining active admin | C5 Admin Service | 4.3 `PATCH .../status` (409) | TC-11 | Implemented & Verified |
| 14 | **FR-DON-01** | Add donor record (Staff only) | C6 Donor Service | 4.3 `POST /api/donors` | TC-22 | Implemented & Verified |
| 15 | **FR-DON-02** | Validate donor demographic & contact data | C6 Donor Service, C3 Validation | 4.3 `POST /api/donors` (400, 409) | TC-22 | Implemented & Verified |
| 16 | **FR-DON-03** | Update donor contact & history | C6 Donor Service, C12 Audit | 4.3 `PUT /api/donors/:id` | TC-23 | Implemented & Verified |
| 17 | **FR-DON-04** | Donor eligibility engine (age, weight, intervals) | C6 Eligibility Engine, C13 Config | 4.1 Eligibility, 4.2 SD-2 | TC-03 | Implemented & Verified |
| 18 | **FR-DON-05** | Return specific ineligibility reasons & next date | C6 Eligibility Engine | 4.3 `GET /api/donors/:id`, 4.1 | TC-23 | Implemented & Verified |
| 19 | **FR-DON-06** | Donor views own donation history | C6 Donor Service, C3 Filter | 4.3 `GET /api/donors/me/donations` | TC-24 | Implemented & Verified |
| 20 | **FR-DON-07** | Deactivate donor record (no hard delete) | C6 Donor Service | 4.3 `PATCH /api/donors/:id/status` | TC-25 | Implemented & Verified |
| 21 | **FR-DON-08** | Link donor record to authenticated user account | C6 Donor Service, C4 Auth | 4.3 `GET /api/donors/me/donations` | TC-24 | Implemented & Verified |
| 22 | **FR-SRCH-01** | Search available blood stock by group | C7 Search Service | 4.3 `GET /api/search/stock` | TC-12 | Implemented & Verified (PR #48) |
| 23 | **FR-SRCH-02** | Stock result detail by role (Staff vs Public) | C7 Search Service | 4.3 `GET /api/search/stock` | TC-12 | Implemented & Verified (PR #48) |
| 24 | **FR-SRCH-03** | Search eligible donors (Staff only) | C7 Search Service, C6 Engine | 4.3 `GET /api/search/donors` | TC-26 | Implemented & Verified (PR #48) |
| 25 | **FR-SRCH-04** | Mask donor identities from non-Staff roles | C3 RBAC, C12 Audit | 3.9 STRIDE, 4.3 (403) | TC-09 | Implemented & Verified (PR #48) |
| 26 | **FR-SRCH-05** | User-friendly "No matching results found" | C7 Search Service, C1 Frontend | 4.3 `GET /api/search/stock`, 4.4 | TC-12 | Implemented & Verified (PR #48) |
| 27 | **FR-SRCH-06** | Paginate donor search results (20/page) | C7 Search Service | 4.3 `GET /api/search/donors` (page) | TC-26 | Implemented & Verified (PR #48) |
| 28 | **FR-DNR-01** | Record blood collection (Staff only) | C8 Donation Service | 4.2 SD-2, 4.3 `POST /api/donations` | TC-04 | Implemented & Verified |
| 29 | **FR-DNR-02** | Prevent recording donation for ineligible donor | C8 Donation Service, C6 Engine | 4.2 SD-2 (422 NOT_ELIGIBLE) | TC-27 | Implemented & Verified |
| 30 | **FR-DNR-03** | Create blood unit on Passed screening | C8 Donation Service, C9 Stock | 4.2 SD-2, 4.1 Unit IDs | TC-04 | Implemented & Verified |
| 31 | **FR-DNR-04** | Discard blood unit on Failed screening | C8 Donation Service | 4.2 SD-2 (Failed branch) | TC-05 | Implemented & Verified |
| 32 | **FR-DNR-05** | Update donor last_donation_date atomically | C8 Donation Service, C6 Donor | 4.2 SD-2 | TC-27 | Implemented & Verified |
| 33 | **FR-DNR-06** | Allow correction of donation details within window | C8 Donation Service, C12 Audit | 4.3 `PUT /api/donations/:id`, 3.9 | TC-27 | Implemented & Verified |
| 34 | **FR-STK-01** | View stock summary by group and status | C9 Stock Service | 4.3 `GET /api/stock/summary` | TC-28 | Implemented & Verified |
| 35 | **FR-STK-02** | Assign 35/42-day expiry date to units | C9 Stock Service, C13 Config | 4.1 IDs, 3.6 `blood_units` | TC-28 | Implemented & Verified |
| 36 | **FR-STK-03** | Midnight auto-expire job for expired units | C15 Scheduler, C9 Stock Service | 3.5 ADR-05, 3.7 | TC-06 | Implemented & Verified |
| 37 | **FR-STK-04** | Trigger Low-Stock alerts when units < threshold | C9 Stock Service, C13 Config | 4.3 `GET /api/stock/summary`, 4.5 | TC-07 | Implemented & Verified |
| 38 | **FR-STK-05** | Trigger Expiring-Soon alerts (within 7 days) | C9 Stock Service, C1 Frontend | 4.3 `GET /api/stock/units`, 4.5 | TC-28 | Implemented & Verified |
| 39 | **FR-STK-06** | Manually discard damaged/unsafe unit with reason | C9 Stock Service, C12 Audit | 4.3 `PATCH .../discard` | TC-29 | Implemented & Verified |
| 40 | **FR-STK-07** | Derived stock counts prevent negative balance | C9 Stock Service, C16 Transactions | 3.5 ADR-06, 3.6, 4.2 SD-3 | TC-29 | Implemented & Verified |
| 41 | **FR-REQ-01** | Submit blood request (Hospital/Patient) | C10 Request Service | 4.3 `POST /api/requests` | TC-30 | Implemented & Verified |
| 42 | **FR-REQ-02** | Validate blood request parameters | C10 Request Service, C3 Validation | 4.3 `POST /api/requests` (400) | TC-13 | Implemented & Verified |
| 43 | **FR-REQ-03** | Assign Request ID and set initial Pending state | C10 Request Service | 4.3 `POST /api/requests`, 4.1 | TC-30 | Implemented & Verified |
| 44 | **FR-REQ-04** | Prioritize queue: Urgent before Normal, then FIFO | C10 Request Service | 4.3 `GET /api/requests/pending` | TC-14 | Implemented & Verified |
| 45 | **FR-REQ-05** | Staff approve request and reserve units (FEFO) | C10 Request Service, C9 Stock | 4.2 SD-3, 4.3 `.../approve` | TC-08 | Implemented & Verified |
| 46 | **FR-REQ-06** | Staff reject request with mandatory reason | C10 Request Service, C12 Audit | 4.3 `.../reject` | TC-31 | Implemented & Verified |
| 47 | **FR-REQ-07** | Issue reserved units and record dispatch | C10 Request Service, C9 Stock | 4.3 `.../issue` | TC-15 | Implemented & Verified |
| 48 | **FR-REQ-08** | Requester track status and cancel pending request | C10 Request Service | 4.3 `GET /requests/mine`, `PATCH .../cancel` | TC-30 | Implemented & Verified |
| 49 | **FR-RPT-01** | Generate Stock Report with group & status breakdown | C11 Report Service | 4.3 `GET /api/reports/stock` | TC-10 | Implemented & Verified (PR #50) |
| 50 | **FR-RPT-02** | Generate Donation Report with donor demographics | C11 Report Service | 4.3 `GET /api/reports/donation` | TC-32 | Implemented & Verified (PR #50) |
| 51 | **FR-RPT-03** | Generate Request Report with turnaround times | C11 Report Service | 4.3 `GET /api/reports/request` | TC-32 | Implemented & Verified (PR #50) |
| 52 | **FR-RPT-04** | Filter reports by date range, blood group, status | C11 Report Service | 4.3 `GET /api/reports/:type` (filters) | TC-32 | Implemented & Verified (PR #50) |
| 53 | **FR-RPT-05** | Export reports to CSV and PDF formats | C11 Report Service | 4.3 `GET /api/reports/:type/export` | TC-10 | Implemented & Verified (PR #51) |
| 54 | **FR-RPT-06** | Restrict report access to Staff & Admin roles | C11 Report Service, C3 RBAC | 4.3 (Staff, Admin), 4.4 | TC-09 | Implemented & Verified (PR #50) |

---

## 2. Non-Functional Requirements (NFR) Traceability

| Sl. | Req ID | Metric / Specification | Component | Architecture Ref | Test Case | Status |
|---|---|---|---|---|---|---|
| 55 | **NFR-PERF-01** | Search response time < 3s for 95% queries | C7 Search, C16/C17 Indexes | SAD 3.6 Indexes, 4.4 | TC-17 | Implemented & Verified (PR #52) |
| 56 | **NFR-PERF-02** | Page load time < 3s under standard broadband | C1 Client, C2 Nginx | SAD 4.5 UX, 4.4 Monitoring | TC-19 | Implemented & Verified (PR #52) |
| 57 | **NFR-PERF-03** | Support 50 concurrent logged-in users | C3, C16 Connection Pool | SAD 3.6, 4.4 Monitoring | TC-17 | Implemented & Verified (PR #52) |
| 58 | **NFR-PERF-04** | Generate reports up to 12 months in < 10s | C11 Reports, C17 Indexes | SAD 4.3, 3.6 Indexes | TC-32 | Implemented & Verified (PR #50) |
| 59 | **NFR-SAF-01** | Never issue Expired, Discarded or reserved unit | C9 Stock, C10 Requests | SAD 3.5 ADR-05, 4.1 Unit States | TC-06, TC-15 | Implemented & Verified |
| 60 | **NFR-SAF-02** | Confirm recipient blood group match on issue | C10 Requests, C1 Frontend | SAD 4.3 `.../issue` confirmMatch | TC-15 | Implemented & Verified |
| 61 | **NFR-SAF-03** | Daily automated database backup with 30d retention | C15 Scheduler, pg_dump | SAD 3.6 Infrastructure, 3.7 | TC-34 | Implemented & Verified |
| 62 | **NFR-SEC-01** | Passwords hashed with bcrypt (>= 10 rounds) | C4 Auth Service | SAD 3.9 STRIDE, 4.1 Security | TC-01 | Implemented & Verified |
| 63 | **NFR-SEC-02** | RBAC server-side enforcement on all protected routes | C3 RBAC Middleware | SAD 3.9 STRIDE, 4.4 Errors | TC-09, TC-21 | Implemented & Verified |
| 64 | **NFR-SEC-03** | Encrypted transport: HTTPS with TLS 1.2+ & HSTS | C2 Nginx, Helmet HSTS | SAD 3.6, 3.9 STRIDE | TC-35 | Implemented & Verified (PR #52) |
| 65 | **NFR-SEC-04** | HttpOnly, Secure, SameSite cookies with 15m idle expiry | C3 Session Middleware | SAD 3.5 ADR-04, 3.6 Sessions | TC-18 | Implemented & Verified |
| 66 | **NFR-SEC-05** | Parameterised queries to eliminate SQL injection | C16 Data Access Layer | SAD 3.9 STRIDE, 4.3 | TC-33 | Implemented & Verified |
| 67 | **NFR-SEC-06** | Tamper-evident Audit log retained for 365 days | C12 Audit, Node Cron | SAD 3.6, 4.4 Logging | TC-35 | Implemented & Verified |
| 68 | **NFR-SEC-07** | Zero personal data (passwords, phones, emails) in logs | C12 Audit, Log Redactor | SAD 3.9, 4.4 Logging | TC-35 | Implemented & Verified (PR #52) |
| 69 | **NFR-QUAL-01** | System usability, responsive layout from 360px | C1 Web Client | SAD 4.5 UX Design | TC-36 | Implemented & Verified |
| 70 | **NFR-QUAL-02** | System availability >= 99% with `/api/health` monitoring | C2, C15, Health Module | SAD 4.4 Monitoring, 3.7 | TC-37 | Implemented & Verified (PR #52) |
| 71 | **NFR-QUAL-03** | Transaction atomicity across donation and stock | C16 Transaction Manager | SAD 4.1 Transactions, 4.2 SD-2 | TC-33 | Implemented & Verified |
| 72 | **NFR-QUAL-04** | Modular monolith maintainability and testability | C3 to C11 Modules | SAD 3.5 ADR-01, 4.1 Structure | TC-37 | Implemented & Verified |
| 73 | **NFR-QUAL-05** | Browser compatibility: Chrome, Firefox, Edge, Safari | C1 Web Client | SAD 3.6, 4.5 UX Design | TC-36 | Implemented & Verified (PR #52) |

---

## 3. Business Rules (BR) Traceability

| BR ID | Description | Components | Design Reference | STP Test Case | Status |
|---|---|---|---|---|---|
| **BR-01** | Only Staff add donors/donations; only Admin manages staff/roles | C3 RBAC, C5, C6, C8 | SAD 3.9, 4.3 Access | TC-21, TC-22 | Implemented & Verified |
| **BR-02** | Users view only their own requests / donation history | C3 Filter, C6, C10 | SAD 4.3 `/requests/mine`, `/donors/me` | TC-24, TC-30 | Implemented & Verified |
| **BR-03** | Ineligible donor cannot donate until next eligible date | C6 Eligibility, C8 | SAD 4.1 Eligibility, 4.2 SD-2 | TC-03, TC-27 | Implemented & Verified |
| **BR-04** | Earliest-expiry blood unit issued first (FEFO) | C9 Stock, C10 Requests | SAD 4.2 SD-3, 3.5 ADR-06 | TC-08 | Implemented & Verified |
| **BR-05** | Urgent requests processed before Normal requests | C10 Request Service | SAD 4.3 `GET /api/requests/pending` | TC-14 | Implemented & Verified |
| **BR-06** | Only Staff approve or reject blood requests | C3 RBAC, C10 Requests | SAD 4.2 SD-3, 4.3 `.../approve`, `.../reject` | TC-31 | Implemented & Verified |
