const express = require('express');
const request = require('supertest');

// Mock the audit repository to avoid needing a DB in this unit test.
jest.mock('../modules/audit/audit.repository', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

const { logAudit } = require('../modules/audit/audit.repository');
const requestId = require('./requestId');
const { requireRole } = require('./rbac');
const { errorHandler } = require('./errorHandler');
function buildApp(sessionUser) {
  const app = express();
  app.use(requestId);
  app.use((req, _res, next) => { req.session = { user: sessionUser }; next(); });
  app.get('/staff', requireRole('Staff'), (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('RBAC (NFR-SEC-02, TC-09)', () => {
  beforeEach(() => logAudit.mockClear());

  it('returns 403 ACCESS_DENIED for wrong role and writes an audit row', async () => {
    const app = buildApp({ userId: 'U000000001', role: 'Donor' });
    const res = await request(app).get('/staff');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCESS_DENIED');
    expect(res.body.error.requestId).toBeDefined();
    expect(logAudit).toHaveBeenCalledTimes(1);
    const arg = logAudit.mock.calls[0][0];
    expect(arg.action).toBe('ACCESS_DENIED');
    expect(arg.userId).toBe('U000000001');
  });

  it('returns 401 UNAUTHENTICATED when no session user', async () => {
    const app = buildApp(null);
    const res = await request(app).get('/staff');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('allows the correct role', async () => {
    const app = buildApp({ userId: 'U000000002', role: 'Staff' });
    const res = await request(app).get('/staff');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});