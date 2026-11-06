// src/middleware/csrf.test.js
const express = require('express');
const request = require('supertest');
const { doubleCsrfProtection, generateCsrfToken } = require('./csrf');

describe('csrf middleware', () => {
  it('exports doubleCsrfProtection as a function', () => {
    expect(typeof doubleCsrfProtection).toBe('function');
  });

  it('exports generateCsrfToken as a function', () => {
    expect(typeof generateCsrfToken).toBe('function');
  });

  it('doubleCsrfProtection is a middleware (3 args)', () => {
    expect(doubleCsrfProtection.length).toBe(3);
  });

  it('rejects POST without CSRF token', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = { id: 's', csrfId: 'fixed' };
      next();
    });
    app.post('/protected', doubleCsrfProtection, (_req, res) => res.json({ ok: true }));
    app.use((err, _req, res, _next) => {
      // csrf-csrf throws its own error type; just check status is 403
      res.status(403).json({ error: true });
    });

    const res = await request(app).post('/protected').send({});
    expect(res.status).toBe(403);
  });
});