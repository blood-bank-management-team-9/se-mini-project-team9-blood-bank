// src/modules/reports/reports.repository.test.js
jest.mock('../../database/db', () => ({ query: jest.fn() }));
const db = require('../../database/db');
const repo = require('./reports.repository');

const mkRes = (rows) => ({ rows });

beforeEach(() => jest.clearAllMocks());

describe('reports.repository', () => {
  // ── buildStockFilters ──────────────────────────────────────────────
  describe('buildStockFilters', () => {
    it('returns empty where/params when no filters', () => {
      expect(repo.buildStockFilters({})).toEqual({ where: '', params: [] });
    });
    it('adds bloodGroup as $1', () => {
      const r = repo.buildStockFilters({ bloodGroup: 'O+' });
      expect(r.where).toContain('blood_group = $1');
      expect(r.params).toEqual(['O+']);
    });
    it('adds from and to date bounds', () => {
      const r = repo.buildStockFilters({ from: '2026-01-01', to: '2026-12-31' });
      expect(r.where).toContain('collection_date >= $1::date');
      expect(r.where).toContain('collection_date <= $2::date');
      expect(r.params).toEqual(['2026-01-01', '2026-12-31']);
    });
    it('combines all filters with AND', () => {
      const r = repo.buildStockFilters({ bloodGroup: 'A+', from: '2026-01-01', to: '2026-02-01' });
      expect(r.where.split('AND').length).toBe(3);
    });
  });

  // ── buildDonationFilters ───────────────────────────────────────────
  describe('buildDonationFilters', () => {
    it('uses screening_status for status filter', () => {
      const r = repo.buildDonationFilters({ status: 'Passed' });
      expect(r.where).toContain('screening_status = $1');
    });
    it('combines 4 filters', () => {
      const r = repo.buildDonationFilters({ bloodGroup: 'A+', status: 'Passed', from: '2026-01-01', to: '2026-02-01' });
      expect(r.params.length).toBe(4);
    });
  });

  // ── buildRequestFilters ────────────────────────────────────────────
  describe('buildRequestFilters', () => {
    it('uses created_at and INTERVAL for "to"', () => {
      const r = repo.buildRequestFilters({ from: '2026-01-01', to: '2026-12-31' });
      expect(r.where).toContain('created_at >=');
      expect(r.where).toContain("INTERVAL '1 day'");
    });
    it('returns empty where with no filters', () => {
      expect(repo.buildRequestFilters({})).toEqual({ where: '', params: [] });
    });
  });

  // ── getStockReport ─────────────────────────────────────────────────
  describe('getStockReport', () => {
    it('returns camelCase aggregates + records + totalUnits', async () => {
      db.query
        .mockResolvedValueOnce(mkRes([
          { blood_group: 'O+', available: 3, reserved: 1, issued: 0, expired: 0, discarded: 0, earliest_expiry: '2026-12-01', total: 4 },
        ]))
        .mockResolvedValueOnce(mkRes([
          { unit_id: 'U1', blood_group: 'O+', volume_ml: 450, collection_date: '2026-10-01', expiry_date: '2026-12-01', status: 'Available' },
        ]));

      const out = await repo.getStockReport({ bloodGroup: 'O+' });
      expect(out.aggregates[0]).toMatchObject({ bloodGroup: 'O+', available: 3, earliestExpiry: '2026-12-01' });
      expect(out.records[0]).toMatchObject({ unitId: 'U1', bloodGroup: 'O+' });
      expect(out.totalUnits).toBe(1);
    });

    it('handles null earliest_expiry', async () => {
      db.query
        .mockResolvedValueOnce(mkRes([{ blood_group: 'A+', available: 0, reserved: 0, issued: 0, expired: 0, discarded: 0, earliest_expiry: null, total: 0 }]))
        .mockResolvedValueOnce(mkRes([]));
      const out = await repo.getStockReport({});
      expect(out.aggregates[0].earliestExpiry).toBeNull();
    });

    it('status=Expired uses the CASE expression, not a bound status', async () => {
      db.query.mockResolvedValue(mkRes([]));
      await repo.getStockReport({ status: 'Expired' });
      const unitSql = db.query.mock.calls[1][0];
      expect(unitSql).toContain("status = 'Expired'");
      expect(unitSql).toContain('expiry_date <= CURRENT_DATE');
    });

    it('status=Available uses a bound $1 parameter', async () => {
      db.query.mockResolvedValue(mkRes([]));
      await repo.getStockReport({ status: 'Available' });
      const [, params] = db.query.mock.calls[1];
      expect(params).toContain('Available');
    });
  });

  // ── getDonationReport ──────────────────────────────────────────────
  describe('getDonationReport', () => {
    it('maps rows and sums volumes', async () => {
      db.query.mockResolvedValueOnce(mkRes([
        { donation_id: 'DON-1', donor_id: 'DNR-1', donor_name: 'Alice', collection_date: '2026-10-01', volume_ml: 450, blood_group: 'O+', screening_status: 'Passed', donation_status: 'Recorded', recorded_by: 'USR-STF01', recorded_at: '2026-10-01' },
        { donation_id: 'DON-2', donor_id: 'DNR-2', donor_name: null, collection_date: '2026-10-02', volume_ml: 400, blood_group: 'A+', screening_status: 'Pending', donation_status: 'Recorded', recorded_by: 'USR-STF01', recorded_at: '2026-10-02' },
      ]));
      const out = await repo.getDonationReport({});
      expect(out.totalDonations).toBe(2);
      expect(out.totalVolumeMl).toBe(850);
      expect(out.records[1].donorName).toBe('Anonymous');
    });

    it('handles null volume_ml in the sum', async () => {
      db.query.mockResolvedValueOnce(mkRes([
        { donation_id: 'DON-1', donor_id: 'DNR-1', donor_name: 'A', collection_date: '2026-10-01', volume_ml: null, blood_group: 'O+', screening_status: 'Passed', donation_status: 'Recorded', recorded_by: 'U', recorded_at: '2026-10-01' },
      ]));
      const out = await repo.getDonationReport({});
      expect(out.totalVolumeMl).toBe(0);
    });
  });

  // ── getRequestReport ───────────────────────────────────────────────
  describe('getRequestReport', () => {
    it('maps rows and sums units', async () => {
      db.query.mockResolvedValueOnce(mkRes([
        { request_id: 'R1', hospital_name: 'H1', patient_name: 'P1', blood_group: 'O+', units: 2, priority: 'High', status: 'Pending', request_date: '2026-10-01', decision_date: null, rejection_reason: null },
        { request_id: 'R2', hospital_name: 'H2', patient_name: 'P2', blood_group: 'A+', units: 1, priority: 'Low', status: 'Approved', request_date: '2026-10-02', decision_date: '2026-10-03', rejection_reason: null },
      ]));
      const out = await repo.getRequestReport({});
      expect(out.totalRequests).toBe(2);
      expect(out.totalUnitsRequested).toBe(3);
      expect(out.records[0].decisionDate).toBeNull();
      expect(out.records[0].rejectionReason).toBeNull();
    });

    it('handles null units in the sum', async () => {
      db.query.mockResolvedValueOnce(mkRes([
        { request_id: 'R1', hospital_name: 'H1', patient_name: 'P1', blood_group: 'O+', units: null, priority: 'High', status: 'Pending', request_date: '2026-10-01', decision_date: null, rejection_reason: null },
      ]));
      const out = await repo.getRequestReport({});
      expect(out.totalUnitsRequested).toBe(0);
    });
  });
});