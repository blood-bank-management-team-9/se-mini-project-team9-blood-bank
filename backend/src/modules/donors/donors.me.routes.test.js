const express = require('express');
const request = require('supertest');

jest.mock('../audit/audit.repository', () => ({
  logAudit: jest.fn(),
}));
jest.mock('./donors.service', () => {
  class DonorError extends Error {
    constructor(code, publicMessage, status = 400) {
      super(publicMessage);
      this.code = code;
      this.publicMessage = publicMessage;
      this.status = status;
    }
  }
  return {
    DonorError,
    linkDonorAccount: jest.fn(),
    getOwnDonationHistory: jest.fn(),
  };
});

const donorService = require('./donors.service');
const donorsRouter = require('./donors.routes');

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.id = 'test-request-id';
    if (user) req.session = { user };
    next();
  });
  app.use('/api/donors', donorsRouter);
  return app;
}

describe('Donor self-service routes (FR-DON-06, FR-DON-08, BR-02)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('links the authenticated donor account and returns the associated donor ID', async () => {
    donorService.linkDonorAccount.mockResolvedValue({ donorId: 'DNR-00001' });
    const user = { userId: 'USR-DNR01', role: 'Donor' };

    const response = await request(buildApp(user)).post('/api/donors/me/link').send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ donorId: 'DNR-00001' });
    expect(donorService.linkDonorAccount).toHaveBeenCalledWith(user);
  });

  it('returns the authenticated donor account donation history', async () => {
    donorService.getOwnDonationHistory.mockResolvedValue({
      donorId: 'DNR-00001',
      donations: [],
      total: 0,
    });
    const user = { userId: 'USR-DNR01', role: 'Donor' };

    const response = await request(buildApp(user)).get('/api/donors/me/donations');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ donorId: 'DNR-00001', donations: [], total: 0 });
    expect(donorService.getOwnDonationHistory).toHaveBeenCalledWith('USR-DNR01', 'Donor');
  });

  it('requires authentication', async () => {
    const app = buildApp(null);

    const linkResponse = await request(app).post('/api/donors/me/link').send({});
    const historyResponse = await request(app).get('/api/donors/me/donations');

    expect(linkResponse.status).toBe(401);
    expect(historyResponse.status).toBe(401);
    expect(donorService.linkDonorAccount).not.toHaveBeenCalled();
    expect(donorService.getOwnDonationHistory).not.toHaveBeenCalled();
  });

  it.each(['Hospital/Patient', 'Staff', 'Admin'])('denies %s access', async (role) => {
    const app = buildApp({ userId: 'USR-OTHER01', role });

    const linkResponse = await request(app).post('/api/donors/me/link').send({});
    const historyResponse = await request(app).get('/api/donors/me/donations');

    expect(linkResponse.status).toBe(403);
    expect(historyResponse.status).toBe(403);
    expect(donorService.linkDonorAccount).not.toHaveBeenCalled();
    expect(donorService.getOwnDonationHistory).not.toHaveBeenCalled();
  });

  it('reports an account with no matching donor record', async () => {
    donorService.linkDonorAccount.mockRejectedValue(
      new donorService.DonorError(
        'DONOR_NOT_FOUND',
        'No donor record matches the phone number on your account',
        404
      )
    );

    const response = await request(buildApp({ userId: 'USR-DNR01', role: 'Donor' }))
      .post('/api/donors/me/link')
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('DONOR_NOT_FOUND');
  });
});
