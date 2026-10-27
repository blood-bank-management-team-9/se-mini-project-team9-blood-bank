// C9 Stock Service data access (SAD 3.4, 3.6). All SQL is parameterised.
// Stock counts are derived from blood_units rows, never stored (SAD 3.6, FR-STK-07).
const { query } = require('../../database/db');

const CONFIG_KEYS = ['low_stock_threshold', 'expiring_soon_days'];

// ADR-05: an Available/Reserved unit whose expiry date has been reached counts as
// Expired even before the midnight job updates the row.
const EFFECTIVE_STATUS = `CASE WHEN status IN ('Available', 'Reserved')
       AND expiry_date <= CURRENT_DATE THEN 'Expired' ELSE status END`;

function runner(tx) {
  return tx ? tx.query.bind(tx) : query;
}

async function getStockConfig(tx = null) {
  const { rows } = await runner(tx)(
    'SELECT key, value FROM system_config WHERE key = ANY($1)',
    [CONFIG_KEYS]
  );
  return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
}

// One row per (blood_group, status) with its count.
async function countUnitsByGroupAndStatus() {
  const { rows } = await query(
    `SELECT blood_group, ${EFFECTIVE_STATUS} AS status, COUNT(*)::int AS count
       FROM blood_units
      GROUP BY 1, 2`
  );
  return rows;
}

// Units still usable (Available or Reserved) that expire today or within `days` days.
async function countExpiringSoonByGroup(days) {
  const { rows } = await query(
    `SELECT blood_group, COUNT(*)::int AS count
       FROM blood_units
      WHERE status IN ('Available', 'Reserved')
        AND expiry_date > CURRENT_DATE
        AND expiry_date <= CURRENT_DATE + $1::int
      GROUP BY blood_group`,
    [days]
  );
  return rows;
}

// Unit list, earliest expiry first (FEFO order, BR-04).
async function listUnits({ bloodGroup, status } = {}) {
  const conditions = [];
  const params = [];
  if (bloodGroup) {
    params.push(bloodGroup);
    conditions.push(`blood_group = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`${EFFECTIVE_STATUS} = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT unit_id, donation_id, blood_group, volume_ml,
            to_char(collection_date, 'YYYY-MM-DD') AS collection_date,
            to_char(expiry_date, 'YYYY-MM-DD') AS expiry_date,
            ${EFFECTIVE_STATUS} AS status, discard_reason,
            (expiry_date - CURRENT_DATE) AS days_to_expiry
       FROM blood_units ${where}
      ORDER BY blood_units.expiry_date ASC, unit_id ASC`,
    params
  );
  return rows;
}

module.exports = {
  getStockConfig,
  countUnitsByGroupAndStatus,
  countExpiringSoonByGroup,
  listUnits,
};