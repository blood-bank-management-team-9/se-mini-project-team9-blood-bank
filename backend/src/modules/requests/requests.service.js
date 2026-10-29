// C10 Request Service business logic (SAD 3.4); HTTP mapping lives in routes.
const { withTransaction } = require('../../database/transaction');
const { logAudit } = require('../audit/audit.repository');
const repo = require('./requests.repository');
const { BLOOD_GROUPS } = require('../stock/stock.service');

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

async function listPendingRequests({ role }) {
  if (role !== 'Staff') {
    throw new RequestError('ACCESS_DENIED', 'Only Staff can view the pending request queue', 403);
  }
  const rows = await repo.listPendingRequests();
  return { requests: rows.map(toRequestDto), total: rows.length };
}

async function approveRequest({ staffId, role, requestId }) {
  if (role !== 'Staff') {
    throw new RequestError('ACCESS_DENIED', 'Only Staff can approve requests', 403);
  }

  return withTransaction(async (tx) => {
    const existing = await repo.findRequestByIdForUpdate(tx, requestId);
    if (!existing) throw new RequestError('NOT_FOUND', 'Request not found', 404);
    if (existing.status !== 'Pending') {
      throw new RequestError('REQUEST_NOT_APPROVABLE', 'Only pending requests can be approved', 409);
    }

    const reservedUnitIds = await repo.reserveFefoUnits(tx, {
      requestId,
      bloodGroup: existing.blood_group,
      units: existing.units,
    });
    if (!reservedUnitIds) {
      throw new RequestError(
        'INSUFFICIENT_STOCK',
        `Not enough unexpired ${existing.blood_group} units are available`,
        409
      );
    }

    const approved = await repo.updateRequestDecision(tx, requestId, {
      status: 'Approved',
      staffId,
    });
    await logAudit({
      userId: staffId,
      action: 'REQUEST_APPROVED',
      entity: 'blood_requests',
      entityId: requestId,
      originalValue: { status: existing.status },
      newValue: { status: approved.status, reservedUnitIds },
    }, tx);
    return { ...toRequestDto(approved), reservedUnitIds };
  });
}

async function rejectRequest({ staffId, role, requestId, reason }) {
  if (role !== 'Staff') {
    throw new RequestError('ACCESS_DENIED', 'Only Staff can reject requests', 403);
  }
  const rejectionReason = typeof reason === 'string' ? reason.trim() : '';
  if (!rejectionReason || rejectionReason.length > 100) {
    throw new RequestError('VALIDATION_ERROR', 'A rejection reason of 1 to 100 characters is required', 400);
  }

  return withTransaction(async (tx) => {
    const existing = await repo.findRequestByIdForUpdate(tx, requestId);
    if (!existing) throw new RequestError('NOT_FOUND', 'Request not found', 404);
    if (existing.status !== 'Pending') {
      throw new RequestError('REQUEST_NOT_REJECTABLE', 'Only pending requests can be rejected', 409);
    }

    const rejected = await repo.updateRequestDecision(tx, requestId, {
      status: 'Rejected',
      staffId,
      rejectionReason,
    });
    await logAudit({
      userId: staffId,
      action: 'REQUEST_REJECTED',
      entity: 'blood_requests',
      entityId: requestId,
      originalValue: { status: existing.status },
      newValue: { status: rejected.status, reason: rejectionReason },
    }, tx);
    return toRequestDto(rejected);
  });
}

async function issueRequest({
  staffId,
  role,
  requestId,
  recipientBloodGroup,
  confirmMatch,
}) {
  if (role !== 'Staff') {
    throw new RequestError('ACCESS_DENIED', 'Only Staff can issue requests', 403);
  }
  if (!BLOOD_GROUPS.includes(recipientBloodGroup)) {
    throw new RequestError('VALIDATION_ERROR', 'A valid recipient blood group is required', 400);
  }
  if (confirmMatch !== true) {
    throw new RequestError('MATCH_CONFIRMATION_REQUIRED', 'Recipient blood group match must be confirmed', 400);
  }

  return withTransaction(async (tx) => {
    const existing = await repo.findRequestByIdForUpdate(tx, requestId);
    if (!existing) throw new RequestError('NOT_FOUND', 'Request not found', 404);
    if (existing.status !== 'Approved') {
      throw new RequestError('REQUEST_NOT_ISSUABLE', 'Only approved requests can be issued', 409);
    }
    if (recipientBloodGroup !== existing.blood_group) {
      throw new RequestError(
        'BLOOD_GROUP_MISMATCH',
        'Recipient blood group does not match the request',
        409
      );
    }

    const units = await repo.listReservedUnitsForRequest(tx, requestId);
    if (
      units.length !== existing.units ||
      units.some((unit) => unit.status !== 'Reserved' || unit.blood_group !== existing.blood_group)
    ) {
      throw new RequestError('UNITS_NOT_ISSUABLE', 'Reserved units are no longer available for issue', 409);
    }

    const unitIds = units.map(({ unit_id: unitId }) => unitId);
    const updatedUnitIds = await repo.issueReservedUnits(tx, unitIds);
    const expectedUnitIds = new Set(unitIds);
    if (
      updatedUnitIds.length !== unitIds.length ||
      updatedUnitIds.some((unitId) => !expectedUnitIds.has(unitId))
    ) {
      throw new RequestError('UNITS_NOT_ISSUABLE', 'Reserved units are expired or no longer available', 409);
    }

    const issued = await repo.updateRequestDecision(tx, requestId, {
      status: 'Issued',
      staffId,
    });
    await logAudit({
      userId: staffId,
      action: 'REQUEST_ISSUED',
      entity: 'blood_requests',
      entityId: requestId,
      originalValue: { status: existing.status },
      newValue: {
        status: issued.status,
        recipientBloodGroup,
        unitIds,
      },
    }, tx);
    return { ...toRequestDto(issued), issuedUnitIds: unitIds };
  });
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
  listPendingRequests,
  approveRequest,
  rejectRequest,
  issueRequest,
  cancelMyRequest,
  RequestError,
};
