const express = require('express');
const request = require('supertest');
const createRouter = require('./correction.routes');
const AppError = require('../../middleware/AppError');
const { errorHandler } = require('../../middleware/errorHandler');
const realApp = require('../../app');

const build = (user, service) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; next(); });
  app.use('/api/donations', createRouter({ service }));
  app.use(errorHandler);
  return app;
};
const staff = { userId: 7, role: 'Staff' };

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('PUT /api/donations/:id', () => {
  it('200 with the updated fields', async () => {
    const service = { correctDonation: jest.fn().mockResolvedValue({ donationId: 'DON-1', updated: { volumeMl: 450 } }) };
    const res = await request(build(staff, service)).put('/api/donations/DON-1').send({ volumeMl: 450 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ donationId: 'DON-1', updated: { volumeMl: 450 } });
    expect(service.correctDonation).toHaveBeenCalledWith({ donationId: 'DON-1', changes: { volumeMl: 450 }, staffId: 7 });
  });

  it('401 UNAUTHENTICATED without a session', async () => {
    const res = await request(build(undefined, {})).put('/api/donations/DON-1').send({ volumeMl: 450 });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('403 ACCESS_DENIED for non-Staff roles (BR-01)', async () => {
    const service = { correctDonation: jest.fn() };
    for (const role of ['Donor', 'Hospital/Patient', 'Admin']) {
      const res = await request(build({ userId: 1, role }, service)).put('/api/donations/DON-1').send({ volumeMl: 450 });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCESS_DENIED');
    }
    expect(service.correctDonation).not.toHaveBeenCalled();
  });

  it('400 VALIDATION_ERROR names each bad field', async () => {
    const res = await request(build(staff, {})).put('/api/donations/DON-1').send({ volumeMl: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields[0].field).toBe('volumeMl');
  });

  it('400 for a malformed donation id and for broken JSON', async () => {
    const app = build(staff, {});
    expect((await request(app).put('/api/donations/bad%20id').send({ volumeMl: 450 })).status).toBe(400);
    const res = await request(app).put('/api/donations/DON-1').set('Content-Type', 'application/json').send('{oops');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('passes through 404 and 409 EDIT_WINDOW_EXPIRED from the service', async () => {
    const service = { correctDonation: jest.fn()
      .mockRejectedValueOnce(new AppError(404, 'NOT_FOUND', 'Donation not found.'))
      .mockRejectedValueOnce(new AppError(409, 'EDIT_WINDOW_EXPIRED', 'too old')) };
    const app = build(staff, service);
    expect((await request(app).put('/api/donations/X1').send({ volumeMl: 450 })).body.error.code).toBe('NOT_FOUND');
    const res = await request(app).put('/api/donations/X1').send({ volumeMl: 450 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EDIT_WINDOW_EXPIRED');
  });

  it('returns a generic 500 with no internal details for unexpected faults', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const service = { correctDonation: jest.fn().mockRejectedValue(new Error('relation "donations" does not exist')) };
    const res = await request(build(staff, service)).put('/api/donations/DON-1').send({ volumeMl: 450 });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/relation/);
  });

  it('the real app denies by default until login exists', async () => {
    const res = await request(realApp).put('/api/donations/DON-1').send({ volumeMl: 450 });
    expect(res.status).toBe(401);
  });
});
