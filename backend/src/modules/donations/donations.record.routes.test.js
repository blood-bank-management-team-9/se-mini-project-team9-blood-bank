const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => {
    req.session = { user: { userId: 'USR-STF01', role: 'Staff' } };
    return next();
  }),
}));

jest.mock('./donations.service', () => {
  class DonationError extends Error {
    constructor(code, publicMessage, status = 400) {
      super(publicMessage);
      this.code = code;
      this.status = status;
      this.publicMessage = publicMessage;
    }
  }
  return {
    DonationError,
    VOLUMES_ML: [350, 450],
    NOTES_MAX_LENGTH: 200,
    correctDonation: jest.fn(),
  };
});
jest.mock('./donations.record.service', () => ({ recordDonation: jest.fn() }));

const donationService = require('./donations.service');
const recordService = require('./donations.record.service');
const donationsRouter = require('./donations.routes');

const app = express();
app.use(express.json());
app.use((req, res, next) => { req.id = 'test-request-id'; next(); });
app.use('/api/donations', donationsRouter);

const valid = {
  donorId: 'DNR-00001',
  collectionDate: '2026-10-04',
  volumeMl: 350,
  screeningStatus: 'Passed',
};

describe('POST /api/donations', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['bad donor id', { donorId: 'X1' }],
    ['bad volume', { volumeMl: 400 }],
    ['volume sent as text', { volumeMl: '350' }],
    ['bad date', { collectionDate: '2026-02-31' }],
    ['date in wrong format', { collectionDate: '04-10-2026' }],
    ['bad screening status', { screeningStatus: 'Maybe' }],
    ['notes too long', { medicalNotes: 'x'.repeat(201) }],
    ['unknown field bloodGroup', { bloodGroup: 'O+' }],
    ['unknown field extraKey', { extraKey: 'value' }],
  ])('returns 400 for %s', async (label, override) => {
    const res = await request(app).post('/api/donations').send({ ...valid, ...override });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(recordService.recordDonation).not.toHaveBeenCalled();
  });

  it('accepts notes with whitespace padding that trims to at most 200 characters', async () => {
    recordService.recordDonation.mockResolvedValue({ donationId: 'DON-00000001' });
    const padded = '  ' + 'a'.repeat(198) + '  ';
    const res = await request(app).post('/api/donations').send({ ...valid, medicalNotes: padded });
    expect(res.status).toBe(201);
    expect(recordService.recordDonation).toHaveBeenCalledWith({
      actorUserId: 'USR-STF01',
      input: { ...valid, medicalNotes: 'a'.repeat(198) },
    });
  });

  it('returns 400 when a required field is missing', async () => {
    const rest = { ...valid };
    delete rest.donorId;
    const res = await request(app).post('/api/donations').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('records the donation and returns 201 with the unit', async () => {
    const dto = {
      donationId: 'DON-00000005', donationStatus: 'Recorded', unitId: 'UNT-10005', expiryDate: '2026-11-08',
    };
    recordService.recordDonation.mockResolvedValue(dto);
    const res = await request(app).post('/api/donations').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(dto);
    expect(recordService.recordDonation).toHaveBeenCalledWith({
      actorUserId: 'USR-STF01',
      input: { ...valid, medicalNotes: undefined },
    });
  });

  it('returns 422 NOT_ELIGIBLE with the reasons', async () => {
    const err = new donationService.DonationError('NOT_ELIGIBLE', 'Donor is not eligible to donate', 422);
    err.reasons = [{ code: 'DONATION_GAP_NOT_MET', message: 'Donor may donate again on 2026-12-30.' }];
    recordService.recordDonation.mockRejectedValue(err);
    const res = await request(app).post('/api/donations').send(valid);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_ELIGIBLE');
    expect(res.body.error.reasons).toEqual(err.reasons);
  });

  it('returns 404 for an unknown donor', async () => {
    recordService.recordDonation.mockRejectedValue(
      new donationService.DonationError('NOT_FOUND', 'Donor not found', 404)
    );
    const res = await request(app).post('/api/donations').send(valid);
    expect(res.status).toBe(404);
  });
});