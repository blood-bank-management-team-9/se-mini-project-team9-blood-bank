// All SQL for donation corrections (SAD 4.1). Every query is parameterised; column names
// come from the fixed maps below, never from client input.
const DONATION_COLS = {
  collectionDate: 'collection_date',
  volumeMl: 'volume_ml',
  screeningStatus: 'screening_status',
  donationStatus: 'donation_status',
  medicalNotes: 'medical_notes',
};
const UNIT_COLS = {
  volumeMl: 'volume_ml',
  collectionDate: 'collection_date',
  expiryDate: 'expiry_date',
  status: 'status',
  discardReason: 'discard_reason',
};

const buildUpdate = (table, idCol, colMap, id, changes) => {
  const keys = Object.keys(changes).filter((k) => colMap[k]);
  if (keys.length === 0) return null;
  const sets = keys.map((k, i) => `${colMap[k]} = $${i + 1}`);
  const values = keys.map((k) => changes[k]);
  return { text: `UPDATE ${table} SET ${sets.join(', ')} WHERE ${idCol} = $${keys.length + 1}`, values: [...values, id] };
};

exports.findDonationForUpdate = async (tx, donationId) => {
  const res = await tx.query(
    `SELECT donation_id, donor_id, collection_date, volume_ml, blood_group,
            screening_status, donation_status, medical_notes, created_at
       FROM donations WHERE donation_id = $1 FOR UPDATE`,
    [donationId]
  );
  return res.rows[0] || null;
};

exports.findUnitForUpdate = async (tx, donationId) => {
  const res = await tx.query(
    `SELECT unit_id, status, volume_ml, collection_date, expiry_date
       FROM blood_units WHERE donation_id = $1 FOR UPDATE`,
    [donationId]
  );
  return res.rows[0] || null;
};

exports.updateDonation = async (tx, donationId, changes) => {
  const q = buildUpdate('donations', 'donation_id', DONATION_COLS, donationId, changes);
  if (q) await tx.query(q.text, q.values);
};

exports.updateUnit = async (tx, unitId, changes) => {
  const q = buildUpdate('blood_units', 'unit_id', UNIT_COLS, unitId, changes);
  if (q) await tx.query(q.text, q.values);
};
