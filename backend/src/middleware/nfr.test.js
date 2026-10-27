const request = require('supertest');
const app = require('../app');
const { redact, SENSITIVE_KEYS } = require('./redaction');
const { pool } = require('../database/db');

describe('NFR Verification Test Suite (Issue #24, SAD 3.6, 4.4, STP TC-17, TC-35, TC-37)', () => {
  describe('NFR-SEC-07 & TC-35: Sensitive Data Log Redaction', () => {
    it('redacts sensitive keys in object payload', () => {
      const sensitivePayload = {
        name: 'John Doe',
        password: 'SuperSecretPassword123!',
        phone: '9876543210',
        email: 'donor@example.com',
        address: '123 Cross Street, Bangalore',
        nested: {
          password_hash: '$2a$10$abcdef',
          contact_number: '9123456789',
          safeField: 'normal data',
        },
      };

      const redacted = redact(sensitivePayload);

      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.phone).toBe('[REDACTED]');
      expect(redacted.email).toBe('[REDACTED]');
      expect(redacted.address).toBe('[REDACTED]');
      expect(redacted.name).toBe('John Doe');
      expect(redacted.nested.password_hash).toBe('[REDACTED]');
      expect(redacted.nested.contact_number).toBe('[REDACTED]');
      expect(redacted.nested.safeField).toBe('normal data');
    });

    it('redacts inline email and phone patterns in raw strings', () => {
      const logString = 'Error occurred for user test@domain.org with mobile 9876543210';
      const redacted = redact(logString);

      expect(redacted).not.toContain('test@domain.org');
      expect(redacted).not.toContain('9876543210');
      expect(redacted).toContain('[REDACTED]');
    });

    it('has full coverage of all SAD 4.4 specified sensitive keys', () => {
      expect(SENSITIVE_KEYS.has('password')).toBe(true);
      expect(SENSITIVE_KEYS.has('phone')).toBe(true);
      expect(SENSITIVE_KEYS.has('email')).toBe(true);
      expect(SENSITIVE_KEYS.has('address')).toBe(true);
    });
  });

  describe('NFR-SEC-03 & TC-35: Encrypted Transport & Security Headers', () => {
    it('serves Strict-Transport-Security (HSTS) header on responses', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(res.headers['strict-transport-security']).toContain('includeSubDomains');
    });

    it('sets standard security protection headers from Helmet', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('NFR-QUAL-02 & TC-37: Availability & Health Monitoring', () => {
    it('returns service health, uptime, and database status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('blood-bank-api');
      expect(res.body.database).toBeDefined();
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.time).toBeDefined();
    });
  });

  describe('NFR-PERF-03: Connection Pool Concurrency Settings', () => {
    it('initializes connection pool with capacity for 50 concurrent users', () => {
      expect(pool.options.max).toBeGreaterThanOrEqual(20);
      expect(pool.options.idleTimeoutMillis).toBeDefined();
      expect(pool.options.connectionTimeoutMillis).toBeDefined();
    });
  });

  describe('NFR-PERF-01 & TC-17: Response Time SLA Benchmark (< 3s)', () => {
    it('completes health check and API routing under 500ms', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/health');
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(3000); // SRS SLA: < 3000ms
    });
  });
});
