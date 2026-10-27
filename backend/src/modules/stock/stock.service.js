// C9 Stock Service business logic (SAD 3.4, SRS 5.6); HTTP mapping lives in routes.
const { withTransaction } = require('../../database/transaction');
const { logAudit } = require('../audit/audit.repository');
const repo = require('./stock.repository');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const UNIT_STATUSES = ['Available', 'Reserved', 'Issued', 'Expired', 'Discarded'];
const DISCARD_REASONS = ['Expired', 'Hemolyzed', 'Contaminated', 'Leakage', 'Test Positive'];
// SAD 4.2 unit states: only these may move to Discarded.
const DISCARDABLE_STATUSES = ['Available', 'Reserved', 'Expired'];
const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const DEFAULT_EXPIRING_SOON_DAYS = 7;

class StockError extends Error {
  constructor(code, publicMessage, status = 400) {
    super(publicMessage);
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

function positiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

async function loadConfig() {
  const cfg = await repo.getStockConfig();
  return {
    lowStockThreshold: positiveInt(cfg.low_stock_threshold, DEFAULT_LOW_STOCK_THRESHOLD),
    expiringSoonDays: positiveInt(cfg.expiring_soon_days, DEFAULT_EXPIRING_SOON_DAYS),
  };
}

// FR-STK-01, FR-STK-04, FR-STK-05: counts for all 8 groups plus alerts.
async function getSummary() {
  const { lowStockThreshold, expiringSoonDays } = await loadConfig();
  const [counts, expiring] = await Promise.all([
    repo.countUnitsByGroupAndStatus(),
    repo.countExpiringSoonByGroup(expiringSoonDays),
  ]);

  const groups = BLOOD_GROUPS.map((bloodGroup) => {
    const entry = { bloodGroup };
    UNIT_STATUSES.forEach((status) => { entry[status.toLowerCase()] = 0; });
    counts
      .filter((row) => row.blood_group === bloodGroup)
      .forEach((row) => { entry[row.status.toLowerCase()] = row.count; });
    const soon = expiring.find((row) => row.blood_group === bloodGroup);
    entry.expiringSoon = soon ? soon.count : 0;
    entry.lowStock = entry.available < lowStockThreshold;
    return entry;
  });

  // Text, not just colour, carries the alert (TC-07).
  const lowStockAlerts = groups
    .filter((g) => g.lowStock)
    .map((g) => ({
      bloodGroup: g.bloodGroup,
      available: g.available,
      threshold: lowStockThreshold,
      message: `Low Stock Alert: ${g.bloodGroup}`,
    }));
  const expiringSoonAlerts = groups
    .filter((g) => g.expiringSoon > 0)
    .map((g) => ({
      bloodGroup: g.bloodGroup,
      units: g.expiringSoon,
      withinDays: expiringSoonDays,
      message: `Expiring Soon: ${g.bloodGroup}`,
    }));

  return {
    groups,
    lowStockThreshold,
    expiringSoonDays,
    lowStockAlerts,
    expiringSoonAlerts,
  };
}

function toUnitDto(row, expiringSoonDays) {
  const days = Number(row.days_to_expiry);
  const live = row.status === 'Available' || row.status === 'Reserved';
  // A unit expiring today is already treated as Expired (ADR-05), so only days 1..N count.
  const soon = live && days > 0 && days <= expiringSoonDays;
  return {
    unitId: row.unit_id,
    donationId: row.donation_id,
    bloodGroup: row.blood_group,
    volumeMl: row.volume_ml,
    collectionDate: row.collection_date,
    expiryDate: row.expiry_date,
    status: row.status,
    discardReason: row.discard_reason,
    daysToExpiry: days,
    expiringSoon: soon,
    expiringSoonLabel: soon ? 'Expiring Soon' : null,
  };
}

// FR-STK-01, FR-STK-02, FR-STK-05: unit list, earliest expiry first.
async function listUnits({ bloodGroup, status } = {}) {
  const { expiringSoonDays } = await loadConfig();
  const rows = await repo.listUnits({ bloodGroup, status });
  return { units: rows.map((r) => toUnitDto(r, expiringSoonDays)), total: rows.length };
}

// FR-STK-06, FR-STK-07: discard with mandatory reason, atomic with its audit entry.
async function discardUnit({ actorUserId, unitId, reason }) {
  if (!DISCARD_REASONS.includes(reason)) {
    throw new StockError('VALIDATION_ERROR', 'A valid discard reason is required', 400);
  }
  return withTransaction(async (tx) => {
    const unit = await repo.findUnitForUpdate(tx, unitId);
    if (!unit) throw new StockError('NOT_FOUND', 'Blood unit not found', 404);
    if (!DISCARDABLE_STATUSES.includes(unit.status)) {
      throw new StockError(
        'INVALID_STATE',
        `A unit that is ${unit.status} cannot be discarded`,
        409
      );
    }
    const updated = await repo.markDiscarded(tx, unitId, reason, DISCARDABLE_STATUSES);
    if (!updated) {
      throw new StockError('INVALID_STATE', 'Unit state changed; please retry', 409);
    }
    // FR-STK-07: stock is derived from rows, so the count after this change must never be negative.
    if (unit.status === 'Available') {
      const remaining = await repo.countAvailable(tx, unit.blood_group);
      if (remaining < 0) {
        throw new StockError('INSUFFICIENT_STOCK', 'Stock cannot go below zero', 409);
      }
    }
    await logAudit({
      userId: actorUserId,
      action: 'UNIT_DISCARDED',
      entity: 'blood_units',
      entityId: unitId,
      originalValue: { status: unit.status },
      newValue: { status: 'Discarded', reason, staffId: actorUserId },
    }, tx);
    return { unitId, status: 'Discarded' };
  });
}

// FR-STK-07 guard for allocation (used by the request module): refuses to reserve
// more units than are Available. Call inside the caller's transaction.
async function assertSufficientStock(tx, bloodGroup, units) {
  const available = await repo.countAvailable(tx, bloodGroup);
  if (units > available) {
    throw new StockError(
      'INSUFFICIENT_STOCK',
      `Only ${available} ${bloodGroup} unit(s) available; ${units} requested`,
      409
    );
  }
  return available;
}

module.exports = {
  StockError,
  BLOOD_GROUPS,
  UNIT_STATUSES,
  DISCARD_REASONS,
  getSummary,
  listUnits,
  discardUnit,
  assertSufficientStock,
};