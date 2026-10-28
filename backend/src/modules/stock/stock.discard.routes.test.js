const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => {
    req.session = { user: { userId: 'USR-STF01', role: 'Staff' } };
    return next();
  }),
}));

jest.mock('./stock.service', () => {
  class StockError extends Error {
    constructor(code, publicMessage, status = 400) {
      super(publicMessage);
      this.code = code;
      this.status = status;
      this.publicMessage = publicMessage;
    }
  }
  return {
    StockError,
    BLOOD_GROUPS: ['O+'],
    UNIT_STATUSES: ['Available'],
    DISCARD_REASONS: ['Expired', 'Hemolyzed', 'Contaminated', 'Leakage', 'Test Positive'],
    getSummary: jest.fn(),
    listUnits: jest.fn(),
    discardUnit: jest.fn(),
  };
});

const stockService = require('./stock.service');
const stockRouter = require('./stock.routes');

const app = express();
app.use(express.json());
app.use((req, res, next) => { req.id = 'test-request-id'; next(); });
app.use('/api/stock', stockRouter);

describe('PATCH /api/stock/units/:unitId/discard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when the reason is missing or invalid', async () => {
    const res = await request(app).patch('/api/stock/units/UNT-00001/discard').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(stockService.discardUnit).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed unit id', async () => {
    const res = await request(app).patch('/api/stock/units/abc/discard').send({ reason: 'Leakage' });
    expect(res.status).toBe(400);
    expect(stockService.discardUnit).not.toHaveBeenCalled();
  });

  it('discards the unit and passes the logged-in user as actor', async () => {
    stockService.discardUnit.mockResolvedValue({ unitId: 'UNT-00001', status: 'Discarded' });
    const res = await request(app).patch('/api/stock/units/UNT-00001/discard').send({ reason: 'Leakage' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unitId: 'UNT-00001', status: 'Discarded' });
    expect(stockService.discardUnit).toHaveBeenCalledWith({
      actorUserId: 'USR-STF01', unitId: 'UNT-00001', reason: 'Leakage',
    });
  });

  it('maps service errors to their HTTP status', async () => {
    stockService.discardUnit.mockRejectedValue(
      new stockService.StockError('INVALID_STATE', 'A unit that is Issued cannot be discarded', 409)
    );
    const res = await request(app).patch('/api/stock/units/UNT-00001/discard').send({ reason: 'Leakage' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });
});