// C7 Search Service — Data Access (SAD 3.4, 4.3, SRS 5.4)
// Parameterised SQL queries ($1..$n). No string interpolation.

const { query } = require('../../database/db');
const { getEligibilityConfig } = require('../donors/donors.repository');

// Stock search: returns Available units with expiry_date > CURRENT_DATE (FR-SRCH-01)
// Uses TO_CHAR(expiry_date, 'YYYY-MM-DD') to prevent timezone shifting.
async function searchStockByGroup(bloodGroup) {
  const result = await query(
    `SELECT unit_id, TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date
       FROM blood_units
      WHERE status = 'Available'
        AND expiry_date > CURRENT_DATE
        AND blood_group = $1
      ORDER BY expiry_date ASC, unit_id ASC`,
    [bloodGroup]
  );
  return result.rows;
}

// Helper to construct query conditions & parameters using system_config
// Exported for pure unit testing without requiring an active database.
function buildDonorSearchQuery({ bloodGroup, city, pin, config = {} } = {}) {
  const minAge = Number(config.eligibility_min_age) || 18;
  const maxAge = Number(config.eligibility_max_age) || 65;
  const minWeightKg = Number(config.eligibility_min_weight_kg) || 45;
  const maleGapDays = Number(config.eligibility_gap_days_male) || 90;
  const otherGapDays = Number(config.eligibility_gap_days_other) || 120;

  const conditions = [
    `status = 'Active'`,
    `weight_kg >= $1`,
    `date_of_birth <= CURRENT_DATE - ($2 || ' years')::INTERVAL`,
    `date_of_birth > CURRENT_DATE - ($3 || ' years')::INTERVAL`,
    `((gender = 'Male' AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - ($4 || ' days')::INTERVAL))
      OR (gender != 'Male' AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - ($5 || ' days')::INTERVAL)))`,
  ];

  // Pass config params as initial bind parameters
  // $1: minWeightKg, $2: minAge, $3: maxAge + 1 (inclusive boundary), $4: maleGapDays, $5: otherGapDays
  const params = [minWeightKg, minAge, maxAge + 1, maleGapDays, otherGapDays];

  if (bloodGroup) {
    params.push(bloodGroup);
    conditions.push(`blood_group = $${params.length}`);
  }
  if (city) {
    // Escape SQL wildcards % and _ to prevent user-injected pattern matching
    const escapedCity = city.trim().replace(/[%_\\]/g, '\\$&');
    params.push(`%${escapedCity}%`);
    conditions.push(`city ILIKE $${params.length}`);
  }
  if (pin) {
    params.push(pin.trim());
    conditions.push(`pin_code = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  return { where, params };
}

// Donor search: Active and Eligible donors only (FR-SRCH-03, FR-DON-04, BR-03)
// Paged at 20 per page (FR-SRCH-06).
async function searchEligibleDonors({ bloodGroup, city, pin, page = 1, limit = 20 }) {
  let config = {};
  try {
    config = await getEligibilityConfig();
  } catch (err) {
    // Fall back to default config if system_config table is not populated yet
    config = {};
  }

  const { where, params } = buildDonorSearchQuery({ bloodGroup, city, pin, config });

  // Total eligible matching count
  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM donors ${where}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  // Pagination (FR-SRCH-06: 20 per page)
  const offset = (page - 1) * limit;
  const pageParams = [...params, limit, offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const dataRes = await query(
    `SELECT donor_id, full_name, blood_group, city, phone,
            TO_CHAR(last_donation_date, 'YYYY-MM-DD') AS last_donation_date
       FROM donors
       ${where}
      ORDER BY donor_id ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    pageParams
  );

  return {
    donors: dataRes.rows.map((row) => ({
      donorId: row.donor_id,
      name: row.full_name,
      bloodGroup: row.blood_group,
      city: row.city,
      phone: row.phone,
      lastDonationDate: row.last_donation_date || null,
    })),
    total,
  };
}

module.exports = {
  searchStockByGroup,
  searchEligibleDonors,
  buildDonorSearchQuery,
};
