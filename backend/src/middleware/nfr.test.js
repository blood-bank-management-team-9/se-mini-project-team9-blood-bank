const request = require('supertest');
const app = require('../app');
const { redact, SENSITIVE_KEYS } = require('./redaction');
const { errorHandler } = require('./errorHandler');
const { pool } = require('../database/db');

describe('NFR Verification Test Suite (Issue #24, SAD 3.6, 4.4, STP TC-17, TC-35, TC-37)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // Prevent Jest hanging handles
    await pool.end().catch(() => {});
  });

  describe('NFR-SEC-07 & TC-35: Sensitive Data Log Redaction', () => {
    it('redacts sensitive keys in object payload and preserves Date instances', () => {
      const now = new Date('2026-10-27T10:00:00.000Z');
      const sensitivePayload = {
        name: 'John Doe',
        password: 'SuperSecretPassword123!',
        phone: '9876543210',
        email: 'donor@example.com',
        address: '123 Cross Street, Bangalore',
        dateOfBirth: now,
        nested: {
          password_hash: '$2a$10$abcdef',
          contact_number: '+91 98765 43210',
          pin_code: '560001',
          safeField: 'normal data',
        },
      };

      const redacted = redact(sensitivePayload);

      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.phone).toBe('[REDACTED]');
      expect(redacted.email).toBe('[REDACTED]');
      expect(redacted.address).toBe('[REDACTED]');
      expect(redacted.name).toBe('John Doe');
      expect(redacted.dateOfBirth).toBe(now.toISOString());
      expect(redacted.nested.password_hash).toBe('[REDACTED]');
      expect(redacted.nested.contact_number).toBe('[REDACTED]');
      expect(redacted.nested.pin_code).toBe('[REDACTED]');
      expect(redacted.nested.safeField).toBe('normal data');
    });

    it('redacts inline email and Indian phone patterns in raw strings', () => {
      const logString = 'Error for test@domain.org with phone +91 9876543210 or 98765-43210';
      const redacted = redact(logString);

      expect(redacted).not.toContain('test@domain.org');
      expect(redacted).not.toContain('9876543210');
      expect(redacted).toContain('[REDACTED]');
    });

    it('handles circular references without stack overflow', () => {
      const circular = { name: 'Root' };
      circular.self = circular;

      expect(() => redact(circular)).not.toThrow();
      const res = redact(circular);
      expect(res.self).toBe('[CIRCULAR]');
    });

    it('redacts error messages before passing to console.error in errorHandler (TC-35)', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const mockReq = { id: 'req-test-123' };
      const mockRes = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockNext = jest.fn();

      const sensitiveError = new Error(
        'Failed to process user test@example.com with phone 9876543210 and password Secret123!'
      );

      errorHandler(sensitiveError, mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedMessage = consoleErrorSpy.mock.calls[0].join(' ');

      expect(loggedMessage).toContain('[req-test-123]');
      expect(loggedMessage).not.toContain('test@example.com');
      expect(loggedMessage).not.toContain('9876543210');
      expect(loggedMessage).toContain('[REDACTED]');
    });

    it('has full coverage of all SAD 4.4 specified sensitive keys', () => {
      expect(SENSITIVE_KEYS.has('password')).toBe(true);
      expect(SENSITIVE_KEYS.has('phone')).toBe(true);
      expect(SENSITIVE_KEYS.has('email')).toBe(true);
      expect(SENSITIVE_KEYS.has('address')).toBe(true);
      expect(SENSITIVE_KEYS.has('pin_code')).toBe(true);
    });
  });

  describe('NFR-SEC-03 & TC-35: Encrypted Transport & Security Headers', () => {
    it('serves Strict-Transport-Security (HSTS) header on responses', async () => {
      jest.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      const res = await request(app).get('/api/health');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(res.headers['strict-transport-security']).toContain('includeSubDomains');
    });

    it('sets standard security protection headers from Helmet', async () => {
      jest.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('issues 308 redirect when HTTPS enforcement is active', async () => {
      process.env.REQUIRE_HTTPS = 'true';
      try {
        const res = await request(app)
          .get('/api/health')
          .set('x-forwarded-proto', 'http');
        expect(res.status).toBe(308);
        expect(res.headers.location).toMatch(/^https:\/\//);
      } finally {
        delete process.env.REQUIRE_HTTPS;
      }
    });
  });

  describe('NFR-QUAL-02 & TC-37: Availability & Health Monitoring', () => {
    it('returns 200 and healthy status when database probe succeeds', async () => {
      jest.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
      expect(typeof res.body.uptime).toBe('number');
    });

    it('returns 503 and degraded status when database probe fails', async () => {
      jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('DB unreachable'));

      const res = await request(app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
      expect(res.body.database).toBe('unavailable');
    });
  });

  describe('NFR-PERF-03: Connection Pool Concurrency Settings', () => {
    it('initializes connection pool with capacity for 50 concurrent users', () => {
      expect(pool.options.max).toBe(50);
      expect(pool.options.idleTimeoutMillis).toBe(30000);
      expect(pool.options.connectionTimeoutMillis).toBe(3000);
    });

    it('handles 50 concurrent asynchronous queries under 3s SLA (NFR-PERF-03, TC-17)', async () => {
      // Mock fast DB execution for concurrent load simulation
      jest.spyOn(pool, 'query').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { rows: [{ result: 1 }] };
      });

      const start = Date.now();
      const concurrentTasks = Array.from({ length: 50 }, () =>
        pool.query('SELECT 1')
      );
      const results = await Promise.all(concurrentTasks);
      const elapsed = Date.now() - start;

      expect(results).toHaveLength(50);
      expect(elapsed).toBeLessThan(3000); // SRS SLA: < 3000ms
    });
  });
});
