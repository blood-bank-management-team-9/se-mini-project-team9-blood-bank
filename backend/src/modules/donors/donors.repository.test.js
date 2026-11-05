jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/db');
const repo = require('./donors.repository');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('donors.repository', () => {
  describe('listDonors', () => {
    it('lists all donors without filters', async () => {
      const donors = [{ donor_id: 'DNR-00001' }];
      query.mockResolvedValue({ rows: donors });

      await expect(repo.listDonors()).resolves.toEqual(donors);

      expect(query.mock.calls[0][1]).toEqual([]);
      expect(query.mock.calls[0][0]).not.toContain('WHERE');
    });

    it('filters donors by status', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listDonors({ status: 'Active' });

      expect(query.mock.calls[0][1]).toEqual(['Active']);
      expect(query.mock.calls[0][0]).toContain('status = $1');
    });

    it('filters donors by blood group', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listDonors({ bloodGroup: 'O+' });

      expect(query.mock.calls[0][1]).toEqual(['O+']);
      expect(query.mock.calls[0][0]).toContain('blood_group = $1');
    });

    it('searches donors by name, phone or email', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listDonors({ q: 'Rohan' });

      expect(query.mock.calls[0][1]).toEqual(['%Rohan%']);
      expect(query.mock.calls[0][0]).toContain('ILIKE');
    });

    it('combines all supplied filters', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listDonors({
        status: 'Active',
        bloodGroup: 'O+',
        q: 'Rohan',
      });

      expect(query.mock.calls[0][1]).toEqual([
        'Active',
        'O+',
        '%Rohan%',
      ]);
      expect(query.mock.calls[0][0]).toContain('status = $1');
      expect(query.mock.calls[0][0]).toContain('blood_group = $2');
      expect(query.mock.calls[0][0]).toContain('ILIKE $3');
      expect(query.mock.calls[0][0]).toContain(' AND ');
    });
  });

  describe('findDonorById', () => {
    it('returns a donor without a transaction', async () => {
      const donor = { donor_id: 'DNR-00001' };
      query.mockResolvedValue({ rows: [donor] });

      await expect(repo.findDonorById('DNR-00001')).resolves.toEqual(donor);

      expect(query.mock.calls[0][0]).not.toContain('FOR UPDATE');
      expect(query.mock.calls[0][1]).toEqual(['DNR-00001']);
    });

    it('returns null when the donor is not found', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(repo.findDonorById('DNR-99999')).resolves.toBeNull();
    });

    it('uses the transaction and locks the donor row', async () => {
      const donor = { donor_id: 'DNR-00002' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [donor] }),
      };

      await expect(
        repo.findDonorById('DNR-00002', tx)
      ).resolves.toEqual(donor);

      expect(tx.query.mock.calls[0][0]).toContain('FOR UPDATE');
      expect(tx.query.mock.calls[0][1]).toEqual(['DNR-00002']);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('nextDonorId', () => {
    it('returns the first ID when the table is empty', async () => {
      const tx = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      };

      await expect(repo.nextDonorId(tx)).resolves.toBe('DNR-00001');
      expect(tx.query).toHaveBeenCalledTimes(2);
    });

    it('increments the latest donor ID', async () => {
      const tx = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ donor_id: 'DNR-00025' }],
          }),
      };

      await expect(repo.nextDonorId(tx)).resolves.toBe('DNR-00026');
    });

    it('throws an error when the donor ID pool is exhausted', async () => {
      const tx = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ donor_id: 'DNR-99999' }],
          }),
      };

      await expect(repo.nextDonorId(tx)).rejects.toMatchObject({
        message: 'Donor ID pool exhausted',
        code: 'DONOR_ID_POOL_EXHAUSTED',
      });
    });
  });

  describe('createDonor', () => {
    const donor = {
      fullName: 'Test Donor',
      dob: '2000-01-01',
      gender: 'Male',
      bloodGroup: 'O+',
      weightKg: 65,
      phone: '9876543210',
      email: 'test@example.com',
      address: 'Test Street',
      city: 'Bengaluru',
      pinCode: '560001',
    };

    it('creates a donor with email and address', async () => {
      const created = { donor_id: 'DNR-00001' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [created] }),
      };

      await expect(
        repo.createDonor(tx, 'DNR-00001', donor)
      ).resolves.toEqual(created);

      expect(tx.query.mock.calls[0][1]).toEqual([
        'DNR-00001',
        donor.fullName,
        donor.dob,
        donor.gender,
        donor.bloodGroup,
        donor.weightKg,
        donor.phone,
        donor.email,
        donor.address,
        donor.city,
        donor.pinCode,
      ]);
    });

    it('uses null when email and address are missing', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [{ donor_id: 'DNR-00002' }] }),
      };
      const donorWithoutOptionalFields = {
        ...donor,
        email: '',
        address: '',
      };

      await repo.createDonor(tx, 'DNR-00002', donorWithoutOptionalFields);

      expect(tx.query.mock.calls[0][1][7]).toBeNull();
      expect(tx.query.mock.calls[0][1][8]).toBeNull();
    });
  });

  describe('updateDonor', () => {
    const donor = {
      fullName: 'Updated Donor',
      dob: '2000-01-01',
      gender: 'Female',
      bloodGroup: 'A+',
      weightKg: 60,
      phone: '9876543210',
      email: 'updated@example.com',
      address: 'Updated Street',
      city: 'Bengaluru',
      pinCode: '560002',
    };

    it('updates a donor and returns the updated record', async () => {
      const updated = { donor_id: 'DNR-00001', full_name: 'Updated Donor' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [updated] }),
      };

      await expect(
        repo.updateDonor(tx, 'DNR-00001', donor)
      ).resolves.toEqual(updated);

      expect(tx.query.mock.calls[0][1]).toEqual([
        'DNR-00001',
        donor.fullName,
        donor.dob,
        donor.gender,
        donor.bloodGroup,
        donor.weightKg,
        donor.phone,
        donor.email,
        donor.address,
        donor.city,
        donor.pinCode,
      ]);
    });

    it('uses null for missing email and address', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      const donorWithoutOptionalFields = {
        ...donor,
        email: null,
        address: undefined,
      };

      await expect(
        repo.updateDonor(tx, 'DNR-00001', donorWithoutOptionalFields)
      ).resolves.toBeNull();

      expect(tx.query.mock.calls[0][1][7]).toBeNull();
      expect(tx.query.mock.calls[0][1][8]).toBeNull();
    });

    it('returns null when no donor is updated', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };

      await expect(
        repo.updateDonor(tx, 'DNR-99999', donor)
      ).resolves.toBeNull();
    });
  });

  describe('updateDonorStatus', () => {
    it('updates donor status and returns the record', async () => {
      const updated = { donor_id: 'DNR-00001', status: 'Inactive' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [updated] }),
      };

      await expect(
        repo.updateDonorStatus(tx, 'DNR-00001', 'Inactive')
      ).resolves.toEqual(updated);

      expect(tx.query.mock.calls[0][1]).toEqual([
        'DNR-00001',
        'Inactive',
      ]);
    });

    it('returns null when no donor is updated', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };

      await expect(
        repo.updateDonorStatus(tx, 'DNR-99999', 'Inactive')
      ).resolves.toBeNull();
    });
  });

  describe('getEligibilityConfig', () => {
    it('returns eligibility configuration as an object', async () => {
      const rows = [
        { key: 'eligibility_min_age', value: '18' },
        { key: 'eligibility_max_age', value: '65' },
      ];
      query.mockResolvedValue({ rows });

      await expect(repo.getEligibilityConfig()).resolves.toEqual({
        eligibility_min_age: '18',
        eligibility_max_age: '65',
      });
    });

    it('returns an empty object when no configuration exists', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(repo.getEligibilityConfig()).resolves.toEqual({});
    });
  });
});
