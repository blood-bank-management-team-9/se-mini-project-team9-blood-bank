const express = require('express');
const request = require('supertest');
const { body } = require('express-validator');
const requestId = require('./requestId');
const { validate } = require('./validate');
const { errorHandler } = require('./errorHandler');
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.post(
    '/x',
    validate([
      body('phone').isLength({ min: 10, max: 10 }).isNumeric(),
      body('name').isLength({ min: 1, max: 60 }).trim().escape(),
    ]),
    (req, res) => res.json({ ok: true, body: req.body })
  );
  app.use(errorHandler);
  return app;
}

describe('Validation (NFR-SEC-05, TC-16)', () => {
  it('rejects SQL-injection-style payload in phone with 400 VALIDATION_ERROR', async () => {
    const res = await request(buildApp())
      .post('/x')
      .send({ phone: "' OR 1=1 --", name: 'a' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields[0].field).toBe('phone');
    expect(res.body.error.requestId).toBeDefined();
  });

  it('escapes <script> in name', async () => {
    const res = await request(buildApp())
      .post('/x')
      .send({ phone: '9876543210', name: '<script>alert(1)</script>' });
    expect(res.status).toBe(200);
    expect(res.body.body.name).not.toContain('<script>');
    expect(res.body.body.name).toContain('&lt;script&gt;');
  });
});