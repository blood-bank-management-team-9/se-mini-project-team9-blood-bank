// C8 Donation Service data access for recording donations (SAD 3.4, SD-2). All SQL is parameterised.
const CONFIG_KEYS = [
  'eligibility_min_age',
  'eligibility_max_age',
  'eligibility_min_weight_kg',
  'eligibility_gap_days_male',
  'eligibility_gap_days_other',
  'shelf_life_days',
];

// Dates are read with to_char so the IST/UTC off-by-one cannot occur.
async function findDonorForUpdate(tx, donorId) {
  const { rows } = await tx.query(
    `SELECT donor_id, gender, blood_group, weight_kg, status,
            to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
            to_char(last_donation_date, 'YYYY-MM-DD') AS last_donation_date
       FROM donors WHERE donor_id = $1 FOR UPDATE`,
    [donorId]
  );
  return rows[0] || null;
}

async function getToday(tx) {
  const { rows } = await tx.query(
    `SELECT to_char((NOW() AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS today`
  );
  return rows[0].today;
}

async function getConfig(tx) {
  const { rows } = await tx.query(
    'SELECT key, value FROM system_config WHERE key = ANY($1)',
    [CONFIG_KEYS]
  );
  return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
}

// Serialises ID allocation, including when the table is empty.
async function nextDonationId(tx) {
  await tx.query('SELECT pg_advisory_xact_lock($1)', [410938]);
  const { rows } = await tx.query(
    `SELECT donation_id FROM donations
      WHERE donation_id ~ '^DON-[0-9]{8}$'
      ORDER BY substring(donation_id FROM 5)::INTEGER DESC
      LIMIT 1`
  );
  const current = rows.length ? Number(rows[0].donation_id.slice(4)) : 0;
  if (current >= 99999999) {
    const err = new Error('Donation ID pool exhausted');
    err.code = 'DONATION_ID_POOL_EXHAUSTED';
    throw err;
  }
  return `DON-${String(current + 1).padStart(8, '0')}`;
}

async function nextUnitId(tx) {
  await tx.query('SELECT pg_advisory_xact_lock($1)', [410939]);
  const { rows } = await tx.query(
    `SELECT unit_id FROM blood_units
      WHERE unit_id ~ '^UNT-[0-9]{5}$'
      ORDER BY substring(unit_id FROM 5)::INTEGER DESC
      LIMIT 1`
  );
  const current = rows.length ? Number(rows[0].unit_id.slice(4)) : 0;
  if (current >= 99999) {
    const err = new Error('Unit ID pool exhausted');
    err.code = 'UNIT_ID_POOL_EXHAUSTED';
    throw err;
  }
  return `UNT-${String(current + 1).padStart(5, '0')}`;
}

async function insertDonation(tx, donation) {
  await tx.query(
    `INSERT INTO donations
       (donation_id, donor_id, collection_date, volume_ml, blood_group,
        screening_status, donation_status, recorded_by, medical_notes)
     VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9)`,
    [
      donation.donationId,
      donation.donorId,
      donation.collectionDate,
      donation.volumeMl,
      donation.bloodGroup,
      donation.screeningStatus,
      donation.donationStatus,
      donation.recordedBy,
      donation.medicalNotes,
    ]
  );
}

// FR-DNR-03: Available unit, expiry = collection date + shelf life.
async function insertUnit(tx, unit) {
  const { rows } = await tx.query(
    `INSERT INTO blood_units
       (unit_id, donation_id, blood_group, volume_ml, collection_date, expiry_date, status)
     VALUES ($1, $2, $3, $4, $5::date, $5::date + $6::int, 'Available')
     RETURNING unit_id, to_char(expiry_date, 'YYYY-MM-DD') AS expiry_date`,
    [unit.unitId, unit.donationId, unit.bloodGroup, unit.volumeMl, unit.collectionDate, unit.shelfLifeDays]
  );
  return rows[0];
}

module.exports = {
  findDonorForUpdate,
  getToday,
  getConfig,
  nextDonationId,
  nextUnitId,
  insertDonation,
  insertUnit,
};