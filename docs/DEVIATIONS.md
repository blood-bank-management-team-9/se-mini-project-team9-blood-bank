# Architectural & Design Deviations Register

**Project:** Blood Bank Management System (BBMS) - Team 9  
**Specification References:** SRS v1.0, SAD v1.0, STP v1.0  
**Milestone:** Sprint 2 Review  

This document logs all architectural and technical implementation deviations from the baseline SRS and SAD specifications, along with the technical rationale, impacts, and verification methods.

---

### DEV-01: Zero-Dependency Binary PDF-1.4 Generator
- **Baseline Specification:** SAD 3.6 & 4.3 mentions `pdfkit` for report PDF generation.
- **Implemented Solution:** Pure Node.js standard binary PDF-1.4 buffer generator implemented in `backend/src/modules/reports/reports.exporter.js`.
- **Rationale:**
  - `pdfkit` and associated font/canvas libraries introduce heavy native binary dependencies, font file distribution requirements, and unpredictable memory allocations during concurrent export loads.
  - The custom PDF-1.4 generator constructs valid PDF cross-reference tables, catalogs, font descriptors, and compressed streams natively in Node.js buffers without external npm packages.
- **Verification:** Verified by unit tests in `reports.test.js`, PDF parser extraction checks (`pypdf`), and automated download tests in `reports.test.jsx`.

---

### DEV-02: RFC 4180 In-Memory CSV Generation
- **Baseline Specification:** SAD 3.6 mentions a generic CSV writer npm library.
- **Implemented Solution:** Built-in RFC 4180 compliant CSV stream builder with explicit quoting, delimiter escaping, and CRLF line breaks.
- **Rationale:** Standardizes output formatting across OS platforms (Windows, Linux, macOS) while eliminating third-party dependency vulnerabilities and footprint.
- **Verification:** Tested against comma-containing and special character fields in `reports.test.js`.

---

### DEV-03: Connection Pool Concurrency Sizing (50 Concurrent Users)
- **Baseline Specification:** SAD 3.6 specified default `pg` connection pool.
- **Implemented Solution:** Configured dynamic connection pool sizing with `max: 50` connections, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 3000` in `backend/src/database/db.js`.
- **Rationale:** Explicitly satisfies `NFR-PERF-03` guaranteeing sustained concurrent access for 50 logged-in users under the 3-second SLA without database connection starvation.
- **Verification:** Verified in `backend/src/middleware/nfr.test.js`.

---

### DEV-04: Multi-Layered Sensitive Log Redaction
- **Baseline Specification:** SAD 4.4 and NFR-SEC-07 specified Pino-based log redaction.
- **Implemented Solution:** Unified redaction middleware (`backend/src/middleware/redaction.js`) covering structured JSON objects (request bodies, query params, error payloads) and regex pattern matching on unformatted error strings/stack traces.
- **Rationale:** Prevents leakage of phone numbers, emails, passwords, and addresses across console streams, error handlers, and audit logs.
- **Verification:** Verified by comprehensive test cases in `nfr.test.js`.

---

### DEV-05: Test-Environment CSRF Token Exemption
- **Baseline Specification:** SAD 3.6 double-submit cookie CSRF protection on all mutating API calls.
- **Implemented Solution:** CSRF middleware enabled on `/api` routes in production and development, with conditional bypass when `NODE_ENV === 'test'`.
- **Rationale:** Allows fast, hermetic execution of Supertest API suites without requiring simulated CSRF token extraction roundtrips in unit tests while strictly enforcing CSRF protection in deployed environments.
- **Verification:** Production configuration verified in `app.js` and test runs.

---

### DEV-06: Production Nginx TLS 1.2+ Configuration Template
- **Baseline Specification:** SAD 3.6 & 3.9 specifies Nginx terminating TLS 1.2+ and redirecting HTTP to HTTPS.
- **Implemented Solution:** Provided production Nginx virtual host template in `docs/nginx/bbms.conf` with modern Mozilla intermediate cipher suite, HSTS preload, gzip compression, and secure proxy pass.
- **Rationale:** Clear deployment instructions and operational readiness for deployment teams.

---

### DEV-07: CSV Formula Injection (DDE) Sanitization
- **Baseline Specification:** SAD 3.6 & 4.3 mentions standard CSV export.
- **Implemented Solution:** Automatically prefixes cells starting with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single quote (`'`) in `backend/src/modules/reports/reports.exporter.js`.
- **Rationale:** Mitigates CSV Injection (CWE-1236) where exported blood stock, donor, or request data could execute arbitrary commands when opened in Microsoft Excel or LibreOffice Calc.
- **Verification:** Verified by unit tests in `reports.test.js`.

---

### DEV-08: Health Check Connection Leak Prevention & Degraded Reporting
- **Baseline Specification:** SAD 4.4 mentions `/api/health` monitoring.
- **Implemented Solution:** Uses `pool.query('SELECT 1')` with automatic client release in `backend/src/modules/health/health.controller.js`, returning HTTP 200 when connected and HTTP 503 when degraded. Eliminated test-only bypass logic in production code.
- **Rationale:** Prevents connection pool starvation caused by unreleased clients when the database is intermittent or flapping. Ensures CI and production environments truthfully report service availability.
- **Verification:** Unit tests in `health.test.js` and `nfr.test.js` validating both healthy and degraded responses.

---

### DEV-09: Recursive Redaction Cycle Guard & Regional Phone Pattern Normalization
- **Baseline Specification:** SAD 4.4 & NFR-SEC-07 specified log redaction of sensitive credentials.
- **Implemented Solution:** Enhanced `backend/src/middleware/redaction.js` with `WeakSet` circular reference detection, Date object preservation, expanded sensitive keys (`phone_number`, `pin_code`, `authorization`, `cookie`), and Indian mobile regex patterns (`+91...`, dashes, spaces). Integrated directly into `backend/src/modules/audit/audit.repository.js`.
- **Rationale:** Prevents stack overflows during serialization of complex or cyclic error payloads, and ensures personal contact information and authentication tokens never persist in application audit logs or error logs.
- **Verification:** Verified by console spy tests in `nfr.test.js`.

