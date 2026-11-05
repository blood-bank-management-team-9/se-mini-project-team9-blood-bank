jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => next()),
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
    listDonors: jest.fn(),
    createDonor: jest.fn(),
    getDonor: jest.fn(),
    getDonorEligibility: jest.fn(),
    updateDonor: jest.fn(),
    setDonorStatus: jest.fn(),
  };
});

const express = require('express');
const request = require('supertest');
const service = require('./donors.service');
const router = require('./donors.routes');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = { user: { userId: 'USR-STF01' } };
  req.id = 'test-request-id';
  next();
});
app.use('/api/donors', router);
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

const validDonor = () => ({
  fullName: 'Test Donor',
  dob: '1990-04-12',
  gender: 'Female',
  bloodGroup: 'O+',
  weightKg: 58,
  phone: '9876501234',
  email: 'donor@example.com',
  address: 'Test Road',
  city: 'Bangalore',
  pinCode: '560001',
});

describe('donors.routes unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists donors successfully', async () => {
    service.listDonors.mockResolvedValue({ donors: [], total: 0 });

    const response = await request(app).get('/api/donors');

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
    expect(service.listDonors).toHaveBeenCalledWith({
      status: undefined,
      bloodGroup: undefined,
      q: undefined,
    });
  });

  it('rejects invalid donor-list filters', async () => {
    const response = await request(app).get('/api/donors?status=Unknown');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.listDonors).not.toHaveBeenCalled();
  });

  it('creates a donor successfully', async () => {
    service.createDonor.mockResolvedValue({ donorId: 'DNR-00001' });

    const response = await request(app)
      .post('/api/donors')
      .send(validDonor());

    expect(response.status).toBe(201);
    expect(response.body.donorId).toBe('DNR-00001');
    expect(service.createDonor).toHaveBeenCalledWith({
      actorUserId: 'USR-STF01',
      donor: expect.objectContaining({ fullName: 'Test Donor' }),
    });
  });

  it('rejects invalid donor registration fields', async () => {
    const response = await request(app)
      .post('/api/donors')
      .send({ ...validDonor(), bloodGroup: 'X+', phone: '123' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.createDonor).not.toHaveBeenCalled();
  });

  it('returns a donor successfully', async () => {
    service.getDonor.mockResolvedValue({ donorId: 'DNR-00001' });

    const response = await request(app).get('/api/donors/DNR-00001');

    expect(response.status).toBe(200);
    expect(response.body.donorId).toBe('DNR-00001');
  });

  it('rejects an invalid donor ID', async () => {
    const response = await request(app).get('/api/donors/invalid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.getDonor).not.toHaveBeenCalled();
  });

  it('returns donor eligibility successfully', async () => {
    service.getDonorEligibility.mockResolvedValue({ eligible: true });

    const response = await request(app).get('/api/donors/DNR-00001/eligibility');

    expect(response.status).toBe(200);
    expect(response.body.eligible).toBe(true);
  });

  it('updates a donor successfully', async () => {
    service.updateDonor.mockResolvedValue({ donorId: 'DNR-00001' });

    const response = await request(app)
      .put('/api/donors/DNR-00001')
      .send(validDonor());

    expect(response.status).toBe(200);
    expect(service.updateDonor).toHaveBeenCalledWith({
      actorUserId: 'USR-STF01',
      donorId: 'DNR-00001',
      donor: expect.objectContaining({ fullName: 'Test Donor' }),
    });
  });

  it('updates donor status successfully', async () => {
    service.setDonorStatus.mockResolvedValue({
      donorId: 'DNR-00001',
      status: 'Inactive',
    });

    const response = await request(app)
      .patch('/api/donors/DNR-00001/status')
      .send({ status: 'Inactive' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Inactive');
  });

  it('maps DonorError to its HTTP response', async () => {
    service.getDonor.mockRejectedValue(
      new service.DonorError('NOT_FOUND', 'Donor not found', 404)
    );

    const response = await request(app).get('/api/donors/DNR-00001');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Donor not found',
      requestId: 'test-request-id',
    });
  });

  it('forwards unexpected errors to Express error middleware', async () => {
    service.listDonors.mockRejectedValue(new Error('Unexpected failure'));

    const response = await request(app).get('/api/donors');

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Unexpected failure');
  });
});

describe('donors.routes additional branch coverage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a donor when optional email and address are omitted', async () => {
    service.createDonor.mockResolvedValue({ donorId: 'DNR-00002' });
    const donor = validDonor();
    delete donor.email;
    delete donor.address;

    const response = await request(app).post('/api/donors').send(donor);

    expect(response.status).toBe(201);
    expect(service.createDonor).toHaveBeenCalled();
  });

  it('maps service errors from donor listing', async () => {
    service.listDonors.mockRejectedValue(
      new service.DonorError('NOT_FOUND', 'No donors found', 404)
    );
    const response = await request(app).get('/api/donors');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('maps service errors from donor creation', async () => {
    service.createDonor.mockRejectedValue(
      new service.DonorError('ACCOUNT_EXISTS', 'Duplicate donor', 409)
    );
    const response = await request(app).post('/api/donors').send(validDonor());
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ACCOUNT_EXISTS');
  });

  it('maps service errors from eligibility lookup', async () => {
    service.getDonorEligibility.mockRejectedValue(
      new service.DonorError('NOT_FOUND', 'Donor not found', 404)
    );
    const response = await request(app).get('/api/donors/DNR-00001/eligibility');
    expect(response.status).toBe(404);
  });

  it('maps service errors from donor update', async () => {
    service.updateDonor.mockRejectedValue(
      new service.DonorError('NOT_FOUND', 'Donor not found', 404)
    );
    const response = await request(app)
      .put('/api/donors/DNR-00001')
      .send(validDonor());
    expect(response.status).toBe(404);
  });

  it('maps service errors from donor status update', async () => {
    service.setDonorStatus.mockRejectedValue(
      new service.DonorError('NOT_FOUND', 'Donor not found', 404)
    );
    const response = await request(app)
      .patch('/api/donors/DNR-00001/status')
      .send({ status: 'Inactive' });
    expect(response.status).toBe(404);
  });
});

it('rejects a donor date of birth in the future', async () => {
  const futureDate = new Date(Date.now() + 86400000)
    .toISOString()
    .slice(0, 10);

  const response = await request(app)
    .post('/api/donors')
    .send({ ...validDonor(), dob: futureDate });

  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expect(service.createDonor).not.toHaveBeenCalled();
});
