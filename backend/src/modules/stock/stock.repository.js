// All SQL for the stock module lives here (SAD 4.1). Queries are parameterised.
const { pool } = require('../../database/db');

// Marks Available and Reserved units whose expiry date is today or earlier as Expired.
// `db` is any object with query(text, params), so tests can pass a fake.
exports.expireUnitsOnOrBefore = async (date, db = pool) => {
  const res = await db.query(
    `UPDATE blood_units
        SET status = 'Expired'
      WHERE status IN ('Available', 'Reserved')
        AND expiry_date <= $1
      RETURNING unit_id`,
    [date]
  );
  return res.rows.map((r) => r.unit_id);
};
