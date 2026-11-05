jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../middleware/validate', () => ({
  validate: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('./reports.service', () => ({
  VALID_BLOOD_GROUPS: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  STOCK_STATUSES: ['Available', 'Reserved', 'Issued', 'Expired', 'Discarded'],
  DONATION_SCREENING_STATUSES: ['Passed', 'Failed', 'Pending'],
  REQUEST_STATUSES: ['Pending', 'Approved', 'Rejected'],
  ReportError: class ReportError extends Error {
    constructor(code, publicMessage, status = 400) {
      super(publicMessage);
      this.code = code;
      this.publicMessage = publicMessage;
      this.status = status;
    }
  },
  generateStockReport: jest.fn(),
  generateDonationReport: jest.fn(),
  generateRequestReport: jest.fn(),
  exportReport: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const service = require('./reports.service');
const router = require('./reports.routes');

const app = express();
app.use((req, res, next) => {
  req.session = { user: { userId: 'USR-1' } };
  req.id = 'request-1';
  next();
});
app.use('/api/reports', router);
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

beforeEach(() => jest.clearAllMocks());

describe('reports.routes unit tests', () => {
  test('returns stock report successfully', async () => {
    service.generateStockReport.mockResolvedValue({ reportType: 'stock' });

    const res = await request(app).get('/api/reports/stock');

    expect(res.status).toBe(200);
    expect(res.body.reportType).toBe('stock');
    expect(service.generateStockReport).toHaveBeenCalledWith(
      {},
      'USR-1'
    );
  });

  test('returns donation report successfully', async () => {
    service.generateDonationReport.mockResolvedValue({ reportType: 'donation' });

    const res = await request(app).get('/api/reports/donation');

    expect(res.status).toBe(200);
    expect(res.body.reportType).toBe('donation');
  });

  test('returns request report successfully', async () => {
    service.generateRequestReport.mockResolvedValue({ reportType: 'request' });

    const res = await request(app).get('/api/reports/request');

    expect(res.status).toBe(200);
    expect(res.body.reportType).toBe('request');
  });

  test('maps ReportError from stock route', async () => {
    service.generateStockReport.mockRejectedValue(
      new service.ReportError('INVALID_DATE', 'Invalid date', 400)
    );

    const res = await request(app).get('/api/reports/stock');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_DATE',
      message: 'Invalid date',
      requestId: 'request-1',
    });
  });

  test('forwards unexpected donation route errors', async () => {
    service.generateDonationReport.mockRejectedValue(new Error('Unexpected'));

    const res = await request(app).get('/api/reports/donation');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Unexpected');
  });

  test('maps request route service errors', async () => {
    service.generateRequestReport.mockRejectedValue(
      new service.ReportError('INVALID_STATUS', 'Invalid status', 422)
    );

    const res = await request(app).get('/api/reports/request');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_STATUS');
  });

  test('exports a report and sets response headers', async () => {
    service.exportReport.mockResolvedValue({
      contentType: 'text/csv',
      filename: 'stock.csv',
      data: Buffer.from('Blood Group'),
    });

    const res = await request(app).get('/api/reports/stock/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('stock.csv');
    expect(service.exportReport).toHaveBeenCalledWith('stock', 'csv', {});
  });

  test('maps export ReportError', async () => {
    service.exportReport.mockRejectedValue(
      new service.ReportError('INVALID_REPORT_TYPE', 'Unknown type', 400)
    );

    const res = await request(app).get('/api/reports/unknown/export');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REPORT_TYPE');
  });

  test('forwards unexpected export errors', async () => {
    service.exportReport.mockRejectedValue(new Error('Export failed'));

    const res = await request(app).get('/api/reports/stock/export');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Export failed');
  });
});
