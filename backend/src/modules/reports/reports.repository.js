// C11 Report Service — Data Access (SAD 3.4, 4.3, SRS 5.8)
// Parameterised SQL queries ($1..$n) with date range, group, and status filters.

const { query } = require('../../database/db');
const { VALID_BLOOD_GROUPS } = require('../../config/constants');

// Helper to build WHERE conditions for stock queries
function buildStockFilters({ from, to, bloodGroup } = {}) {
  const conditions = [];
  const params = [];

  if (bloodGroup) {
    params.push(bloodGroup);
    conditions.push(`blood_group = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`collection_date >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conditions.push(`collection_date <= $${params.length}::date`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// FR-RPT-01, FR-RPT-04: Stock report with aggregates and earliest expiry
// Aggregates represent inventory counts per group for the date range;
// unit records filter further by status if specified.
async function getStockReport({ from, to, bloodGroup, status } = {}) {
  const { where: aggWhere, params: aggParams } = buildStockFilters({ from, to, bloodGroup });

  // Aggregation per blood group (counts across all statuses for this group/date range)
  const sql = `
    SELECT blood_group,
           COUNT(*) FILTER (WHERE status = 'Available' AND expiry_date > CURRENT_DATE)::int AS available,
           COUNT(*) FILTER (WHERE status = 'Reserved')::int AS reserved,
           COUNT(*) FILTER (WHERE status = 'Issued')::int AS issued,
           COUNT(*) FILTER (WHERE status = 'Expired' OR (status = 'Available' AND expiry_date <= CURRENT_DATE))::int AS expired,
           COUNT(*) FILTER (WHERE status = 'Discarded')::int AS discarded,
           TO_CHAR(MIN(expiry_date) FILTER (WHERE status = 'Available' AND expiry_date > CURRENT_DATE), 'YYYY-MM-DD') AS earliest_expiry,
           COUNT(*)::int AS total
      FROM blood_units
      ${aggWhere}
     GROUP BY blood_group
     ORDER BY blood_group ASC
  `;

  const { rows } = await query(sql, aggParams);

  // Unit detail records (can be filtered by status)
  const unitConditions = [];
  const unitParams = [];

  if (bloodGroup) {
    unitParams.push(bloodGroup);
    unitConditions.push(`blood_group = $${unitParams.length}`);
  }
  if (from) {
    unitParams.push(from);
    unitConditions.push(`collection_date >= $${unitParams.length}::date`);
  }
  if (to) {
    unitParams.push(to);
    unitConditions.push(`collection_date <= $${unitParams.length}::date`);
  }
  if (status) {
    if (status === 'Expired') {
      unitConditions.push(`(status = 'Expired' OR (status = 'Available' AND expiry_date <= CURRENT_DATE))`);
    } else {
      unitParams.push(status);
      unitConditions.push(`status = $${unitParams.length}`);
    }
  }

  const unitWhere = unitConditions.length > 0 ? `WHERE ${unitConditions.join(' AND ')}` : '';
  const unitsSql = `
    SELECT unit_id, blood_group, volume_ml,
           TO_CHAR(collection_date, 'YYYY-MM-DD') AS collection_date,
           TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date,
           CASE
             WHEN status = 'Available' AND expiry_date <= CURRENT_DATE THEN 'Expired'
             ELSE status
           END AS status
      FROM blood_units
      ${unitWhere}
     ORDER BY expiry_date ASC, unit_id ASC
     LIMIT 500
  `;
  const unitRows = (await query(unitsSql, unitParams)).rows;

  return {
    aggregates: rows.map((r) => ({
      bloodGroup: r.blood_group,
      available: r.available,
      reserved: r.reserved,
      issued: r.issued,
      expired: r.expired,
      discarded: r.discarded,
      earliestExpiry: r.earliest_expiry || null,
      total: r.total,
    })),
    records: unitRows.map((u) => ({
      unitId: u.unit_id,
      bloodGroup: u.blood_group,
      volumeMl: u.volume_ml,
      collectionDate: u.collection_date,
      expiryDate: u.expiry_date,
      status: u.status,
    })),
    totalUnits: unitRows.length,
  };
}

// Helper for donation report filters
function buildDonationFilters({ from, to, bloodGroup, status } = {}) {
  const conditions = [];
  const params = [];

  if (bloodGroup) {
    params.push(bloodGroup);
    conditions.push(`blood_group = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`screening_status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`collection_date >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conditions.push(`collection_date <= $${params.length}::date`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// FR-RPT-02, FR-RPT-04: Donation report listing donations within a date range
async function getDonationReport({ from, to, bloodGroup, status } = {}) {
  const { where, params } = buildDonationFilters({ from, to, bloodGroup, status });

  const sql = `
    SELECT d.donation_id, d.donor_id, dn.full_name AS donor_name,
           TO_CHAR(d.collection_date, 'YYYY-MM-DD') AS collection_date,
           d.volume_ml, d.blood_group, d.screening_status, d.donation_status,
           d.recorded_by,
           TO_CHAR(d.created_at, 'YYYY-MM-DD') AS recorded_at
      FROM donations d
      LEFT JOIN donors dn ON d.donor_id = dn.donor_id
      ${where}
     ORDER BY d.collection_date DESC, d.donation_id DESC
     LIMIT 500
  `;

  const { rows } = await query(sql, params);

  return {
    records: rows.map((r) => ({
      donationId: r.donation_id,
      donorId: r.donor_id,
      donorName: r.donor_name || 'Anonymous',
      collectionDate: r.collection_date,
      volumeMl: r.volume_ml,
      bloodGroup: r.blood_group,
      screeningStatus: r.screening_status,
      donationStatus: r.donation_status,
      recordedBy: r.recorded_by,
      recordedAt: r.recorded_at,
    })),
    totalDonations: rows.length,
    totalVolumeMl: rows.reduce((sum, r) => sum + (r.volume_ml || 0), 0),
  };
}

// Helper for request report filters
function buildRequestFilters({ from, to, bloodGroup, status } = {}) {
  const conditions = [];
  const params = [];

  if (bloodGroup) {
    params.push(bloodGroup);
    conditions.push(`blood_group = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`created_at >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conditions.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// FR-RPT-03, FR-RPT-04: Request report listing requests within a date range
async function getRequestReport({ from, to, bloodGroup, status } = {}) {
  const { where, params } = buildRequestFilters({ from, to, bloodGroup, status });

  const sql = `
    SELECT request_id, hospital_name, patient_name, blood_group, units, priority, status,
           TO_CHAR(created_at, 'YYYY-MM-DD') AS request_date,
           TO_CHAR(decided_at, 'YYYY-MM-DD') AS decision_date,
           rejection_reason
      FROM blood_requests
      ${where}
     ORDER BY created_at DESC, request_id DESC
     LIMIT 500
  `;

  const { rows } = await query(sql, params);

  return {
    records: rows.map((r) => ({
      requestId: r.request_id,
      hospitalName: r.hospital_name,
      patientName: r.patient_name,
      bloodGroup: r.blood_group,
      units: r.units,
      priority: r.priority,
      status: r.status,
      requestDate: r.request_date,
      decisionDate: r.decision_date || null,
      rejectionReason: r.rejection_reason || null,
    })),
    totalRequests: rows.length,
    totalUnitsRequested: rows.reduce((sum, r) => sum + (r.units || 0), 0),
  };
}

module.exports = {
  getStockReport,
  getDonationReport,
  getRequestReport,
  buildStockFilters,
  buildDonationFilters,
  buildRequestFilters,
  ALL_BLOOD_GROUPS: VALID_BLOOD_GROUPS,
};
