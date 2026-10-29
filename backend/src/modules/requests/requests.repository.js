// C10 Request Service data access (SAD 3.4). All SQL is parameterised.
const { query } = require('../../database/db');

const REQUEST_COLUMNS = `request_id, requester_id, patient_name, blood_group, units,
  to_char(required_by_date, 'YYYY-MM-DD') AS required_by_date, hospital_name,
  contact_number, priority, status, rejection_reason, decided_by, decided_at, created_at`;

async function getToday(tx) {
  const { rows } = await tx.query(
    `SELECT to_char((NOW() AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS today`
  );
  return rows[0].today;
}

async function nextRequestId(tx) {
  await tx.query('SELECT pg_advisory_xact_lock($1)', [410940]);
  const { rows } = await tx.query(
    `SELECT request_id FROM blood_requests
      WHERE request_id ~ '^REQ-[0-9]{8}$'
      ORDER BY substring(request_id FROM 5)::BIGINT DESC
      LIMIT 1`
  );
  const current = rows.length ? Number(rows[0].request_id.slice(4)) : 0;
  if (current >= 99999999) {
    const err = new Error('Request ID pool exhausted');
    err.code = 'REQUEST_ID_POOL_EXHAUSTED';
    throw err;
  }
  return `REQ-${String(current + 1).padStart(8, '0')}`;
}

async function createRequest(tx, requestId, requesterId, request) {
  const { rows } = await tx.query(
    `INSERT INTO blood_requests
       (request_id, requester_id, patient_name, blood_group, units, required_by_date,
        hospital_name, contact_number, priority, status)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, 'Pending')
     RETURNING ${REQUEST_COLUMNS}`,
    [
      requestId,
      requesterId,
      request.patientName,
      request.bloodGroup,
      request.units,
      request.requiredByDate,
      request.hospitalName,
      request.contactNumber,
      request.priority,
    ]
  );
  return rows[0];
}

async function listRequestsForRequester(requesterId) {
  const { rows } = await query(
    `SELECT ${REQUEST_COLUMNS}
       FROM blood_requests
      WHERE requester_id = $1
      ORDER BY created_at DESC, request_id DESC`,
    [requesterId]
  );
  return rows;
}

async function listPendingRequests() {
  const { rows } = await query(
    `SELECT ${REQUEST_COLUMNS}
       FROM blood_requests
      WHERE status = 'Pending'
      ORDER BY CASE priority WHEN 'Urgent' THEN 0 ELSE 1 END,
               created_at ASC, request_id ASC`
  );
  return rows;
}

async function findRequestByIdForUpdate(tx, requestId) {
  const { rows } = await tx.query(
    `SELECT ${REQUEST_COLUMNS}
       FROM blood_requests
      WHERE request_id = $1
      FOR UPDATE`,
    [requestId]
  );
  return rows[0] || null;
}

async function reserveFefoUnits(tx, { requestId, bloodGroup, units }) {
  const { rows: candidates } = await tx.query(
    `SELECT unit_id
       FROM blood_units
      WHERE blood_group = $1
        AND status = 'Available'
        AND expiry_date > CURRENT_DATE
      ORDER BY expiry_date ASC, unit_id ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED`,
    [bloodGroup, units]
  );
  if (candidates.length < units) return null;

  const unitIds = candidates.map(({ unit_id: unitId }) => unitId);
  const { rows: reserved } = await tx.query(
    `UPDATE blood_units
        SET status = 'Reserved'
      WHERE unit_id = ANY($1) AND status = 'Available' AND expiry_date > CURRENT_DATE
      RETURNING unit_id`,
    [unitIds]
  );
  if (reserved.length !== units) return null;

  await tx.query(
    `INSERT INTO blood_request_units (request_id, unit_id)
     SELECT $1, unit_id FROM unnest($2::varchar[]) AS units(unit_id)`,
    [requestId, unitIds]
  );
  return unitIds;
}

async function updateRequestDecision(tx, requestId, { status, staffId, rejectionReason = null }) {
  const { rows } = await tx.query(
    `UPDATE blood_requests
        SET status = $2,
            rejection_reason = $3,
            decided_by = $4,
            decided_at = NOW()
      WHERE request_id = $1
      RETURNING ${REQUEST_COLUMNS}`,
    [requestId, status, rejectionReason, staffId]
  );
  return rows[0] || null;
}

async function listReservedUnitsForRequest(tx, requestId) {
  const { rows } = await tx.query(
    `SELECT unit.unit_id, unit.blood_group, unit.status, unit.expiry_date
       FROM blood_request_units request_unit
       JOIN blood_units unit ON unit.unit_id = request_unit.unit_id
      WHERE request_unit.request_id = $1
      ORDER BY unit.expiry_date ASC, unit.unit_id ASC
      FOR UPDATE OF unit`,
    [requestId]
  );
  return rows;
}

async function issueReservedUnits(tx, unitIds) {
  const { rows } = await tx.query(
    `UPDATE blood_units
        SET status = 'Issued'
      WHERE unit_id = ANY($1)
        AND status = 'Reserved'
        AND expiry_date > CURRENT_DATE
      RETURNING unit_id`,
    [unitIds]
  );
  return rows.map(({ unit_id: unitId }) => unitId);
}

async function findRequestForUpdate(tx, requestId, requesterId) {
  const { rows } = await tx.query(
    `SELECT ${REQUEST_COLUMNS}
       FROM blood_requests
      WHERE request_id = $1 AND requester_id = $2
      FOR UPDATE`,
    [requestId, requesterId]
  );
  return rows[0] || null;
}

async function cancelRequest(tx, requestId, requesterId) {
  const { rows } = await tx.query(
    `UPDATE blood_requests
        SET status = 'Cancelled'
      WHERE request_id = $1 AND requester_id = $2 AND status = 'Pending'
      RETURNING ${REQUEST_COLUMNS}`,
    [requestId, requesterId]
  );
  return rows[0] || null;
}

module.exports = {
  getToday,
  nextRequestId,
  createRequest,
  listRequestsForRequester,
  listPendingRequests,
  findRequestByIdForUpdate,
  reserveFefoUnits,
  updateRequestDecision,
  listReservedUnitsForRequest,
  issueReservedUnits,
  findRequestForUpdate,
  cancelRequest,
};
