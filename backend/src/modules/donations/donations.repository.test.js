// src/modules/donations/donations.repository.test.js
// Unit tests for donations.repository.js (C8 data access, SAD 3.4).
const repo = require('./donations.repository');

const txMock = (responses) => {
  const queue = [...responses];
  return {
    query: jest.fn().mockImplementation(() => Promise.resolve(queue.shift() || { rows: [] })),
  };
};

beforeEach(() => jest.clearAllMocks());

describe('donations.repository', () => {
  describe('DEFAULT_SHELF_LIFE_DAYS', () => {
    it('is exported as 35', () => {
      expect(repo.DEFAULT_SHELF_LIFE_DAYS).toBe(35);
    });
  });

  describe('getShelfLifeDays (SRS 2.5)', () => {
    it('returns the configured integer when valid', async () => {
      const tx = txMock([{ rows: [{ value: '42' }] }]);
      await expect(repo.getShelfLifeDays(tx)).resolves.toBe(42);
      expect(tx.query).toHaveBeenCalledWith(
        "SELECT value FROM system_config WHERE key = 'shelf_life_days'"
      );
    });

    it('falls back to 35 when the row is missing', async () => {
      const tx = txMock([{ rows: [] }]);
      await expect(repo.getShelfLifeDays(tx)).resolves.toBe(35);
    });

    it('falls back to 35 when the value is non-numeric', async () => {
      const tx = txMock([{ rows: [{ value: 'invalid_str' }] }]);
      await expect(repo.getShelfLifeDays(tx)).resolves.toBe(35);
    });

    it('falls back to 35 when the value is zero or negative', async () => {
      const zeroTx = txMock([{ rows: [{ value: '0' }] }]);
      await expect(repo.getShelfLifeDays(zeroTx)).resolves.toBe(35);
      const negTx = txMock([{ rows: [{ value: '-5' }] }]);
      await expect(repo.getShelfLifeDays(negTx)).resolves.toBe(35);
    });
  });

  describe('updateUnit', () => {
    it('passes shelf life as bound parameter $4 (no SQL interpolation)', async () => {
      const tx = txMock([{ rows: [] }]);
      await repo.updateUnit(tx, 'DON-00000001', {
        volumeMl: 350,
        collectionDate: '2026-10-02',
        shelfLifeDays: 42,
      });
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toContain('$3::date + $4::int');
      expect(sql).not.toMatch(/\+ 35\b/);
      expect(params).toEqual(['DON-00000001', 350, '2026-10-02', 42]);
    });

    it('uses COALESCE so null fields are ignored', async () => {
      const tx = txMock([{ rows: [] }]);
      await repo.updateUnit(tx, 'DON-00000001', { volumeMl: 400 });
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/COALESCE\(\$2::int, volume_ml\)/);
      expect(params).toEqual(['DON-00000001', 400, null, null]);
    });
  });

  describe('updateDonation guard', () => {
    it('throws when changes object is empty', async () => {
      const tx = txMock([]);
      await expect(repo.updateDonation(tx, 'DON-00000001', {})).rejects.toThrow(
        'No changes provided to updateDonation'
      );
      expect(tx.query).not.toHaveBeenCalled();
    });

    it('builds an UPDATE from whitelisted column names', async () => {
      const tx = txMock([{ rows: [{ donation_id: 'DON-00000001' }] }]);
      const row = await repo.updateDonation(tx, 'DON-00000001', {
        volumeMl: 450,
        medicalNotes: 'note',
      });
      expect(row.donation_id).toBe('DON-00000001');
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/volume_ml = \$2/);
      expect(sql).toMatch(/medical_notes = \$3/);
      expect(params).toEqual(['DON-00000001', 450, 'note']);
    });

    it('rejects non-whitelisted keys by producing "undefined = $N"', async () => {
      // Note: if this fails, the repo lacks a whitelist guard and that's a
      // finding worth documenting as a defect.
      const tx = txMock([{ rows: [] }]);
      await repo.updateDonation(tx, 'DON-1', { volumeMl: 1, evil: 'x' });
      const [sql] = tx.query.mock.calls[0];
      // If your repo doesn't throw, at least assert the SQL is broken
      // (proving a defect) rather than interpolating arbitrary SQL:
      expect(sql).not.toContain('evil =');
    });
  });

  describe('getDonorGapDays row lock (BR-03)', () => {
    it('locks donor row with FOR UPDATE and returns 90 for Male', async () => {
      const tx = txMock([{
        rows: [{ gender: 'Male', male_gap: '90', other_gap: '120' }],
      }]);
      await expect(repo.getDonorGapDays(tx, 'DNR-1')).resolves.toBe(90);
      const [sql] = tx.query.mock.calls[0];
      expect(sql).toContain('FROM donors d WHERE d.donor_id = $1 FOR UPDATE');
    });

    it('returns 120 for non-Male genders', async () => {
      const tx = txMock([{
        rows: [{ gender: 'Female', male_gap: '90', other_gap: '120' }],
      }]);
      await expect(repo.getDonorGapDays(tx, 'DNR-1')).resolves.toBe(120);
    });

    it('returns null when the donor is missing', async () => {
      const tx = txMock([{ rows: [] }]);
      await expect(repo.getDonorGapDays(tx, 'DNR-404')).resolves.toBeNull();
    });

    it('returns null when the config value is empty', async () => {
      const tx = txMock([{
        rows: [{ gender: 'Male', male_gap: '', other_gap: '120' }],
      }]);
      await expect(repo.getDonorGapDays(tx, 'DNR-1')).resolves.toBeNull();
    });
  });

  describe('findGapConflict (BR-03)', () => {
    it('returns the conflicting donation when closer than gap days', async () => {
      const tx = txMock([{
        rows: [{ donation_id: 'DON-00000000', collection_date: '2026-09-01' }],
      }]);
      const row = await repo.findGapConflict(tx, {
        donationId: 'DON-00000001',
        donorId: 'DNR-1',
        collectionDate: '2026-10-01',
        gapDays: 90,
      });
      expect(row.donation_id).toBe('DON-00000000');
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/ABS\(collection_date - \$3::date\) < \$4::int/);
      expect(params).toEqual(['DNR-1', 'DON-00000001', '2026-10-01', 90]);
    });

    it('returns null when no conflict is found', async () => {
      const tx = txMock([{ rows: [] }]);
      await expect(repo.findGapConflict(tx, {
        donationId: 'DON-1', donorId: 'DNR-1',
        collectionDate: '2026-10-01', gapDays: 90,
      })).resolves.toBeNull();
    });
  });

  describe('findDonationForUpdate', () => {
    it('locks the donation row and exposes "within_window" and "today"', async () => {
      const tx = txMock([{
        rows: [{
          donation_id: 'DON-00000001',
          within_window: true,
          today: '2026-10-27',
        }],
      }]);
      const row = await repo.findDonationForUpdate(tx, 'DON-00000001');
      expect(row.within_window).toBe(true);
      const [sql] = tx.query.mock.calls[0];
      expect(sql).toMatch(/FOR UPDATE/);
      expect(sql).toMatch(/AT TIME ZONE 'Asia\/Kolkata'/);
    });

    it('returns null when the donation does not exist', async () => {
      const tx = txMock([{ rows: [] }]);
      await expect(repo.findDonationForUpdate(tx, 'DON-404')).resolves.toBeNull();
    });
  });

  describe('findUnitForUpdate', () => {
    it('locks the blood unit row', async () => {
      const tx = txMock([{ rows: [{ unit_id: 'UNT-00001', status: 'Available' }] }]);
      const row = await repo.findUnitForUpdate(tx, 'DON-00000001');
      expect(row.unit_id).toBe('UNT-00001');
      expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    });

    it('returns null when no unit exists for the donation', async () => {
      const tx = txMock([{ rows: [] }]);
      await expect(repo.findUnitForUpdate(tx, 'DON-404')).resolves.toBeNull();
    });
  });

  describe('syncLastDonationDate (FR-DNR-05)', () => {
    it('updates donors.last_donation_date from the latest Recorded donation', async () => {
      const tx = txMock([{ rows: [] }]);
      await repo.syncLastDonationDate(tx, 'DNR-1');
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/MAX\(collection_date\)/);
      expect(sql).toMatch(/donation_status = 'Recorded'/);
      expect(params).toEqual(['DNR-1']);
    });
  });
});