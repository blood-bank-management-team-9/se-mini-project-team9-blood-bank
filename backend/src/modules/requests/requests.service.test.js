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
  listPendingRequests: jest.fn(),
  findRequestByIdForUpdate: jest.fn(),
  reserveFefoUnits: jest.fn(),
  updateRequestDecision: jest.fn(),
  listReservedUnitsForRequest: jest.fn(),
  issueReservedUnits: jest.fn(),
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

  it('lists the pending queue and delegates Urgent/FIFO ordering to the repository', async () => {
    repo.listPendingRequests.mockResolvedValue([requestRow()]);

    await expect(requestService.listPendingRequests({ role: 'Staff' })).resolves.toMatchObject({
      total: 1,
      requests: [expect.objectContaining({ requestId: 'REQ-00000002' })],
    });
    expect(repo.listPendingRequests).toHaveBeenCalledTimes(1);
  });

  it('allows only Staff to manage the request queue', async () => {
    await expect(requestService.listPendingRequests({ role: 'Admin' }))
      .rejects.toMatchObject({ code: 'ACCESS_DENIED', status: 403 });
    await expect(requestService.approveRequest({
      staffId: 'USR-ADM01',
      role: 'Admin',
      requestId: 'REQ-00000002',
    })).rejects.toMatchObject({ code: 'ACCESS_DENIED', status: 403 });
    await expect(requestService.rejectRequest({
      staffId: 'USR-HSP01',
      role: 'Hospital/Patient',
      requestId: 'REQ-00000002',
      reason: 'Rejected',
    })).rejects.toMatchObject({ code: 'ACCESS_DENIED', status: 403 });
    await expect(requestService.issueRequest({
      staffId: 'USR-ADM01',
      role: 'Admin',
      requestId: 'REQ-00000002',
      recipientBloodGroup: 'O+',
      confirmMatch: true,
    })).rejects.toMatchObject({ code: 'ACCESS_DENIED', status: 403 });
  });

  it('approves a pending request and reserves FEFO-selected units transactionally', async () => {
    repo.findRequestByIdForUpdate.mockResolvedValue(requestRow());
    repo.reserveFefoUnits.mockResolvedValue(['UNT-00002', 'UNT-00001']);
    repo.updateRequestDecision.mockResolvedValue(requestRow({
      status: 'Approved',
      decided_by: 'USR-STF01',
    }));

    await expect(requestService.approveRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
    })).resolves.toMatchObject({
      requestId: 'REQ-00000002',
      status: 'Approved',
      reservedUnitIds: ['UNT-00002', 'UNT-00001'],
    });

    expect(repo.reserveFefoUnits).toHaveBeenCalledWith(expect.any(Object), {
      requestId: 'REQ-00000002',
      bloodGroup: 'O+',
      units: 2,
    });
    expect(repo.updateRequestDecision).toHaveBeenCalledWith(expect.any(Object), 'REQ-00000002', {
      status: 'Approved',
      staffId: 'USR-STF01',
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REQUEST_APPROVED' }),
      expect.any(Object)
    );
  });

  it('leaves requests pending when there is insufficient unexpired stock', async () => {
    repo.findRequestByIdForUpdate.mockResolvedValue(requestRow());
    repo.reserveFefoUnits.mockResolvedValue(null);

    await expect(requestService.approveRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
    })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', status: 409 });
    expect(repo.updateRequestDecision).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('rejects only pending requests and records the mandatory reason', async () => {
    repo.findRequestByIdForUpdate.mockResolvedValue(requestRow());
    repo.updateRequestDecision.mockResolvedValue(requestRow({
      status: 'Rejected',
      rejection_reason: 'Stock unavailable',
    }));

    await expect(requestService.rejectRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
      reason: '  Stock unavailable  ',
    })).resolves.toMatchObject({
      status: 'Rejected',
      rejectionReason: 'Stock unavailable',
    });
    expect(repo.updateRequestDecision).toHaveBeenCalledWith(expect.any(Object), 'REQ-00000002', {
      status: 'Rejected',
      staffId: 'USR-STF01',
      rejectionReason: 'Stock unavailable',
    });
  });

  it('requires a rejection reason and rejects requests that are not pending', async () => {
    await expect(requestService.rejectRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
      reason: ' ',
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(repo.findRequestByIdForUpdate).not.toHaveBeenCalled();

    repo.findRequestByIdForUpdate.mockResolvedValue(requestRow({ status: 'Approved' }));
    await expect(requestService.rejectRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
      reason: 'Unavailable',
    })).rejects.toMatchObject({ code: 'REQUEST_NOT_REJECTABLE', status: 409 });
  });

  it('requires group confirmation and exact recipient/request group match before issue', async () => {
    await expect(requestService.issueRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
      recipientBloodGroup: 'O+',
      confirmMatch: false,
    })).rejects.toMatchObject({ code: 'MATCH_CONFIRMATION_REQUIRED', status: 400 });

    repo.findRequestByIdForUpdate.mockResolvedValue(requestRow({ status: 'Approved' }));
    await expect(requestService.issueRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
      recipientBloodGroup: 'A+',
      confirmMatch: true,
    })).rejects.toMatchObject({ code: 'BLOOD_GROUP_MISMATCH', status: 409 });
    expect(repo.listReservedUnitsForRequest).not.toHaveBeenCalled();
    expect(repo.issueReservedUnits).not.toHaveBeenCalled();
  });

  it('issues only matching reserved units and audits dispatch', async () => {
    repo.findRequestByIdForUpdate.mockResolvedValue(requestRow({ status: 'Approved' }));
    repo.listReservedUnitsForRequest.mockResolvedValue([
      { unit_id: 'UNT-00002', blood_group: 'O+', status: 'Reserved' },
      { unit_id: 'UNT-00001', blood_group: 'O+', status: 'Reserved' },
    ]);
    repo.issueReservedUnits.mockResolvedValue(['UNT-00002', 'UNT-00001']);
    repo.updateRequestDecision.mockResolvedValue(requestRow({
      status: 'Issued',
      decided_by: 'USR-STF01',
    }));

    await expect(requestService.issueRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
      recipientBloodGroup: 'O+',
      confirmMatch: true,
    })).resolves.toMatchObject({
      status: 'Issued',
      issuedUnitIds: ['UNT-00002', 'UNT-00001'],
    });
    expect(repo.issueReservedUnits).toHaveBeenCalledWith(expect.any(Object), [
      'UNT-00002',
      'UNT-00001',
    ]);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REQUEST_ISSUED' }),
      expect.any(Object)
    );
  });

  it('does not issue unavailable units or requests that are not approved', async () => {
    repo.findRequestByIdForUpdate.mockResolvedValue(requestRow({ status: 'Approved' }));
    repo.listReservedUnitsForRequest.mockResolvedValue([
      { unit_id: 'UNT-00001', blood_group: 'O+', status: 'Discarded' },
      { unit_id: 'UNT-00002', blood_group: 'O+', status: 'Reserved' },
    ]);
    await expect(requestService.issueRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
      recipientBloodGroup: 'O+',
      confirmMatch: true,
    })).rejects.toMatchObject({ code: 'UNITS_NOT_ISSUABLE', status: 409 });
    expect(repo.issueReservedUnits).not.toHaveBeenCalled();

    repo.findRequestByIdForUpdate.mockResolvedValue(requestRow({ status: 'Pending' }));
    await expect(requestService.issueRequest({
      staffId: 'USR-STF01',
      role: 'Staff',
      requestId: 'REQ-00000002',
      recipientBloodGroup: 'O+',
      confirmMatch: true,
    })).rejects.toMatchObject({ code: 'REQUEST_NOT_ISSUABLE', status: 409 });
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
