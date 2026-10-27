// C11 Report Service — Data Access (SAD 3.4, 4.3, SRS 5.8)
// Parameterised SQL queries ($1..$n) with date range, group, and status filters.

const { query } = require('../../database/db');

// All 8 standard blood groups
const ALL_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// FR-RPT-01, FR-RPT-04: Stock report with aggregates and earliest expiry
async function getStockReport({ from, to, bloodGroup, status } = {}) {
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
    conditions.push(`collection_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`collection_date <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Aggregation per blood group
  const sql = `
    SELECT blood_group,
           COUNT(*) FILTER (WHERE status = 'Available' AND expiry_date > CURRENT_DATE)::int AS available,
           COUNT(*) FILTER (WHERE status = 'Reserved')::int AS reserved,
           COUNT(*) FILTER (WHERE status = 'Issued')::int AS issued,
           COUNT(*) FILTER (WHERE status = 'Expired' OR (status = 'Available' AND expiry_date <= CURRENT_DATE))::int AS expired,
           COUNT(*) FILTER (WHERE status = 'Discarded')::int AS discarded,
           MIN(expiry_date) FILTER (WHERE status = 'Available' AND expiry_date > CURRENT_DATE) AS earliest_expiry,
           COUNT(*)::int AS total
      FROM blood_units
      ${where}
     GROUP BY blood_group
     ORDER BY blood_group ASC
  `;

  const { rows } = await query(sql, params);

  // Unit detail records
  const unitsSql = `
    SELECT unit_id, blood_group, volume_ml, collection_date, expiry_date, status
      FROM blood_units
      ${where}
     ORDER BY expiry_date ASC, unit_id ASC
  `;
  const unitRows = (await query(unitsSql, params)).rows;

  return {
    aggregates: rows.map((r) => ({
      bloodGroup: r.blood_group,
      available: r.available,
      reserved: r.reserved,
      issued: r.issued,
      expired: r.expired,
      discarded: r.discarded,
      earliestExpiry: r.earliest_expiry
        ? (r.earliest_expiry instanceof Date ? r.earliest_expiry.toISOString().slice(0, 10) : String(r.earliest_expiry).slice(0, 10))
        : null,
      total: r.total,
    })),
    records: unitRows.map((u) => ({
      unitId: u.unit_id,
      bloodGroup: u.blood_group,
      volumeMl: u.volume_ml,
      collectionDate: u.collection_date instanceof Date ? u.collection_date.toISOString().slice(0, 10) : String(u.collection_date).slice(0, 10),
      expiryDate: u.expiry_date instanceof Date ? u.expiry_date.toISOString().slice(0, 10) : String(u.expiry_date).slice(0, 10),
      status: u.status,
    })),
    totalUnits: unitRows.length,
  };
}

// FR-RPT-02, FR-RPT-04: Donation report listing donations within a date range
async function getDonationReport({ from, to, bloodGroup, status } = {}) {
  const conditions = [];
  const params = [];

  if (bloodGroup) {
    params.push(bloodGroup);
    conditions.push(`blood_group = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`donation_status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`collection_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`collection_date <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT donation_id, donor_id, blood_group, volume_ml, collection_date, screening_status, donation_status, recorded_by
      FROM donations
      ${where}
     ORDER BY collection_date DESC, donation_id DESC
  `;

  const { rows } = await query(sql, params);

  return {
    records: rows.map((r) => ({
      donationId: r.donation_id,
      donorId: r.donor_id,
      bloodGroup: r.blood_group,
      volumeMl: r.volume_ml,
      collectionDate: r.collection_date instanceof Date ? r.collection_date.toISOString().slice(0, 10) : String(r.collection_date).slice(0, 10),
      screeningResult: r.screening_status,
      donationStatus: r.donation_status,
      recordedBy: r.recorded_by,
    })),
    totalDonations: rows.length,
    totalVolumeMl: rows.reduce((sum, r) => sum + (r.volume_ml || 0), 0),
  };
}

// FR-RPT-03, FR-RPT-04: Request report listing requests within a date range
async function getRequestReport({ from, to, bloodGroup, status } = {}) {
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
    conditions.push(`required_by_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`required_by_date <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT request_id, hospital_name, patient_name, blood_group, units, priority, status,
           created_at, decided_at, rejection_reason
      FROM blood_requests
      ${where}
     ORDER BY created_at DESC, request_id DESC
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
      requestDate: r.created_at instanceof Date ? r.created_at.toISOString().slice(0, 10) : String(r.created_at).slice(0, 10),
      decisionDate: r.decided_at ? (r.decided_at instanceof Date ? r.decided_at.toISOString().slice(0, 10) : String(r.decided_at).slice(0, 10)) : null,
      rejectionReason: r.rejection_reason,
    })),
    totalRequests: rows.length,
    totalUnitsRequested: rows.reduce((sum, r) => sum + (r.units || 0), 0),
  };
}

module.exports = {
  getStockReport,
  getDonationReport,
  getRequestReport,
  ALL_BLOOD_GROUPS,
};
