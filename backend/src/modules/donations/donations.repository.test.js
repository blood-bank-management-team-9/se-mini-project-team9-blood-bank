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
describe('donations.repository additional branch coverage', () => {
  it('returns a donation when the row exists', async () => {
    const row = { donation_id: 'DON-00000001' };
    const tx = { query: jest.fn().mockResolvedValue({ rows: [row] }) };
    await expect(repo.findDonationForUpdate(tx, 'DON-00000001')).resolves.toEqual(row);
  });

  it('returns null when the donation row does not exist', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(repo.findDonationForUpdate(tx, 'DON-99999999')).resolves.toBeNull();
  });

  it('returns a blood unit when one exists', async () => {
    const row = { unit_id: 'UNIT-00001', status: 'Available' };
    const tx = { query: jest.fn().mockResolvedValue({ rows: [row] }) };
    await expect(repo.findUnitForUpdate(tx, 'DON-00000001')).resolves.toEqual(row);
  });

  it('returns null when no blood unit exists', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(repo.findUnitForUpdate(tx, 'DON-00000001')).resolves.toBeNull();
  });

  it('updates donation fields and returns the updated row', async () => {
    const row = { donation_id: 'DON-00000001', volume_ml: 400 };
    const tx = { query: jest.fn().mockResolvedValue({ rows: [row] }) };

    const result = await repo.updateDonation(tx, 'DON-00000001', {
      volumeMl: 400,
      medicalNotes: 'Updated notes',
      collectionDate: '2026-10-02',
    });

    expect(result).toEqual(row);
    expect(tx.query.mock.calls[0][1]).toEqual([
      'DON-00000001',
      400,
      'Updated notes',
      '2026-10-02',
    ]);
  });

  it.each(['0', '-5', '1.5', 'invalid'])(
    'uses the default shelf life for invalid value %s',
    async (value) => {
      const tx = { query: jest.fn().mockResolvedValue({ rows: [{ value }] }) };
      await expect(repo.getShelfLifeDays(tx)).resolves.toBe(35);
    }
  );

  it('synchronizes the donor last donation date', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await repo.syncLastDonationDate(tx, 'DNR-00001');
    expect(tx.query).toHaveBeenCalledWith(
      expect.stringContaining('MAX(collection_date)'),
      ['DNR-00001']
    );
  });

  it('updates a blood unit using default null values', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await repo.updateUnit(tx, 'DON-00000001', {});
    expect(tx.query.mock.calls[0][1]).toEqual([
      'DON-00000001',
      null,
      null,
      null,
    ]);
  });

  it('returns null when the donor does not exist for gap lookup', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(repo.getDonorGapDays(tx, 'DNR-99999')).resolves.toBeNull();
  });

  it('uses the other-gender gap for non-male donors', async () => {
    const tx = {
      query: jest.fn().mockResolvedValue({
        rows: [{ gender: 'Female', male_gap: '90', other_gap: '120' }],
      }),
    };
    await expect(repo.getDonorGapDays(tx, 'DNR-00001')).resolves.toBe(120);
  });

  it.each([null, undefined, '', 'invalid', '0', '-3', '1.5'])(
    'returns null for an invalid gap configuration: %s',
    async (value) => {
      const tx = {
        query: jest.fn().mockResolvedValue({
          rows: [{ gender: 'Male', male_gap: value, other_gap: '120' }],
        }),
      };
      await expect(repo.getDonorGapDays(tx, 'DNR-00001')).resolves.toBeNull();
    }
  );

  it('returns a gap conflict when a matching donation exists', async () => {
    const row = { donation_id: 'DON-00000002' };
    const tx = { query: jest.fn().mockResolvedValue({ rows: [row] }) };
    await expect(repo.findGapConflict(tx, {
      donationId: 'DON-00000001',
      donorId: 'DNR-00001',
      collectionDate: '2026-10-02',
      gapDays: 90,
    })).resolves.toEqual(row);
  });

  it('returns null when no gap conflict exists', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(repo.findGapConflict(tx, {
      donationId: 'DON-00000001',
      donorId: 'DNR-00001',
      collectionDate: '2026-10-02',
      gapDays: 90,
    })).resolves.toBeNull();
  });
});

