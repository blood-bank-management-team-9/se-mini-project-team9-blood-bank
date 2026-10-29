// C10 Request Service business logic (SAD 3.4); HTTP mapping lives in routes.
const { withTransaction } = require('../../database/transaction');
const { logAudit } = require('../audit/audit.repository');
const repo = require('./requests.repository');

class RequestError extends Error {
  constructor(code, publicMessage, status = 400) {
    super(publicMessage);
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

function toRequestDto(row) {
  return {
    requestId: row.request_id,
    patientName: row.patient_name,
    bloodGroup: row.blood_group,
    units: row.units,
    requiredByDate: row.required_by_date,
    hospitalName: row.hospital_name,
    contactNumber: row.contact_number,
    priority: row.priority,
    status: row.status,
    rejectionReason: row.rejection_reason,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

async function createRequest({ requesterId, role, request }) {
  if (role !== 'Hospital/Patient') {
    throw new RequestError('ACCESS_DENIED', 'Only Hospital/Patient accounts can submit requests', 403);
  }

  return withTransaction(async (tx) => {
    const today = await repo.getToday(tx);
    if (request.requiredByDate < today) {
      throw new RequestError('VALIDATION_ERROR', 'Required-by date cannot be in the past', 400);
    }

    const requestId = await repo.nextRequestId(tx);
    const created = await repo.createRequest(tx, requestId, requesterId, request);
    await logAudit({
      userId: requesterId,
      action: 'REQUEST_SUBMITTED',
      entity: 'blood_requests',
      entityId: requestId,
      newValue: {
        bloodGroup: created.blood_group,
        units: created.units,
        priority: created.priority,
        status: created.status,
      },
    }, tx);
    return toRequestDto(created);
  });
}

async function listMyRequests({ requesterId, role }) {
  if (role !== 'Hospital/Patient') {
    throw new RequestError('ACCESS_DENIED', 'Only Hospital/Patient accounts can view their requests', 403);
  }
  const rows = await repo.listRequestsForRequester(requesterId);
  return { requests: rows.map(toRequestDto), total: rows.length };
}

async function cancelMyRequest({ requesterId, role, requestId }) {
  if (role !== 'Hospital/Patient') {
    throw new RequestError('ACCESS_DENIED', 'Only Hospital/Patient accounts can cancel requests', 403);
  }

  return withTransaction(async (tx) => {
    const existing = await repo.findRequestForUpdate(tx, requestId, requesterId);
    if (!existing) throw new RequestError('NOT_FOUND', 'Request not found', 404);
    if (existing.status !== 'Pending') {
      throw new RequestError('REQUEST_NOT_CANCELLABLE', 'Only pending requests can be cancelled', 409);
    }

    const cancelled = await repo.cancelRequest(tx, requestId, requesterId);
    if (!cancelled) {
      throw new RequestError('REQUEST_NOT_CANCELLABLE', 'Only pending requests can be cancelled', 409);
    }
    await logAudit({
      userId: requesterId,
      action: 'REQUEST_CANCELLED',
      entity: 'blood_requests',
      entityId: requestId,
      originalValue: { status: existing.status },
      newValue: { status: cancelled.status },
    }, tx);
    return toRequestDto(cancelled);
  });
}

module.exports = {
  createRequest,
  listMyRequests,
  cancelMyRequest,
  RequestError,
};
