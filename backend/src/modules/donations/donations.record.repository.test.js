const repo = require('./donations.record.repository');

describe('donations.record.repository', () => {
  describe('findDonorForUpdate', () => {
    it('returns the donor when found', async () => {
      const donor = { donor_id: 'DNR-0001', blood_group: 'O+' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [donor] }),
      };

      await expect(repo.findDonorForUpdate(tx, 'DNR-0001')).resolves.toEqual(donor);
      expect(tx.query.mock.calls[0][1]).toEqual(['DNR-0001']);
      expect(tx.query.mock.calls[0][0]).toContain('FOR UPDATE');
    });

    it('returns null when the donor is not found', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };

      await expect(repo.findDonorForUpdate(tx, 'DNR-9999')).resolves.toBeNull();
    });
  });

  describe('getToday', () => {
    it('uses the India date, not the database session time zone', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [{ today: '2026-10-27' }] }),
      };

      await expect(repo.getToday(tx)).resolves.toBe('2026-10-27');

      const [sql] = tx.query.mock.calls[0];
      expect(sql).toContain("AT TIME ZONE 'Asia/Kolkata'");
      expect(sql).not.toContain('CURRENT_DATE');
    });
  });

  describe('getConfig', () => {
    it('returns configuration values as an object', async () => {
      const rows = [
        { key: 'eligibility_min_age', value: '18' },
        { key: 'shelf_life_days', value: '35' },
      ];
      const tx = {
        query: jest.fn().mockResolvedValue({ rows }),
      };

      await expect(repo.getConfig(tx)).resolves.toEqual({
        eligibility_min_age: '18',
        shelf_life_days: '35',
      });
    });

    it('returns an empty object when no configuration exists', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };

      await expect(repo.getConfig(tx)).resolves.toEqual({});
    });
  });

  describe('nextDonationId', () => {
    it('returns the first ID when the table is empty', async () => {
      const tx = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      };

      await expect(repo.nextDonationId(tx)).resolves.toBe('DON-00000001');
      expect(tx.query).toHaveBeenCalledTimes(2);
    });

    it('increments the latest donation ID', async () => {
      const tx = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ donation_id: 'DON-00000025' }] }),
      };

      await expect(repo.nextDonationId(tx)).resolves.toBe('DON-00000026');
    });

    it('throws an error when the donation ID pool is exhausted', async () => {
      const tx = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ donation_id: 'DON-99999999' }] }),
      };

      await expect(repo.nextDonationId(tx)).rejects.toMatchObject({
        message: 'Donation ID pool exhausted',
        code: 'DONATION_ID_POOL_EXHAUSTED',
      });
    });
  });

  describe('nextUnitId', () => {
    it('returns the first ID when the table is empty', async () => {
      const tx = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      };

      await expect(repo.nextUnitId(tx)).resolves.toBe('UNT-00001');
      expect(tx.query).toHaveBeenCalledTimes(2);
    });

    it('increments the latest unit ID', async () => {
      const tx = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ unit_id: 'UNT-00025' }] }),
      };

      await expect(repo.nextUnitId(tx)).resolves.toBe('UNT-00026');
    });

    it('throws an error when the unit ID pool is exhausted', async () => {
      const tx = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ unit_id: 'UNT-99999' }] }),
      };

      await expect(repo.nextUnitId(tx)).rejects.toMatchObject({
        message: 'Unit ID pool exhausted',
        code: 'UNIT_ID_POOL_EXHAUSTED',
      });
    });
  });

  describe('insertDonation', () => {
    it('inserts a donation with the supplied values', async () => {
      const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      const donation = {
        donationId: 'DON-00000001',
        donorId: 'DNR-0001',
        collectionDate: '2026-10-27',
        volumeMl: 450,
        bloodGroup: 'O+',
        screeningStatus: 'Passed',
        donationStatus: 'Completed',
        recordedBy: 'STF-0001',
        medicalNotes: 'No issues',
      };

      await expect(repo.insertDonation(tx, donation)).resolves.toBeUndefined();

      expect(tx.query).toHaveBeenCalledTimes(1);
      expect(tx.query.mock.calls[0][1]).toEqual([
        donation.donationId,
        donation.donorId,
        donation.collectionDate,
        donation.volumeMl,
        donation.bloodGroup,
        donation.screeningStatus,
        donation.donationStatus,
        donation.recordedBy,
        donation.medicalNotes,
      ]);
    });
  });

  describe('insertUnit', () => {
    it('inserts a blood unit and returns its details', async () => {
      const unitResult = {
        unit_id: 'UNT-00001',
        expiry_date: '2026-12-01',
      };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [unitResult] }),
      };
      const unit = {
        unitId: 'UNT-00001',
        donationId: 'DON-00000001',
        bloodGroup: 'O+',
        volumeMl: 450,
        collectionDate: '2026-10-27',
        shelfLifeDays: 35,
      };

      await expect(repo.insertUnit(tx, unit)).resolves.toEqual(unitResult);

      expect(tx.query.mock.calls[0][1]).toEqual([
        unit.unitId,
        unit.donationId,
        unit.bloodGroup,
        unit.volumeMl,
        unit.collectionDate,
        unit.shelfLifeDays,
      ]);
      expect(tx.query.mock.calls[0][0]).toContain('RETURNING unit_id');
    });
  });
});
