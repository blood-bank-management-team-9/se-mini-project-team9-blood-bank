// C9 Stock Service business logic (SAD 3.4, SRS 5.6); HTTP mapping lives in routes.
const repo = require('./stock.repository');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const UNIT_STATUSES = ['Available', 'Reserved', 'Issued', 'Expired', 'Discarded'];
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
    expiringSoon: live && days >= 0 && days <= expiringSoonDays,
    expiringSoonLabel: live && days >= 0 && days <= expiringSoonDays ? 'Expiring Soon' : null,
  };
}

// FR-STK-01, FR-STK-02, FR-STK-05: unit list, earliest expiry first.
async function listUnits({ bloodGroup, status } = {}) {
  const { expiringSoonDays } = await loadConfig();
  const rows = await repo.listUnits({ bloodGroup, status });
  return { units: rows.map((r) => toUnitDto(r, expiringSoonDays)), total: rows.length };
}

module.exports = {
  StockError,
  BLOOD_GROUPS,
  UNIT_STATUSES,
  getSummary,
  listUnits,
};