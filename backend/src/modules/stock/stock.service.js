const repo = require('./stock.repository');
const { todayInTz } = require('../../scheduler/dates');

// IStockInternal.expireUnits (SAD 3.3): used by the C15 Scheduler.
// Returns how many units were expired. Safe to run more than once (ADR-05).
exports.expireUnits = async ({ now = new Date(), repository = repo } = {}) => {
  const today = todayInTz(now);
  const ids = await repository.expireUnitsOnOrBefore(today);
  return { date: today, expired: ids.length };
};
