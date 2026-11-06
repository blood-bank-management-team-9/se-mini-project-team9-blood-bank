// src/modules/donations/donations.record.repository.test.js
// Unit tests for donations.record.repository.js (C8 recording, SAD 3.4, SD-2).
const repo = require('./donations.record.repository');

function txMock(rowsByCall) {
  // rowsByCall: array of { rows } responses, consumed in call order
  const queue = [...rowsByCall];
  return {
    query: jest.fn().mockImplementation(() => Promise.resolve(queue.shift() || { rows: [] })),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('donations.record.repository', () => {
  describe('findDonorForUpdate', () => {
    it('returns the donor row and uses FOR UPDATE', async () => {
      const tx = txMock([{ rows: [{ donor_id: 'DNR-1', gender: 'Male' }] }]);
      const row = await repo.findDonorForUpdate(tx, 'DNR-1');
      expect(row.donor_id).toBe('DNR-1');
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/FOR UPDATE/);
      expect(params).toEqual(['DNR-1']);
    });

    it('returns null when the donor does not exist', async () => {
      const tx = txMock([{ rows: [] }]);
      await expect(repo.findDonorForUpdate(tx, 'DNR-404')).resolves.toBeNull();
    });
  });

  describe('getToday (SAD 4.1: dates use Asia/Kolkata)', () => {
    it('uses AT TIME ZONE Asia/Kolkata and not CURRENT_DATE', async () => {
      const tx = txMock([{ rows: [{ today: '2026-10-27' }] }]);
      await expect(repo.getToday(tx)).resolves.toBe('2026-10-27');
      const [sql] = tx.query.mock.calls[0];
      expect(sql).toContain("AT TIME ZONE 'Asia/Kolkata'");
      expect(sql).not.toContain('CURRENT_DATE');
    });
  });

  describe('getConfig', () => {
    it('returns an object built from key/value rows', async () => {
      const tx = txMock([{
        rows: [
          { key: 'eligibility_min_age', value: '18' },
          { key: 'shelf_life_days', value: '35' },
        ],
      }]);
      const cfg = await repo.getConfig(tx);
      expect(cfg).toEqual({ eligibility_min_age: '18', shelf_life_days: '35' });
      const [, params] = tx.query.mock.calls[0];
      expect(params[0]).toContain('shelf_life_days');
    });
  });

  describe('nextDonationId', () => {
    it('takes advisory lock, then returns next id padded to 8 digits', async () => {
      const tx = txMock([
        { rows: [] },                                   // advisory lock
        { rows: [{ donation_id: 'DON-00000042' }] },    // current max
      ]);
      await expect(repo.nextDonationId(tx)).resolves.toBe('DON-00000043');
      expect(tx.query.mock.calls[0][0]).toMatch(/pg_advisory_xact_lock/);
    });

    it('starts at DON-00000001 when the table is empty', async () => {
      const tx = txMock([{ rows: [] }, { rows: [] }]);
      await expect(repo.nextDonationId(tx)).resolves.toBe('DON-00000001');
    });

    it('throws DONATION_ID_POOL_EXHAUSTED at max id', async () => {
      const tx = txMock([
        { rows: [] },
        { rows: [{ donation_id: 'DON-99999999' }] },
      ]);
      await expect(repo.nextDonationId(tx)).rejects.toMatchObject({
        code: 'DONATION_ID_POOL_EXHAUSTED',
      });
    });
  });

  describe('nextUnitId', () => {
    it('returns next unit id padded to 5 digits', async () => {
      const tx = txMock([{ rows: [] }, { rows: [{ unit_id: 'UNT-00009' }] }]);
      await expect(repo.nextUnitId(tx)).resolves.toBe('UNT-00010');
      expect(tx.query.mock.calls[0][0]).toMatch(/pg_advisory_xact_lock/);
    });

    it('starts at UNT-00001 when empty', async () => {
      const tx = txMock([{ rows: [] }, { rows: [] }]);
      await expect(repo.nextUnitId(tx)).resolves.toBe('UNT-00001');
    });

    it('throws UNIT_ID_POOL_EXHAUSTED at max id', async () => {
      const tx = txMock([{ rows: [] }, { rows: [{ unit_id: 'UNT-99999' }] }]);
      await expect(repo.nextUnitId(tx)).rejects.toMatchObject({
        code: 'UNIT_ID_POOL_EXHAUSTED',
      });
    });
  });

  describe('insertDonation', () => {
    it('binds all columns as parameters', async () => {
      const tx = txMock([{ rows: [] }]);
      await repo.insertDonation(tx, {
        donationId: 'DON-00000001',
        donorId: 'DNR-1',
        collectionDate: '2026-10-27',
        volumeMl: 450,
        bloodGroup: 'O+',
        screeningStatus: 'Pending',
        donationStatus: 'Recorded',
        recordedBy: 'USR-STF01',
        medicalNotes: null,
      });
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO donations/);
      expect(params).toEqual([
        'DON-00000001', 'DNR-1', '2026-10-27', 450, 'O+',
        'Pending', 'Recorded', 'USR-STF01', null,
      ]);
    });
  });

  describe('insertUnit', () => {
    it('binds all parameters and computes expiry from shelf life', async () => {
      const tx = txMock([{ rows: [{ unit_id: 'UNT-00001', expiry_date: '2026-12-01' }] }]);
      const row = await repo.insertUnit(tx, {
        unitId: 'UNT-00001',
        donationId: 'DON-00000001',
        bloodGroup: 'O+',
        volumeMl: 450,
        collectionDate: '2026-10-27',
        shelfLifeDays: 35,
      });
      expect(row.unit_id).toBe('UNT-00001');
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/\$5::date \+ \$6::int/);
      expect(params).toEqual(['UNT-00001', 'DON-00000001', 'O+', 450, '2026-10-27', 35]);
    });
  });
});