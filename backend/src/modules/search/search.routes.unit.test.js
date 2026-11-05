jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../middleware/validate', () => ({
  validate: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('./search.service', () => ({
  VALID_BLOOD_GROUPS: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  SearchError: class SearchError extends Error {
    constructor(code, publicMessage, status = 400) {
      super(publicMessage);
      this.code = code;
      this.publicMessage = publicMessage;
      this.status = status;
    }
  },
  searchStock: jest.fn(),
  searchDonors: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const service = require('./search.service');
const router = require('./search.routes');

const app = express();
app.use((req, res, next) => {
  req.session = { user: { userId: 'USR-1', role: 'Staff' } };
  req.id = 'request-1';
  next();
});
app.use('/api/search', router);
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

beforeEach(() => jest.clearAllMocks());

describe('search.routes unit tests', () => {
  test('returns stock search successfully', async () => {
    service.searchStock.mockResolvedValue({ bloodGroup: 'O+', availableUnits: 2 });

    const res = await request(app).get('/api/search/stock?bloodGroup=O%2B');

    expect(res.status).toBe(200);
    expect(res.body.availableUnits).toBe(2);
    expect(service.searchStock).toHaveBeenCalledWith('O+', 'Staff');
  });

  test('maps SearchError from stock route', async () => {
    service.searchStock.mockRejectedValue(
      new service.SearchError('INVALID_BLOOD_GROUP', 'Invalid group', 400)
    );

    const res = await request(app).get('/api/search/stock?bloodGroup=O%2B');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_BLOOD_GROUP',
      requestId: 'request-1',
    });
  });

  test('forwards unexpected stock search errors', async () => {
    service.searchStock.mockRejectedValue(new Error('Search failed'));

    const res = await request(app).get('/api/search/stock?bloodGroup=O%2B');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Search failed');
  });

  test('returns donor search successfully', async () => {
    service.searchDonors.mockResolvedValue({ donors: [], total: 0 });

    const res = await request(app).get('/api/search/donors?page=2&limit=10');

    expect(res.status).toBe(200);
    expect(service.searchDonors).toHaveBeenCalledWith({
      bloodGroup: undefined,
      city: undefined,
      pin: undefined,
      page: '2',
      limit: '10',
      actorUserId: 'USR-1',
    });
  });

  test('maps SearchError from donor route', async () => {
    service.searchDonors.mockRejectedValue(
      new service.SearchError('INVALID_BLOOD_GROUP', 'Invalid group', 400)
    );

    const res = await request(app).get('/api/search/donors');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BLOOD_GROUP');
  });

  test('forwards unexpected donor search errors', async () => {
    service.searchDonors.mockRejectedValue(new Error('Donor search failed'));

    const res = await request(app).get('/api/search/donors');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Donor search failed');
  });
});
