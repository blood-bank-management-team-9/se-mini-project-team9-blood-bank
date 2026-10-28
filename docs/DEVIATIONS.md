# Architectural & Design Deviations Register

**Project:** Blood Bank Management System (BBMS) - Team 9  
**Specification References:** SRS v1.1, SAD v1.0, STP v1.0  
**Milestone:** Sprint 2 Completion  

This register documents all architectural, design, and technical deviations from the baseline SRS and SAD specifications across the codebase, noting specific rationale, known constraints/risks, and verification methods.

---

### DEV-01: Zero-Dependency Binary PDF-1.4 Generator (Single-Page Tabular Format)
- **Baseline Specification:** SAD Section 3.6 & 4.3 mentions `pdfkit` for exporting tabular reports.
- **Implemented Solution:** Custom pure Node.js binary PDF-1.4 buffer generator implemented in `backend/src/modules/reports/reports.exporter.js`. Generates valid PDF trailer dictionaries, cross-reference tables (xref), catalog dictionaries, and uncompressed content streams using standard Type 1 fonts (Helvetica, Helvetica-Bold, Courier).
- **Rationale:** Eliminates heavy external binary dependencies, font distribution packages, and dynamic canvas rendering overhead in the backend environment.
- **Known Limitations & Constraints:**
  - Single-page tabular format: hard-capped at 30 rows per export.
  - Character set: standard ISO Latin-1 encoding (non-ASCII characters are normalized).
  - Fixed-width column layout: no automatic multi-page reflow or text-wrapping.
- **Verification:** Unit tests in `backend/src/modules/reports/reports.test.js` asserting `%PDF-1.4` magic bytes, trailer object structure, and Content-Type header.

---

