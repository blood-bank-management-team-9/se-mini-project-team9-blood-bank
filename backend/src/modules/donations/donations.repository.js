// C8 Donation Service data access (SAD 3.4). All SQL is parameterised.
const COLUMNS = {
  volumeMl: 'volume_ml',
  collectionDate: 'collection_date',
  medicalNotes: 'medical_notes',
};

// Row-locks the donation; the 24 h window is evaluated by the database clock.
async function findDonationForUpdate(tx, donationId) {
  const { rows } = await tx.query(
    `SELECT donation_id, donor_id, donation_status, volume_ml, medical_notes,
            to_char(collection_date, 'YYYY-MM-DD') AS collection_date,
            to_char((NOW() AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS today,
            (created_at > NOW() - INTERVAL '24 hours') AS within_window
       FROM donations WHERE donation_id = $1 FOR UPDATE`,
    [donationId]
  );
  return rows[0] || null;
}

async function findUnitForUpdate(tx, donationId) {
  const { rows } = await tx.query(
    'SELECT unit_id, status FROM blood_units WHERE donation_id = $1 FOR UPDATE',
    [donationId]
  );
  return rows[0] || null;
}

// Column names come from the COLUMNS whitelist, values are bound parameters.
async function updateDonation(tx, donationId, changes) {
  const keys = Object.keys(changes);
  const sets = keys.map((key, i) => `${COLUMNS[key]} = $${i + 2}`);
  const { rows } = await tx.query(
    `UPDATE donations SET ${sets.join(', ')} WHERE donation_id = $1
     RETURNING donation_id, volume_ml, medical_notes,
               to_char(collection_date, 'YYYY-MM-DD') AS collection_date`,
    [donationId, ...keys.map((key) => changes[key])]
  );
  return rows[0];
}

// FR-DNR-03: expiry = collection date + 35 days, recalculated when the date changes.
async function updateUnit(tx, donationId, { volumeMl = null, collectionDate = null }) {
  await tx.query(
    `UPDATE blood_units
        SET volume_ml = COALESCE($2::int, volume_ml),
            collection_date = COALESCE($3::date, collection_date),
            expiry_date = CASE WHEN $3::date IS NULL THEN expiry_date ELSE $3::date + COALESCE((SELECT value::int FROM system_config WHERE key = 'shelf_life_days'), 35) END
      WHERE donation_id = $1`,
    [donationId, volumeMl, collectionDate]
  );
}

// FR-DNR-05: last donation date is the latest successful (Recorded) collection.
async function syncLastDonationDate(tx, donorId) {
  await tx.query(
    `UPDATE donors
        SET last_donation_date = (SELECT MAX(collection_date) FROM donations
                                   WHERE donor_id = $1 AND donation_status = 'Recorded')
      WHERE donor_id = $1`,
    [donorId]
  );
}

// BR-03: minimum gap (days) for this donor, from system_config by gender.
async function getDonorGapDays(tx, donorId) {
  const { rows } = await tx.query(
    `SELECT d.gender,
            (SELECT value FROM system_config WHERE key = 'eligibility_gap_days_male') AS male_gap,
            (SELECT value FROM system_config WHERE key = 'eligibility_gap_days_other') AS other_gap
       FROM donors d WHERE d.donor_id = $1`,
    [donorId]
  );
  if (!rows[0]) return null;
  const gap = Number(rows[0].gender === 'Male' ? rows[0].male_gap : rows[0].other_gap);
  return Number.isInteger(gap) && gap > 0 ? gap : null;
}

// Another Recorded donation of the same donor closer than gapDays to the given date.
async function findGapConflict(tx, { donationId, donorId, collectionDate, gapDays }) {
  const { rows } = await tx.query(
    `SELECT donation_id, to_char(collection_date, 'YYYY-MM-DD') AS collection_date
       FROM donations
      WHERE donor_id = $1 AND donation_id <> $2 AND donation_status = 'Recorded'
        AND ABS(collection_date - $3::date) < $4::int
      ORDER BY collection_date
      LIMIT 1`,
    [donorId, donationId, collectionDate, gapDays]
  );
  return rows[0] || null;
}
module.exports = {
  getDonorGapDays,
  findGapConflict,
  findDonationForUpdate,
  findUnitForUpdate,
  updateDonation,
  updateUnit,
  syncLastDonationDate,
};