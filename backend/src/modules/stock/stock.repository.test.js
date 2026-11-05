jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/db');
const repo = require('./stock.repository');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('stock.repository', () => {
  describe('getStockConfig', () => {
    test('returns configuration values using the default query', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'low_stock_threshold', value: '5' },
          { key: 'expiring_soon_days', value: '7' },
        ],
      });

      const result = await repo.getStockConfig();

      expect(result).toEqual({
        low_stock_threshold: '5',
        expiring_soon_days: '7',
      });
      expect(query).toHaveBeenCalledWith(
        'SELECT key, value FROM system_config WHERE key = ANY($1)',
        [['low_stock_threshold', 'expiring_soon_days']]
      );
    });

    test('uses the supplied transaction', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({
          rows: [{ key: 'low_stock_threshold', value: '10' }],
        }),
      };

      const result = await repo.getStockConfig(tx);

      expect(result).toEqual({ low_stock_threshold: '10' });
      expect(tx.query).toHaveBeenCalledTimes(1);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('countUnitsByGroupAndStatus', () => {
    test('returns stock counts grouped by blood group and status', async () => {
      const rows = [
        { blood_group: 'A+', status: 'Available', count: 5 },
        { blood_group: 'B+', status: 'Expired', count: 2 },
      ];

      query.mockResolvedValue({ rows });

      const result = await repo.countUnitsByGroupAndStatus();

      expect(result).toEqual(rows);
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][0]).toContain('GROUP BY 1, 2');
    });
  });

  describe('countExpiringSoonByGroup', () => {
    test('returns expiring unit counts for the supplied number of days', async () => {
      const rows = [
        { blood_group: 'O+', count: 3 },
        { blood_group: 'AB+', count: 1 },
      ];

      query.mockResolvedValue({ rows });

      const result = await repo.countExpiringSoonByGroup(7);

      expect(result).toEqual(rows);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('expiry_date <= CURRENT_DATE + $1::int'),
        [7]
      );
    });
  });

  describe('listUnits', () => {
    test('lists all units when no filters are supplied', async () => {
      const rows = [{ unit_id: 'U001', blood_group: 'A+' }];
      query.mockResolvedValue({ rows });

      const result = await repo.listUnits();

      expect(result).toEqual(rows);
      expect(query.mock.calls[0][0]).toContain('FROM blood_units');
      expect(query.mock.calls[0][0]).not.toContain('WHERE');
      expect(query).toHaveBeenCalledWith(expect.any(String), []);
    });

    test('filters by blood group only', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listUnits({ bloodGroup: 'A+' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('blood_group = $1'),
        ['A+']
      );
    });

    test('filters by status only', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listUnits({ status: 'Available' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('CASE WHEN status IN'),
        ['Available']
      );
      expect(query.mock.calls[0][0]).toContain('WHERE');
    });

    test('filters by both blood group and status', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listUnits({
        bloodGroup: 'O+',
        status: 'Available',
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('blood_group = $1 AND'),
        ['O+', 'Available']
      );
    });
  });
});
