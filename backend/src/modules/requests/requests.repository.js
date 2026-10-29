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
  findRequestForUpdate,
  cancelRequest,
};
