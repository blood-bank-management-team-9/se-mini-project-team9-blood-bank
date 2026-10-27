const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => {
    req.session = { user: { userId: 'USR-STF01' } };
    return next();
  }),
}));

jest.mock('./donors.service', () => {
  class DonorError extends Error {
    constructor(code, publicMessage, status = 400) {
      super(publicMessage);
      this.code = code;
      this.status = status;
      this.publicMessage = publicMessage;
    }
  }

  return {
    DonorError,
    getDonorEligibility: jest.fn(),
  };
});

const donorService = require('./donors.service');
const donorsRouter = require('./donors.routes');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.id = 'test-request-id';
  return next();
});
app.use('/api/donors', donorsRouter);

describe('Donor eligibility API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns eligibility status and ineligibility reasons', async () => {
    const expected = {
      donorId: 'DNR-00001',
      eligible: false,
      evaluatedAt: '2026-10-23',
      nextEligibleDate: null,
      ineligibilityReasons: [{
        code: 'WEIGHT_BELOW_MINIMUM',
        message: 'Donor must weigh at least 45 kg; current weight is 40 kg.',
      }],
    };
    donorService.getDonorEligibility.mockResolvedValue(expected);

    const response = await request(app).get('/api/donors/DNR-00001/eligibility');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expected);
    expect(donorService.getDonorEligibility).toHaveBeenCalledWith('DNR-00001');
  });

  it('validates the donor ID before evaluating eligibility', async () => {
    const response = await request(app).get('/api/donors/not-a-donor/eligibility');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(donorService.getDonorEligibility).not.toHaveBeenCalled();
  });

  it('returns the standard donor not-found error response', async () => {
    donorService.getDonorEligibility.mockRejectedValue(
      new donorService.DonorError('NOT_FOUND', 'Donor not found', 404)
    );

    const response = await request(app).get('/api/donors/DNR-99999/eligibility');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Donor not found',
      requestId: 'test-request-id',
    });
  });
});
