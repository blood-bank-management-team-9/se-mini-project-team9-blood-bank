jest.mock('../../database/transaction', () => ({
  withTransaction: jest.fn((callback) => callback({ query: jest.fn() })),
}));
jest.mock('../audit/audit.repository', () => ({
  logAudit: jest.fn(),
}));
jest.mock('./requests.repository', () => ({
  getToday: jest.fn(),
  nextRequestId: jest.fn(),
  createRequest: jest.fn(),
  listRequestsForRequester: jest.fn(),
  findRequestForUpdate: jest.fn(),
  cancelRequest: jest.fn(),
}));

const repo = require('./requests.repository');
const { logAudit } = require('../audit/audit.repository');
const requestService = require('./requests.service');

const requestRow = (overrides = {}) => ({
  request_id: 'REQ-00000002',
  requester_id: 'USR-HSP01',
  patient_name: 'Test Patient',
  blood_group: 'O+',
  units: 2,
  required_by_date: '2026-11-20',
  hospital_name: 'City Hospital',
  contact_number: '9876543213',
  priority: 'Urgent',
  status: 'Pending',
  rejection_reason: null,
  decided_by: null,
  decided_at: null,
  created_at: '2026-10-29T00:00:00.000Z',
  ...overrides,
});

const input = {
  patientName: 'Test Patient',
  bloodGroup: 'O+',
  units: 2,
  requiredByDate: '2026-11-20',
  hospitalName: 'City Hospital',
  contactNumber: '9876543213',
  priority: 'Urgent',
};

describe('Request service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a pending request with a generated ID and audit event', async () => {
    repo.getToday.mockResolvedValue('2026-10-29');
    repo.nextRequestId.mockResolvedValue('REQ-00000002');
    repo.createRequest.mockResolvedValue(requestRow());

    await expect(requestService.createRequest({
      requesterId: 'USR-HSP01',
      role: 'Hospital/Patient',
      request: input,
    })).resolves.toMatchObject({
      requestId: 'REQ-00000002',
      status: 'Pending',
      priority: 'Urgent',
    });

    expect(repo.createRequest).toHaveBeenCalledWith(
      expect.any(Object),
      'REQ-00000002',
      'USR-HSP01',
      input
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'USR-HSP01',
        action: 'REQUEST_SUBMITTED',
        entityId: 'REQ-00000002',
      }),
      expect.any(Object)
    );
  });

  it('rejects a request date in the past', async () => {
    repo.getToday.mockResolvedValue('2026-10-29');

    await expect(requestService.createRequest({
      requesterId: 'USR-HSP01',
      role: 'Hospital/Patient',
      request: { ...input, requiredByDate: '2026-10-28' },
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });
    expect(repo.nextRequestId).not.toHaveBeenCalled();
    expect(repo.createRequest).not.toHaveBeenCalled();
  });

  it('allows only Hospital/Patient accounts to submit, view, or cancel requests', async () => {
    await expect(requestService.createRequest({
      requesterId: 'USR-DNR01',
      role: 'Donor',
      request: input,
    })).rejects.toMatchObject({ code: 'ACCESS_DENIED', status: 403 });

    await expect(requestService.listMyRequests({
      requesterId: 'USR-DNR01',
      role: 'Donor',
    })).rejects.toMatchObject({ code: 'ACCESS_DENIED', status: 403 });

    await expect(requestService.cancelMyRequest({
      requesterId: 'USR-DNR01',
      role: 'Donor',
      requestId: 'REQ-00000002',
    })).rejects.toMatchObject({ code: 'ACCESS_DENIED', status: 403 });
  });

  it('lists only the authenticated requester’s requests', async () => {
    repo.listRequestsForRequester.mockResolvedValue([requestRow()]);

    await expect(requestService.listMyRequests({
      requesterId: 'USR-HSP01',
      role: 'Hospital/Patient',
    })).resolves.toMatchObject({
      total: 1,
      requests: [expect.objectContaining({ requestId: 'REQ-00000002' })],
    });
    expect(repo.listRequestsForRequester).toHaveBeenCalledWith('USR-HSP01');
  });

  it('cancels a pending request and audits its status transition', async () => {
    repo.findRequestForUpdate.mockResolvedValue(requestRow());
    repo.cancelRequest.mockResolvedValue(requestRow({ status: 'Cancelled' }));

    await expect(requestService.cancelMyRequest({
      requesterId: 'USR-HSP01',
      role: 'Hospital/Patient',
      requestId: 'REQ-00000002',
    })).resolves.toMatchObject({ requestId: 'REQ-00000002', status: 'Cancelled' });

    expect(repo.findRequestForUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      'REQ-00000002',
      'USR-HSP01'
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REQUEST_CANCELLED',
        originalValue: { status: 'Pending' },
        newValue: { status: 'Cancelled' },
      }),
      expect.any(Object)
    );
  });

  it('cannot cancel a request owned by another user or a non-pending request', async () => {
    repo.findRequestForUpdate.mockResolvedValue(null);
    await expect(requestService.cancelMyRequest({
      requesterId: 'USR-HSP01',
      role: 'Hospital/Patient',
      requestId: 'REQ-00000002',
    })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });

    repo.findRequestForUpdate.mockResolvedValue(requestRow({ status: 'Approved' }));
    await expect(requestService.cancelMyRequest({
      requesterId: 'USR-HSP01',
      role: 'Hospital/Patient',
      requestId: 'REQ-00000002',
    })).rejects.toMatchObject({ code: 'REQUEST_NOT_CANCELLABLE', status: 409 });
    expect(repo.cancelRequest).not.toHaveBeenCalled();
  });
});
