// C6 Donor Management data access (SAD 3.4). All SQL is parameterised.
const { query } = require('../../database/db');

const DONOR_COLUMNS = `donor_id, full_name, date_of_birth, gender, blood_group,
  weight_kg, phone, email, address, city, pin_code, last_donation_date, status, created_at`;

function runner(tx) {
  return tx ? tx.query.bind(tx) : query;
}

async function listDonors({ status, bloodGroup, q } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (bloodGroup) {
    params.push(bloodGroup);
    conditions.push(`blood_group = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(full_name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT ${DONOR_COLUMNS} FROM donors ${where} ORDER BY created_at DESC, donor_id`,
    params
  );
  return rows;
}

async function findDonorById(donorId, tx = null) {
  const { rows } = await runner(tx)(
    `SELECT ${DONOR_COLUMNS} FROM donors WHERE donor_id = $1${tx ? ' FOR UPDATE' : ''}`,
    [donorId]
  );
  return rows[0] || null;
}

async function nextDonorId(tx) {
  // Serialize donor ID allocation, including when the table is empty.
  await tx.query('SELECT pg_advisory_xact_lock($1)', [410937]);
  const { rows } = await tx.query(
    `SELECT donor_id FROM donors
      WHERE donor_id ~ '^DNR-[0-9]{5}$'
      ORDER BY substring(donor_id FROM 5)::INTEGER DESC
      LIMIT 1`
  );
  const current = rows.length ? Number(rows[0].donor_id.slice(4)) : 0;
  if (current >= 99999) {
    const err = new Error('Donor ID pool exhausted');
    err.code = 'DONOR_ID_POOL_EXHAUSTED';
    throw err;
  }
  return `DNR-${String(current + 1).padStart(5, '0')}`;
}

async function createDonor(tx, donorId, donor) {
  const { rows } = await tx.query(
    `INSERT INTO donors
       (donor_id, full_name, date_of_birth, gender, blood_group, weight_kg,
        phone, email, address, city, pin_code, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Active')
     RETURNING ${DONOR_COLUMNS}`,
    [
      donorId,
      donor.fullName,
      donor.dob,
      donor.gender,
      donor.bloodGroup,
      donor.weightKg,
      donor.phone,
      donor.email || null,
      donor.address || null,
      donor.city,
      donor.pinCode,
    ]
  );
  return rows[0];
}

async function updateDonor(tx, donorId, donor) {
  const { rows } = await tx.query(
    `UPDATE donors
        SET full_name = $2, date_of_birth = $3, gender = $4, blood_group = $5,
            weight_kg = $6, phone = $7, email = $8, address = $9,
            city = $10, pin_code = $11
      WHERE donor_id = $1
      RETURNING ${DONOR_COLUMNS}`,
    [
      donorId,
      donor.fullName,
      donor.dob,
      donor.gender,
      donor.bloodGroup,
      donor.weightKg,
      donor.phone,
      donor.email || null,
      donor.address || null,
      donor.city,
      donor.pinCode,
    ]
  );
  return rows[0] || null;
}

async function updateDonorStatus(tx, donorId, status) {
  const { rows } = await tx.query(
    `UPDATE donors SET status = $2 WHERE donor_id = $1 RETURNING ${DONOR_COLUMNS}`,
    [donorId, status]
  );
  return rows[0] || null;
}

module.exports = {
  listDonors,
  findDonorById,
  nextDonorId,
  createDonor,
  updateDonor,
  updateDonorStatus,
};
