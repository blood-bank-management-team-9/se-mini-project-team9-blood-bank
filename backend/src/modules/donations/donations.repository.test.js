const repo = require('./donations.repository');

describe('donations.repository', () => {
  describe('getShelfLifeDays (SRS 2.5, SAD C9/C13)', () => {
    it('returns the configured integer when valid', async () => {
      const tx = { query: jest.fn().mockResolvedValue({ rows: [{ value: '42' }] }) };
      const days = await repo.getShelfLifeDays(tx);
      expect(days).toBe(42);
      expect(tx.query).toHaveBeenCalledWith(
        "SELECT value FROM system_config WHERE key = 'shelf_life_days'"
      );
    });

    it('falls back to 35 if row is missing or non-numeric', async () => {
      const txMissing = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      expect(await repo.getShelfLifeDays(txMissing)).toBe(35);

      const txInvalid = { query: jest.fn().mockResolvedValue({ rows: [{ value: 'invalid_str' }] }) };
      expect(await repo.getShelfLifeDays(txInvalid)).toBe(35);
    });
  });

  describe('updateUnit', () => {
    it('passes shelf life as bound parameter $4 without hard-coded numbers or SQL cast crash', async () => {
      const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
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
  });

  describe('updateDonation guard', () => {
    it('throws when changes object is empty', async () => {
      const tx = { query: jest.fn() };
      await expect(repo.updateDonation(tx, 'DON-00000001', {})).rejects.toThrow(
        'No changes provided to updateDonation'
      );
      expect(tx.query).not.toHaveBeenCalled();
    });
  });

  describe('getDonorGapDays row lock', () => {
    it('locks donor row with FOR UPDATE to serialize concurrent gap checks', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({
          rows: [{ gender: 'Male', male_gap: '90', other_gap: '120' }],
        }),
      };
      const gap = await repo.getDonorGapDays(tx, 'DNR-00001');
      expect(gap).toBe(90);
      const [sql] = tx.query.mock.calls[0];
      expect(sql).toContain('FROM donors d WHERE d.donor_id = $1 FOR UPDATE');
    });
  });
});