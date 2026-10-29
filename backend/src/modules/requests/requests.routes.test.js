const express = require('express');
const request = require('supertest');

jest.mock('../audit/audit.repository', () => ({ logAudit: jest.fn() }));
jest.mock('./requests.service', () => {
  class RequestError extends Error {
    constructor(code, publicMessage, status = 400) {
      super(publicMessage);
      this.code = code;
      this.publicMessage = publicMessage;
      this.status = status;
    }
  }
  return {
    RequestError,
    createRequest: jest.fn(),
    listMyRequests: jest.fn(),
    listPendingRequests: jest.fn(),
    approveRequest: jest.fn(),
    rejectRequest: jest.fn(),
    issueRequest: jest.fn(),
    cancelMyRequest: jest.fn(),
  };
});

const requestService = require('./requests.service');
const requestsRouter = require('./requests.routes');

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.id = 'test-request-id';
    if (user) req.session = { user };
    next();
  });
  app.use('/api/requests', requestsRouter);
  return app;
}

const validRequest = {
  patientName: 'Test Patient',
  bloodGroup: 'O+',
  units: 2,
  requiredByDate: '2026-11-20',
  hospitalName: 'City Hospital',
  contactNumber: '9876543213',
  priority: 'Urgent',
};

describe('Request routes (FR-REQ-01/02/03/04/05/06/07/08, BR-02/04/05/06)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits a validated request for the authenticated requester', async () => {
    const user = { userId: 'USR-HSP01', role: 'Hospital/Patient' };
    requestService.createRequest.mockResolvedValue({ requestId: 'REQ-00000001', status: 'Pending' });

    const response = await request(buildApp(user)).post('/api/requests').send(validRequest);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ requestId: 'REQ-00000001', status: 'Pending' });
    expect(requestService.createRequest).toHaveBeenCalledWith({
      requesterId: 'USR-HSP01',
      role: 'Hospital/Patient',
      request: validRequest,
    });
  });

  it.each([
    ['invalid blood group', { bloodGroup: 'X+' }],
    ['units below minimum', { units: 0 }],
    ['fractional units', { units: 1.5 }],
    ['units above maximum', { units: 11 }],
    ['invalid required-by date', { requiredByDate: '2026-02-31' }],
    ['invalid contact number', { contactNumber: '123' }],
    ['invalid priority', { priority: 'High' }],
    ['unknown field', { requesterId: 'USR-OTHER' }],
  ])('rejects %s', async (label, override) => {
    const response = await request(buildApp({
      userId: 'USR-HSP01',
      role: 'Hospital/Patient',
    })).post('/api/requests').send({ ...validRequest, ...override });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(requestService.createRequest).not.toHaveBeenCalled();
  });

  it('lists and cancels requests using the authenticated requester identity', async () => {
    const user = { userId: 'USR-HSP01', role: 'Hospital/Patient' };
    requestService.listMyRequests.mockResolvedValue({ requests: [], total: 0 });
    requestService.cancelMyRequest.mockResolvedValue({ requestId: 'REQ-00000001', status: 'Cancelled' });
    const app = buildApp(user);

    const listResponse = await request(app).get('/api/requests/mine');
    const cancelResponse = await request(app).patch('/api/requests/REQ-00000001/cancel');

    expect(listResponse.status).toBe(200);
    expect(requestService.listMyRequests).toHaveBeenCalledWith({
      requesterId: 'USR-HSP01',
      role: 'Hospital/Patient',
    });
    expect(cancelResponse.status).toBe(200);
    expect(requestService.cancelMyRequest).toHaveBeenCalledWith({
      requesterId: 'USR-HSP01',
      role: 'Hospital/Patient',
      requestId: 'REQ-00000001',
    });
  });

  it('requires authentication and denies non-requester roles', async () => {
    const unauthenticated = buildApp(null);
    const donor = buildApp({ userId: 'USR-DNR01', role: 'Donor' });

    const unauthenticatedResponse = await request(unauthenticated).get('/api/requests/mine');
    const forbiddenResponse = await request(donor).get('/api/requests/mine');

    expect(unauthenticatedResponse.status).toBe(401);
    expect(forbiddenResponse.status).toBe(403);
    expect(requestService.listMyRequests).not.toHaveBeenCalled();
  });

  it('serves the pending queue and routes staff decisions with the authenticated staff ID', async () => {
    const app = buildApp({ userId: 'USR-STF01', role: 'Staff' });
    requestService.listPendingRequests.mockResolvedValue({ requests: [], total: 0 });
    requestService.approveRequest.mockResolvedValue({ requestId: 'REQ-00000001', status: 'Approved' });
    requestService.rejectRequest.mockResolvedValue({ requestId: 'REQ-00000001', status: 'Rejected' });
    requestService.issueRequest.mockResolvedValue({ requestId: 'REQ-00000001', status: 'Issued' });

    const queue = await request(app).get('/api/requests/pending');
    const approval = await request(app).patch('/api/requests/REQ-00000001/approve');
    const rejection = await request(app)
      .patch('/api/requests/REQ-00000001/reject')
      .send({ reason: 'Stock unavailable' });
    const issue = await request(app)
      .patch('/api/requests/REQ-00000001/issue')
      .send({ recipientBloodGroup: 'O+', confirmMatch: true });

    expect(queue.status).toBe(200);
    expect(requestService.listPendingRequests).toHaveBeenCalledWith({ role: 'Staff' });
    expect(approval.status).toBe(200);
    expect(requestService.approveRequest).toHaveBeenCalledWith({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000001',
    });
    expect(rejection.status).toBe(200);
    expect(requestService.rejectRequest).toHaveBeenCalledWith({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000001',
      reason: 'Stock unavailable',
    });
    expect(issue.status).toBe(200);
    expect(requestService.issueRequest).toHaveBeenCalledWith({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000001',
      recipientBloodGroup: 'O+',
      confirmMatch: true,
    });
  });

  it('requires a rejection reason and explicit recipient group confirmation', async () => {
    const app = buildApp({ userId: 'USR-STF01', role: 'Staff' });

    const reject = await request(app).patch('/api/requests/REQ-00000001/reject').send({});
    const issue = await request(app).patch('/api/requests/REQ-00000001/issue')
      .send({ recipientBloodGroup: 'O+', confirmMatch: false });

    expect(reject.status).toBe(400);
    expect(issue.status).toBe(400);
    expect(requestService.rejectRequest).not.toHaveBeenCalled();
    expect(requestService.issueRequest).not.toHaveBeenCalled();
  });

  it('restricts queue and decision routes to Staff', async () => {
    const hospital = buildApp({ userId: 'USR-HSP01', role: 'Hospital/Patient' });

    const queue = await request(hospital).get('/api/requests/pending');
    const approval = await request(hospital).patch('/api/requests/REQ-00000001/approve');
    const rejection = await request(hospital)
      .patch('/api/requests/REQ-00000001/reject')
      .send({ reason: 'Rejected' });
    const issue = await request(hospital)
      .patch('/api/requests/REQ-00000001/issue')
      .send({ recipientBloodGroup: 'O+', confirmMatch: true });

    expect(queue.status).toBe(403);
    expect(approval.status).toBe(403);
    expect(rejection.status).toBe(403);
    expect(issue.status).toBe(403);
    expect(requestService.listPendingRequests).not.toHaveBeenCalled();
    expect(requestService.approveRequest).not.toHaveBeenCalled();
    expect(requestService.rejectRequest).not.toHaveBeenCalled();
    expect(requestService.issueRequest).not.toHaveBeenCalled();
  });
});
