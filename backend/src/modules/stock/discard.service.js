const AppError = require('../../middleware/AppError');
const defaultRepo = require('./discard.repository');
const defaultAudit = require('../../audit/audit.service');
const { withTransaction } = require('../../database/transaction');

// FR-STK-06 / FR-STK-07 (SAD 4.1): Available, Reserved or Expired -> Discarded, with a reason.
// The status change and its audit entry are one transaction (NFR-QUAL-03).
exports.discardUnit = async (
  { unitId, reason, staffId },
  { repo = defaultRepo, audit = defaultAudit, tx = withTransaction } = {}
) =>
  tx(async (db) => {
    const unit = await repo.findUnitForUpdate(db, unitId);
    if (!unit) throw new AppError(404, 'NOT_FOUND', 'Blood unit not found.');

    const blocked = () => new AppError(409, 'INVALID_STATE', `This unit is already ${unit.status} and cannot be discarded.`);
    if (unit.status === 'Issued' || unit.status === 'Discarded') throw blocked();

    const changed = await repo.markDiscarded(db, unitId, reason);
    if (!changed) throw blocked();

    await audit.logChange(db, {
      userId: staffId,
      action: 'UNIT_DISCARDED',
      entity: `unit:${unitId}`,
      originalValue: { status: unit.status },
      newValue: { status: 'Discarded', reason },
    });

    return { unitId, status: 'Discarded' };
  });
