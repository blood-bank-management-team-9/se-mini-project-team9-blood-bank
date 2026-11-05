jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../middleware/validate', () => ({
  validate: jest.fn(() => (req, res, next) => next())
}));

jest.mock('./stock.service', () => ({
  BLOOD_GROUPS: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  UNIT_STATUSES: ['Available', 'Reserved', 'Expired'],
  getSummary: jest.fn(),
  listUnits: jest.fn(),
  StockError: class StockError extends Error {
    constructor(code, publicMessage, status) {
      super(publicMessage);
      this.code = code;
      this.publicMessage = publicMessage;
      this.status = status;
    }
  }
}));

const express = require('express');
const request = require('supertest');
const stockService = require('./stock.service');
const router = require('./stock.routes');

const app = express();
app.use(express.json());
app.use('/api/stock', router);

app.use((err, req, res, next) => {
  res.status(500).json({ forwarded: err.message });
});

describe('Stock routes - Summary', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns stock summary successfully', async () => {
    stockService.getSummary.mockResolvedValue({ totalUnits: 25 });

    const res = await request(app).get('/api/stock/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalUnits: 25 });
  });

  test('handles StockError from summary service', async () => {
    stockService.getSummary.mockRejectedValue(
      new stockService.StockError(
        'STOCK_ERROR',
        'Stock unavailable',
        400
      )
    );

    const res = await request(app).get('/api/stock/summary');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('STOCK_ERROR');
    expect(res.body.error.message).toBe('Stock unavailable');
  });

  test('forwards unexpected summary errors', async () => {
    stockService.getSummary.mockRejectedValue(
      new Error('Unexpected failure')
    );

    const res = await request(app).get('/api/stock/summary');

    expect(res.status).toBe(500);
    expect(res.body.forwarded).toBe('Unexpected failure');
  });
});

describe('Stock routes - Units', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns stock units successfully', async () => {
    stockService.listUnits.mockResolvedValue([
      { unitId: 'UNIT-001', bloodGroup: 'A+' }
    ]);

    const res = await request(app)
      .get('/api/stock/units')
      .query({ bloodGroup: 'A+', status: 'Available' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(stockService.listUnits).toHaveBeenCalledWith({
      bloodGroup: 'A+',
      status: 'Available'
    });
  });

  test('handles StockError from units service', async () => {
    stockService.listUnits.mockRejectedValue(
      new stockService.StockError(
        'UNIT_ERROR',
        'Units unavailable',
        404
      )
    );

    const res = await request(app).get('/api/stock/units');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('UNIT_ERROR');
  });

  test('forwards unexpected units errors', async () => {
    stockService.listUnits.mockRejectedValue(
      new Error('Units query failed')
    );

    const res = await request(app).get('/api/stock/units');

    expect(res.status).toBe(500);
    expect(res.body.forwarded).toBe('Units query failed');
  });
});