### DEV-02: RFC 4180 In-Memory CSV Serializer with Formula Injection Sanitization
- **Baseline Specification:** SAD Section 3.6 mentions a generic CSV writer npm library.
- **Implemented Solution:** Pure Node.js in-memory RFC 4180 CSV serializer with strict field quoting, delimiter escaping, CRLF line endings, and automated CSV formula injection (DDE) sanitization (cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` are prefixed with `'`).
- **Rationale:** Mitigates CSV Injection (CWE-1236) where exported records could execute arbitrary commands when opened in spreadsheet software (Excel, Calc), while avoiding third-party dependency vulnerabilities.
- **Known Limitations & Constraints:** In-memory string builder (memory usage scales with row count; bounded by 500-row cap in PR #50).
- **Verification:** Unit tests in `backend/src/modules/reports/reports.test.js` validating RFC 4180 formatting and formula sanitization.

---

### DEV-03: Connection Pool Concurrency Sizing (50 Concurrent Users)
- **Baseline Specification:** SAD Section 3.6 default `pg` connection pool.
- **Implemented Solution:** Sized dynamic connection pool in `backend/src/database/db.js` with `max: 50` connections, `connectionTimeoutMillis: 3000`, and `idleTimeoutMillis: 30000`. (Note: Statement timeouts are handled via Promise race timeouts at query level rather than a global `statement_timeout`).
- **Rationale:** Explicitly satisfies `NFR-PERF-03` guaranteeing sustained concurrent access for 50 logged-in users under the 3-second SLA without pool starvation.
- **Verification:** Automated concurrency test in `backend/src/middleware/nfr.test.js` firing 50 concurrent database operations under 3 seconds.

---

### DEV-04: Multi-Layered Sensitive Data Scrubbing and Error Redaction
- **Baseline Specification:** SAD Section 3.6 & 4.4 specified `pino` for logging with redaction.
- **Implemented Solution:** Custom recursive redaction helper in `backend/src/middleware/redaction.js` combined with standard `console.error` in `errorHandler.js`, `morgan('dev')` for HTTP requests, and automatic data scrubbing in `audit.repository.js`. Features a `WeakSet` circular reference guard, Date object preservation, and regex patterns for Indian mobile numbers (`+91...`, dashes, spaces).
- **Rationale:** Avoids native C-binding loggers while guaranteeing passwords, authorization tokens, phone numbers, emails, and physical addresses never leak into error logs or audit trails.
- **Known Limitations:** `morgan('dev')` logs full URL paths including query strings to the terminal; query scrubbing is applied to internal error and audit payloads.
- **Verification:** Spied console tests in `backend/src/middleware/nfr.test.js`.

---

### DEV-05: Test-Environment CSRF Token Exemption
- **Baseline Specification:** SAD Section 3.6 double-submit cookie CSRF protection on all mutating API calls.
- **Implemented Solution:** Double-submit CSRF protection (`csrf-csrf@4`) applied globally to `/api` routes in production and development, with conditional bypass strictly when `process.env.NODE_ENV === 'test'`.
- **Rationale:** Enables fast, hermetic execution of Supertest API test suites without requiring simulated CSRF token extraction roundtrips in unit tests, while enforcing CSRF tokens in deployed environments.
- **Verification:** Implemented in `backend/src/app.js` (lines 52-54).

---

### DEV-06: Modernized Production Nginx Reverse Proxy Template
- **Baseline Specification:** SAD Section 3.6 & 3.9 specifies Nginx terminating TLS 1.2+ and redirecting HTTP to HTTPS.
- **Implemented Solution:** Provided production Nginx virtual host template in `docs/nginx/bbms.conf` using modern `http2 on;` (replacing deprecated `listen 443 ssl http2`), strong ECDHE cipher suites (dropping DHE to avoid weak DH groups without dhparam), 60s read timeout for large exports, dynamic WebSocket upgrade mapping, upstream port 5000, and HTTP->HTTPS 308 redirect.
- **Rationale:** Conforms with modern Nginx 1.25+ syntax and Mozilla SSL Configuration recommendations.
- **Verification:** Configuration linted and verified against Mozilla SSL Modern/Intermediate guidelines.

---

### DEV-07: Config-Driven Shelf Life & Non-Unit Screening Failure Flow (PR #56)
- **Baseline Specification:** FR-STK-02 specified fixed 35/42-day expiry; FR-DNR-04 specified creating and then discarding blood units on failed screening.
- **Implemented Solution:** Shelf life duration is dynamically retrieved from the `system_config` table (`shelf_life_days`, defaulting to 35). When screening fails, no blood unit record is inserted into `blood_units`; the donation record is saved with status `Failed Screening` and reasons recorded in `medicalNotes`.
- **Rationale:** Avoids creating orphaned inventory records for units that were never safely collected, reducing database clutter and preventing accidental stock allocation.
- **Verification:** Verified by donation test suite in `backend/src/modules/donations/donation.routes.test.js`.

---

### DEV-08: In-SQL Donor Eligibility Engine with Config Fallbacks (PR #48)
- **Baseline Specification:** FR-DON-04 & FR-SRCH-03 specified donor eligibility checks performed at the service level.
- **Implemented Solution:** Search donor endpoint evaluates eligibility criteria directly in SQL subqueries using `system_config` parameters (min age 18, max age 65, min weight 45kg, 90d male / 120d other donation intervals) with hardcoded fallbacks, returning paginated (20 per page) eligible donors.
- **Rationale:** Performing eligibility filtering in the database engine avoids fetching thousands of ineligible donor records into Node.js memory, satisfying NFR-PERF-01 response time requirements.
- **Verification:** Verified in `backend/src/modules/search/search.test.js`.

---

### DEV-09: Reports Date Filtering Timestamp Semantics & Row Caps (PR #50, PR #51)
- **Baseline Specification:** FR-RPT-01 to FR-RPT-04 specify filtering reports by date range, blood group, and status without pagination or limits.
- **Implemented Solution:** Date interval filtering is applied to `created_at` timestamp with an inclusive interval (`< to_date + 1 day`); query results are capped at 500 rows to satisfy NFR-PERF-04 (< 10s response time). Export functionality was split into dedicated PR #51.
- **Rationale:** Protects backend against memory exhaustion from unconstrained date ranges while ensuring queries complete well under the 10-second NFR-PERF-04 SLA.
- **Verification:** Verified in `backend/src/modules/reports/reports.test.js`.

---

### DEV-10: Reverse Proxy Trust & Conditional HTTPS Redirection (PR #52)
- **Baseline Specification:** SAD Section 3.9 specifies mandatory HTTPS transport.
- **Implemented Solution:** `app.set('trust proxy', 1)` enabled in Express. HTTPS 308 redirection is enforced when `NODE_ENV === 'production'` or `REQUIRE_HTTPS === 'true'`, and uses `PUBLIC_HOST || req.headers.host`.
- **Rationale:** Prevents redirect loops when Express runs behind an Nginx TLS-terminating reverse proxy, while allowing local developer workflows over plain HTTP on localhost without requiring self-signed TLS certificates.
- **Verification:** Verified in `backend/src/middleware/nfr.test.js` and `backend/src/app.js`.

---

### DEV-11: Health Probe Connection Pool Protection (PR #52)
- **Baseline Specification:** SAD Section 4.4 `/api/health` monitoring.
- **Implemented Solution:** Replaced `pool.connect()` with `pool.query('SELECT 1')` with automatic client release in `health.controller.js`. Returns HTTP 200 when connected and HTTP 503 when degraded. Eliminated test-only bypass logic.
- **Rationale:** Prevents permanent connection pool exhaustion during flapping database states, and ensures health endpoints accurately report availability to monitoring systems.
- **Verification:** Verified in `backend/src/modules/health/health.test.js`.
