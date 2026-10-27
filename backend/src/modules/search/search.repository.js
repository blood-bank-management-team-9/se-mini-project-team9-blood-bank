// C7 Search Service — Data Access (SAD 3.4, 4.3, SRS 5.4)
// Parameterised SQL queries ($1..$n). No string interpolation.

const { query } = require('../../database/db');

// Stock search: returns Available units with expiry_date > CURRENT_DATE (FR-SRCH-01)
// Ordered by earliest expiry date first (FEFO-friendly)
async function searchStockByGroup(bloodGroup) {
  const result = await query(
    `SELECT unit_id, expiry_date
       FROM blood_units
      WHERE status = 'Available'
        AND expiry_date > CURRENT_DATE
        AND blood_group = $1
      ORDER BY expiry_date ASC, unit_id ASC`,
    [bloodGroup]
  );
  return result.rows;
}

// Donor search: Active and Eligible donors only (FR-SRCH-03, FR-DON-04, BR-03)
// Returns Donor ID, name, blood group, city, phone and last donation date.
// Paged at 20 per page (FR-SRCH-06).
async function searchEligibleDonors({ bloodGroup, city, pin, page = 1, limit = 20 }) {
  const conditions = [
    `status = 'Active'`,
    `weight_kg >= 45`,
    `date_of_birth <= CURRENT_DATE - INTERVAL '18 years'`,
    `date_of_birth >= CURRENT_DATE - INTERVAL '65 years'`,
    `((gender = 'Male' AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - INTERVAL '90 days'))
      OR (gender = 'Female' AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - INTERVAL '120 days'))
      OR (gender NOT IN ('Male', 'Female') AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - INTERVAL '90 days')))`
  ];
  const params = [];

  if (bloodGroup) {
    params.push(bloodGroup);
    conditions.push(`blood_group = $${params.length}`);
  }
  if (city) {
    params.push(`%${city.trim()}%`);
    conditions.push(`city ILIKE $${params.length}`);
  }
  if (pin) {
    params.push(pin.trim());
    conditions.push(`pin_code = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  // Total eligible matching count
  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM donors ${where}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  // Pagination
  const offset = (page - 1) * limit;
  const pageParams = [...params, limit, offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const dataRes = await query(
    `SELECT donor_id, full_name, blood_group, city, phone, last_donation_date
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
      lastDonationDate: row.last_donation_date
        ? (row.last_donation_date instanceof Date
            ? row.last_donation_date.toISOString().slice(0, 10)
            : String(row.last_donation_date).slice(0, 10))
        : null,
    })),
    total,
  };
}

module.exports = {
  searchStockByGroup,
  searchEligibleDonors,
};
