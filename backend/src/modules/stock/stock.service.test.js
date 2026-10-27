// STP TC-07, TC-28: stock summary, low-stock and expiring-soon alerts.
jest.mock('./stock.repository', () => ({
  getStockConfig: jest.fn(),
  countUnitsByGroupAndStatus: jest.fn(),
  countExpiringSoonByGroup: jest.fn(),
  listUnits: jest.fn(),
}));

const repo = require('./stock.repository');
const stockService = require('./stock.service');

describe('Stock summary (FR-STK-01, 04, 05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.getStockConfig.mockResolvedValue({ low_stock_threshold: '5', expiring_soon_days: '7' });
    repo.countExpiringSoonByGroup.mockResolvedValue([]);
  });

  it('returns all 8 groups with all 5 statuses, zero-filled', async () => {
    repo.countUnitsByGroupAndStatus.mockResolvedValue([
      { blood_group: 'O+', status: 'Available', count: 7 },
      { blood_group: 'O+', status: 'Discarded', count: 2 },
    ]);
    const summary = await stockService.getSummary();
    expect(summary.groups).toHaveLength(8);
    const oPos = summary.groups.find((g) => g.bloodGroup === 'O+');
    expect(oPos).toMatchObject({
      available: 7, reserved: 0, issued: 0, expired: 0, discarded: 2, lowStock: false,
    });
  });

  it('raises a text Low Stock Alert below the threshold (TC-07)', async () => {
    repo.countUnitsByGroupAndStatus.mockResolvedValue([
      { blood_group: 'O-', status: 'Available', count: 4 },
      { blood_group: 'A+', status: 'Available', count: 5 },
    ]);
    const summary = await stockService.getSummary();
    const messages = summary.lowStockAlerts.map((a) => a.message);
    expect(messages).toContain('Low Stock Alert: O-');
    expect(messages).not.toContain('Low Stock Alert: A+'); // exactly 5 is not below 5
  });

  it('uses the configured threshold and falls back to defaults on bad config', async () => {
    repo.getStockConfig.mockResolvedValue({ low_stock_threshold: '2', expiring_soon_days: 'x' });
    repo.countUnitsByGroupAndStatus.mockResolvedValue([
      { blood_group: 'O-', status: 'Available', count: 3 },
    ]);
    const summary = await stockService.getSummary();
    expect(summary.lowStockThreshold).toBe(2);
    expect(summary.expiringSoonDays).toBe(7);
    expect(summary.lowStockAlerts.map((a) => a.bloodGroup)).not.toContain('O-');
  });

  it('reports Expiring Soon alerts per group', async () => {
    repo.countUnitsByGroupAndStatus.mockResolvedValue([]);
    repo.countExpiringSoonByGroup.mockResolvedValue([{ blood_group: 'B+', count: 2 }]);
    const summary = await stockService.getSummary();
    expect(repo.countExpiringSoonByGroup).toHaveBeenCalledWith(7);
    expect(summary.expiringSoonAlerts).toEqual([
      expect.objectContaining({ bloodGroup: 'B+', units: 2, message: 'Expiring Soon: B+' }),
    ]);
  });
});

describe('Unit list expiring-soon tagging (FR-STK-05, TC-28)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.getStockConfig.mockResolvedValue({});
  });

  const row = (id, days, status = 'Available') => ({
    unit_id: id, donation_id: 'DON-00000001', blood_group: 'A+', volume_ml: 450,
    collection_date: '2026-10-01', expiry_date: '2026-11-05', status,
    discard_reason: null, days_to_expiry: String(days),
  });

  it('tags units expiring in 6 and 7 days, not 8', async () => {
    repo.listUnits.mockResolvedValue([row('UNT-00001', 6), row('UNT-00002', 7), row('UNT-00003', 8)]);
    const { units } = await stockService.listUnits({ bloodGroup: 'A+' });
    expect(units.map((u) => u.expiringSoon)).toEqual([true, true, false]);
    expect(units[0].expiringSoonLabel).toBe('Expiring Soon');
    expect(units[2].expiringSoonLabel).toBeNull();
  });

  it('does not tag already expired, issued or discarded units', async () => {
    repo.listUnits.mockResolvedValue([
      row('UNT-00001', -1), row('UNT-00002', 3, 'Issued'), row('UNT-00003', 3, 'Discarded'),
    ]);
    const { units } = await stockService.listUnits();
    expect(units.every((u) => u.expiringSoon === false)).toBe(true);
  });
});