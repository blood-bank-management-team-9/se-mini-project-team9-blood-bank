// All SQL for discarding units (SAD 4.1). Parameterised queries only.

// ADR-06: pessimistic row lock, so two staff can never act on the same unit at once.
exports.findUnitForUpdate = async (tx, unitId) => {
  const res = await tx.query(
    `SELECT unit_id, status, blood_group FROM blood_units WHERE unit_id = $1 FOR UPDATE`,
    [unitId]
  );
  return res.rows[0] || null;
};

// The status check is repeated in the UPDATE itself, so a unit that is already Issued or
// Discarded can never be changed, and stock cannot be counted down twice (FR-STK-07).
exports.markDiscarded = async (tx, unitId, reason) => {
  const res = await tx.query(
    `UPDATE blood_units
        SET status = 'Discarded', discard_reason = $2
      WHERE unit_id = $1 AND status IN ('Available', 'Reserved', 'Expired')
      RETURNING unit_id`,
    [unitId, reason]
  );
  return res.rows.length === 1;
};
