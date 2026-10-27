const express = require('express');
const request = require('supertest');

jest.mock('../audit/audit.repository', () => ({ logAudit: jest.fn() }));
jest.mock('./donations.service', () => {
  class DonationError extends Error {}
  return {
    DonationError,
    VOLUMES_ML: [350, 450],
    NOTES_MAX_LENGTH: 200,
    correctDonation: jest.fn(),
  };
});
jest.mock('./donations.record.service', () => ({
  recordDonation: jest.fn(),
}));

const donationsRouter = require('./donations.routes');

// Real RBAC middleware: SRS BR-01, only Staff may record or correct donations.
const endpoints = [
  ['put', '/api/donations/DON-00000001'],
  ['post', '/api/donations'],
];

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.id = 'test-request-id';
    if (user) req.session = { user };
    next();
  });
  app.use('/api/donations', donationsRouter);
  return app;
}

describe.each(endpoints)('%s %s access control (BR-01, NFR-SEC-02)', (method, url) => {
  it.each(['Donor', 'Hospital/Patient', 'Admin'])('returns 403 ACCESS_DENIED for %s', async (role) => {
    const res = await request(buildApp({ userId: 'USR-X', role }))[method](url).send({ volumeMl: 350 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCESS_DENIED');
  });

  it('returns 401 without a session', async () => {
    const res = await request(buildApp(null))[method](url).send({ volumeMl: 350 });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('lets Staff through to validation', async () => {
    const res = await request(buildApp({ userId: 'USR-STF01', role: 'Staff' }))[method](url).send({ volumeMl: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});