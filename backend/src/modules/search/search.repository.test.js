// src/modules/search/search.repository.test.js
jest.mock('../../database/db', () => ({ query: jest.fn() }));
jest.mock('../donors/donors.repository', () => ({
  getEligibilityConfig: jest.fn(),
}));

const db = require('../../database/db');
const donorsRepo = require('../donors/donors.repository');
const repo = require('./search.repository');

const mkRes = (rows) => ({ rows });

beforeEach(() => jest.clearAllMocks());

describe('search.repository', () => {
  // ── searchStockByGroup (FR-SRCH-01) ────────────────────────────────
  describe('searchStockByGroup', () => {
    it('binds bloodGroup as $1 and filters Available + future expiry', async () => {
      db.query.mockResolvedValueOnce(mkRes([
        { unit_id: 'UNT-10001', expiry_date: '2026-12-01' },
      ]));
      const rows = await repo.searchStockByGroup('O+');
      expect(rows).toEqual([{ unit_id: 'UNT-10001', expiry_date: '2026-12-01' }]);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/status = 'Available'/);
      expect(sql).toMatch(/expiry_date > CURRENT_DATE/);
      expect(sql).toMatch(/blood_group = \$1/);
      expect(sql).toMatch(/ORDER BY expiry_date ASC/);
      expect(sql).toMatch(/TO_CHAR\(expiry_date, 'YYYY-MM-DD'\)/);
      expect(params).toEqual(['O+']);
    });

    it('returns [] when no units match', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await expect(repo.searchStockByGroup('AB-')).resolves.toEqual([]);
    });
  });

  // ── buildDonorSearchQuery (pure — no DB) ───────────────────────────
  describe('buildDonorSearchQuery', () => {
    it('uses default config values when config is empty', () => {
      const { where, params } = repo.buildDonorSearchQuery({});
      // $1..$5 = minWeightKg, minAge, maxAge+1, maleGapDays, otherGapDays
      expect(params.slice(0, 5)).toEqual([45, 18, 66, 90, 120]);
      expect(where).toContain("status = 'Active'");
      expect(where).toContain('weight_kg >= $1');
      expect(where).toContain('gender = ');
      expect(where).not.toContain('blood_group');
    });

    it('uses config when provided', () => {
      const { params } = repo.buildDonorSearchQuery({
        config: {
          eligibility_min_age: '20',
          eligibility_max_age: '60',
          eligibility_min_weight_kg: '50',
          eligibility_gap_days_male: '60',
          eligibility_gap_days_other: '180',
        },
      });
      expect(params.slice(0, 5)).toEqual([50, 20, 61, 60, 180]);
    });

    it('adds bloodGroup filter as a bound parameter', () => {
      const { where, params } = repo.buildDonorSearchQuery({ bloodGroup: 'O+' });
      expect(where).toContain('blood_group = $6');
      expect(params).toEqual([45, 18, 66, 90, 120, 'O+']);
    });

    it('adds city filter with ILIKE and escaping of % _ \\', () => {
      const { where, params } = repo.buildDonorSearchQuery({ city: 'Mu%mb_ai' });
      expect(where).toContain('city ILIKE $6');
      expect(params[5]).toBe('%Mu\\%mb\\_ai%');
    });

    it('adds pin filter as a trimmed exact match', () => {
      const { where, params } = repo.buildDonorSearchQuery({ pin: '  400001  ' });
      expect(where).toContain('pin_code = $6');
      expect(params[5]).toBe('400001');
    });

    it('combines bloodGroup + city + pin with numbered params', () => {
      const { where, params } = repo.buildDonorSearchQuery({
        bloodGroup: 'A+',
        city: 'Pune',
        pin: '411001',
      });
      expect(where).toContain('blood_group = $6');
      expect(where).toContain('city ILIKE $7');
      expect(where).toContain('pin_code = $8');
      expect(params.slice(5)).toEqual(['A+', '%Pune%', '411001']);
    });
  });

  // ── searchEligibleDonors (FR-SRCH-03/06) ───────────────────────────
  describe('searchEligibleDonors', () => {
    it('runs COUNT then data query, maps rows, and applies LIMIT/OFFSET', async () => {
      donorsRepo.getEligibilityConfig.mockResolvedValue({ eligibility_min_age: '18' });
      db.query
        .mockResolvedValueOnce(mkRes([{ total: 42 }]))
        .mockResolvedValueOnce(mkRes([
          {
            donor_id: 'DNR-1',
            full_name: 'Alice',
            blood_group: 'O+',
            city: 'Pune',
            phone: '9999999999',
            last_donation_date: null,
          },
        ]));

      const out = await repo.searchEligibleDonors({ bloodGroup: 'O+', page: 2, limit: 20 });

      expect(out.total).toBe(42);
      expect(out.donors).toEqual([
        {
          donorId: 'DNR-1',
          name: 'Alice',
          bloodGroup: 'O+',
          city: 'Pune',
          phone: '9999999999',
          lastDonationDate: null,
        },
      ]);
      // Second query has LIMIT/OFFSET appended as the last two params
      const [, dataParams] = db.query.mock.calls[1];
      expect(dataParams.slice(-2)).toEqual([20, 20]); // limit=20, offset=(2-1)*20
    });

    it('handles null last_donation_date (coerces to null in DTO)', async () => {
      donorsRepo.getEligibilityConfig.mockResolvedValue({});
      db.query
        .mockResolvedValueOnce(mkRes([{ total: 0 }]))
        .mockResolvedValueOnce(mkRes([
          { donor_id: 'DNR-2', full_name: 'Bob', blood_group: 'A+', city: 'Mumbai', phone: '8888888888', last_donation_date: null },
        ]));
      const out = await repo.searchEligibleDonors({});
      expect(out.donors[0].lastDonationDate).toBeNull();
    });

    it('falls back to empty config when getEligibilityConfig throws', async () => {
      donorsRepo.getEligibilityConfig.mockRejectedValueOnce(new Error('config unavailable'));
      db.query
        .mockResolvedValueOnce(mkRes([{ total: 0 }]))
        .mockResolvedValueOnce(mkRes([]));
      await expect(repo.searchEligibleDonors({})).resolves.toEqual({ donors: [], total: 0 });
    });

    it('returns total 0 and empty donors on empty result', async () => {
      donorsRepo.getEligibilityConfig.mockResolvedValue({});
      db.query
        .mockResolvedValueOnce(mkRes([]))    // count query can return no row
        .mockResolvedValueOnce(mkRes([]));
      const out = await repo.searchEligibleDonors({});
      expect(out.total).toBe(0);
      expect(out.donors).toEqual([]);
    });
  });
});