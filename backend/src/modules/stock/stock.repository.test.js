// src/modules/stock/stock.repository.test.js
const repo = require('./stock.repository');

// Mock the module-level `query` used by countUnitsByGroupAndStatus,
// countExpiringSoonByGroup, and listUnits.
jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const db = require('../../database/db');

function txMock(rowsOrNull) {
  return {
    query: jest.fn().mockResolvedValue(
      Array.isArray(rowsOrNull) ? { rows: rowsOrNull } : rowsOrNull
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('stock.repository', () => {
  // ── getStockConfig ─────────────────────────────────────────────────
  describe('getStockConfig', () => {
    it('returns a key→value object from rows (via tx)', async () => {
      const tx = txMock([
        { key: 'low_stock_threshold', value: '5' },
        { key: 'expiring_soon_days', value: '7' },
      ]);
      const cfg = await repo.getStockConfig(tx);
      expect(cfg).toEqual({ low_stock_threshold: '5', expiring_soon_days: '7' });
      expect(tx.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM system_config'),
        [['low_stock_threshold', 'expiring_soon_days']]
      );
    });

    it('returns {} when no config rows exist', async () => {
      const tx = txMock([]);
      await expect(repo.getStockConfig(tx)).resolves.toEqual({});
    });

    it('uses global query when no tx is supplied', async () => {
      db.query.mockResolvedValue({ rows: [{ key: 'low_stock_threshold', value: '3' }] });
      const cfg = await repo.getStockConfig();
      expect(cfg).toEqual({ low_stock_threshold: '3' });
      expect(db.query).toHaveBeenCalled();
    });
  });

  // ── countUnitsByGroupAndStatus ─────────────────────────────────────
  describe('countUnitsByGroupAndStatus', () => {
    it('returns the rows from the aggregate query', async () => {
      db.query.mockResolvedValue({
        rows: [{ blood_group: 'O+', status: 'Available', count: 4 }],
      });
      const rows = await repo.countUnitsByGroupAndStatus();
      expect(rows).toEqual([{ blood_group: 'O+', status: 'Available', count: 4 }]);
      const [sql] = db.query.mock.calls[0];
      expect(sql).toMatch(/GROUP BY 1, 2/);
    });

    it('uses the EFFECTIVE_STATUS CASE expression for expiry override', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await repo.countUnitsByGroupAndStatus();
      const [sql] = db.query.mock.calls[0];
      expect(sql).toMatch(/CASE WHEN status IN \('Available', 'Reserved'\)/);
      expect(sql).toMatch(/CURRENT_DATE/);
    });
  });

  // ── countExpiringSoonByGroup ───────────────────────────────────────
  describe('countExpiringSoonByGroup', () => {
    it('passes the day count as a bound parameter', async () => {
      db.query.mockResolvedValue({ rows: [{ blood_group: 'A+', count: 2 }] });
      const rows = await repo.countExpiringSoonByGroup(7);
      expect(rows).toEqual([{ blood_group: 'A+', count: 2 }]);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/expiry_date <= CURRENT_DATE \+ \$1::int/);
      expect(params).toEqual([7]);
    });
  });

  // ── listUnits ──────────────────────────────────────────────────────
  describe('listUnits', () => {
    it('builds no WHERE clause when no filters are supplied', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await repo.listUnits();
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).not.toMatch(/WHERE/);
      expect(params).toEqual([]);
    });

    it('applies a bloodGroup filter as $1', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await repo.listUnits({ bloodGroup: 'O+' });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/WHERE blood_group = \$1/);
      expect(params).toEqual(['O+']);
    });

    it('applies a status filter using EFFECTIVE_STATUS', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await repo.listUnits({ status: 'Expired' });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/CASE WHEN status IN \('Available', 'Reserved'\)/);
      expect(sql).toMatch(/= \$1/);
      expect(params).toEqual(['Expired']);
    });

    it('combines both filters with AND', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await repo.listUnits({ bloodGroup: 'A+', status: 'Available' });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/blood_group = \$1 AND/);
      expect(params).toEqual(['A+', 'Available']);
    });

    it('orders by expiry_date ASC then unit_id ASC (FEFO, BR-04)', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await repo.listUnits();
      const [sql] = db.query.mock.calls[0];
      expect(sql).toMatch(/ORDER BY blood_units\.expiry_date ASC, unit_id ASC/);
    });
  });

  // ── findUnitForUpdate ──────────────────────────────────────────────
  describe('findUnitForUpdate', () => {
    it('returns the row when found and locks it with FOR UPDATE', async () => {
      const tx = txMock([{ unit_id: 'UNT-10001', status: 'Available' }]);
      const row = await repo.findUnitForUpdate(tx, 'UNT-10001');
      expect(row).toEqual({ unit_id: 'UNT-10001', status: 'Available' });
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/FOR UPDATE/);
      expect(params).toEqual(['UNT-10001']);
    });

    it('returns null when no row matches', async () => {
      const tx = txMock([]);
      await expect(repo.findUnitForUpdate(tx, 'UNT-99999')).resolves.toBeNull();
    });
  });

  // ── markDiscarded ──────────────────────────────────────────────────
  describe('markDiscarded', () => {
    it('binds reason and allowedStatuses and returns the updated row', async () => {
      const tx = txMock([
        { unit_id: 'UNT-10001', status: 'Discarded', discard_reason: 'expired' },
      ]);
      const row = await repo.markDiscarded(tx, 'UNT-10001', 'expired', [
        'Available',
        'Reserved',
      ]);
      expect(row.status).toBe('Discarded');
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/SET status = 'Discarded'/);
      expect(sql).toMatch(/status = ANY\(\$3\)/);
      expect(sql).toMatch(/RETURNING/);
      expect(params).toEqual(['UNT-10001', 'expired', ['Available', 'Reserved']]);
    });

    it('returns null when the unit is not in an allowed status', async () => {
      const tx = txMock([]);
      await expect(
        repo.markDiscarded(tx, 'UNT-10001', 'expired', ['Available'])
      ).resolves.toBeNull();
    });

    it('does not interpolate the reason into SQL (injection safety)', async () => {
      const tx = txMock([]);
      const evil = "'; DROP TABLE blood_units; --";
      await repo.markDiscarded(tx, 'U1', evil, ['Available']);
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).not.toContain('DROP TABLE');
      expect(params[1]).toBe(evil);
    });
  });

  // ── countAvailable ─────────────────────────────────────────────────
  describe('countAvailable', () => {
    it('returns the integer count for a blood group', async () => {
      const tx = txMock([{ count: 4 }]);
      await expect(repo.countAvailable(tx, 'O+')).resolves.toBe(4);
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/status = 'Available'/);
      expect(sql).toMatch(/expiry_date > CURRENT_DATE/);
      expect(params).toEqual(['O+']);
    });

    it('returns 0 when the count is 0', async () => {
      const tx = txMock([{ count: 0 }]);
      await expect(repo.countAvailable(tx, 'AB-')).resolves.toBe(0);
    });
  });
});