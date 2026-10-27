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

const donationService = require('./donations.service');
const donationsRouter = require('./donations.routes');

const app = express();
app.use(express.json());
app.use((req, res, next) => { req.id = 'test-request-id'; next(); });
app.use('/api/donations', donationsRouter);

const url = '/api/donations/DON-00000001';

describe('PUT /api/donations/:donationId', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['bad volume', { volumeMl: 400 }],
    ['volume sent as text', { volumeMl: '350' }],
    ['bad date', { collectionDate: '2026-13-45' }],
    ['date in wrong format', { collectionDate: '05/10/2026' }],
    ['notes too long', { medicalNotes: 'x'.repeat(201) }],
  ])('returns 400 for %s', async (label, payload) => {
    const res = await request(app).put(url).send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(donationService.correctDonation).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed donation id', async () => {
    const res = await request(app).put('/api/donations/abc').send({ volumeMl: 350 });
    expect(res.status).toBe(400);
  });

  it('corrects the donation and passes the logged-in user as actor', async () => {
    const dto = { donationId: 'DON-00000001', volumeMl: 350, collectionDate: '2026-10-01', medicalNotes: null };
    donationService.correctDonation.mockResolvedValue(dto);
    const res = await request(app).put(url).send({ volumeMl: 350 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(dto);
    expect(donationService.correctDonation).toHaveBeenCalledWith({
      actorUserId: 'USR-STF01',
      donationId: 'DON-00000001',
      changes: { volumeMl: 350, collectionDate: undefined, medicalNotes: undefined },
    });
  });

  it('maps the closed 24 hour window to 403', async () => {
    donationService.correctDonation.mockRejectedValue(
      new donationService.DonationError('CORRECTION_WINDOW_CLOSED', 'Window closed', 403)
    );
    const res = await request(app).put(url).send({ volumeMl: 350 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORRECTION_WINDOW_CLOSED');
  });
});