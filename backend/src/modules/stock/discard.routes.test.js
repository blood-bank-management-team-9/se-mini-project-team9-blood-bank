const express = require('express');
const request = require('supertest');
const createRouter = require('./discard.routes');
const AppError = require('../../middleware/AppError');
const { errorHandler } = require('../../middleware/errorHandler');
const realApp = require('../../app');

const build = (user, service) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; next(); });
  app.use('/api/stock', createRouter({ service }));
  app.use(errorHandler);
  return app;
};
const staff = { userId: 7, role: 'Staff' };
const URL = '/api/stock/units/UNT-00001/discard';

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('PATCH /api/stock/units/:unitId/discard', () => {
  it('200 {unitId, status: Discarded} for Staff with a valid reason', async () => {
    const service = { discardUnit: jest.fn().mockResolvedValue({ unitId: 'UNT-00001', status: 'Discarded' }) };
    const res = await request(build(staff, service)).patch(URL).send({ reason: 'Hemolyzed' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unitId: 'UNT-00001', status: 'Discarded' });
    expect(service.discardUnit).toHaveBeenCalledWith({ unitId: 'UNT-00001', reason: 'Hemolyzed', staffId: 7 });
  });

  it('400 when the reason is missing (TC-29 step 1)', async () => {
    const service = { discardUnit: jest.fn() };
    const res = await request(build(staff, service)).patch(URL).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields[0].field).toBe('reason');
    expect(service.discardUnit).not.toHaveBeenCalled();
  });

  it('400 when the reason is not in the list, and for a bad unit id', async () => {
    const app = build(staff, {});
    expect((await request(app).patch(URL).send({ reason: 'Bored' })).status).toBe(400);
    expect((await request(app).patch('/api/stock/units/bad/discard').send({ reason: 'Leakage' })).status).toBe(400);
  });

  it('401 without a session and 403 for non-Staff roles', async () => {
    expect((await request(build(undefined, {})).patch(URL).send({ reason: 'Leakage' })).status).toBe(401);
    const service = { discardUnit: jest.fn() };
    for (const role of ['Donor', 'Hospital/Patient', 'Admin']) {
      const res = await request(build({ userId: 1, role }, service)).patch(URL).send({ reason: 'Leakage' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCESS_DENIED');
    }
    expect(service.discardUnit).not.toHaveBeenCalled();
  });

  it('passes through 404 NOT_FOUND and 409 INVALID_STATE from the service', async () => {
    const service = { discardUnit: jest.fn()
      .mockRejectedValueOnce(new AppError(404, 'NOT_FOUND', 'Blood unit not found.'))
      .mockRejectedValueOnce(new AppError(409, 'INVALID_STATE', 'already Issued')) };
    const app = build(staff, service);
    expect((await request(app).patch(URL).send({ reason: 'Leakage' })).body.error.code).toBe('NOT_FOUND');
    const res = await request(app).patch(URL).send({ reason: 'Leakage' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('the real app denies by default until login exists', async () => {
    expect((await request(realApp).patch(URL).send({ reason: 'Leakage' })).status).toBe(401);
  });
});
