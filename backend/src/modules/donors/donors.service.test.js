jest.mock('../../database/transaction', () => ({
  withTransaction: jest.fn((callback) => callback({ query: jest.fn() })),
}));
jest.mock('../audit/audit.repository', () => ({
  logAudit: jest.fn(),
}));
jest.mock('./donors.repository', () => ({
  listDonors: jest.fn(),
  findDonorById: jest.fn(),
  nextDonorId: jest.fn(),
  createDonor: jest.fn(),
  updateDonor: jest.fn(),
  updateDonorStatus: jest.fn(),
  getEligibilityConfig: jest.fn(),
}));

const repo = require('./donors.repository');
const { logAudit } = require('../audit/audit.repository');
const donorService = require('./donors.service');

const donorRow = (overrides = {}) => ({
  donor_id: 'DNR-00006',
  full_name: 'Test Donor',
  date_of_birth: '1990-04-12',
  gender: 'Female',
  blood_group: 'O+',
  weight_kg: '58.00',
  phone: '9876501234',
  email: 'donor@test.local',
  address: null,
  city: 'Bangalore',
  pin_code: '560001',
  last_donation_date: null,
  status: 'Active',
  created_at: '2026-10-22T00:00:00.000Z',
  ...overrides,
});

describe('Donor service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a donor transactionally and audits the new profile', async () => {
    const details = { fullName: 'Test Donor' };
    repo.nextDonorId.mockResolvedValue('DNR-00006');
    repo.createDonor.mockResolvedValue(donorRow());

    const created = await donorService.createDonor({
      actorUserId: 'USR-STF01',
      donor: details,
    });

    expect(created).toMatchObject({
      donorId: 'DNR-00006',
      fullName: 'Test Donor',
      weightKg: 58,
      status: 'Active',
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'USR-STF01',
        action: 'DONOR_CREATED',
        entityId: 'DNR-00006',
      }),
      expect.any(Object)
    );
  });

  it('maps a duplicate phone constraint to a conflict error', async () => {
    repo.nextDonorId.mockResolvedValue('DNR-00006');
    repo.createDonor.mockRejectedValue({
      code: '23505',
      constraint: 'donors_phone_key',
    });

    await expect(donorService.createDonor({
      actorUserId: 'USR-STF01',
      donor: {},
    })).rejects.toMatchObject({
      code: 'ACCOUNT_EXISTS',
      status: 409,
    });
  });

  it('returns NOT_FOUND for an unknown donor during update', async () => {
    repo.findDonorById.mockResolvedValue(null);

    await expect(donorService.updateDonor({
      actorUserId: 'USR-STF01',
      donorId: 'DNR-99999',
      donor: {},
    })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(repo.updateDonor).not.toHaveBeenCalled();
  });

  it('evaluates donor eligibility using the configured rules', async () => {
    repo.findDonorById.mockResolvedValue(donorRow({
      date_of_birth: '2010-04-12',
      weight_kg: '40.00',
      last_donation_date: '2026-10-01',
    }));
    repo.getEligibilityConfig.mockResolvedValue({
      eligibility_min_age: '18',
      eligibility_max_age: '65',
      eligibility_min_weight_kg: '45',
      eligibility_gap_days_male: '90',
      eligibility_gap_days_other: '120',
    });

    const eligibility = await donorService.getDonorEligibility('DNR-00006');

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.ineligibilityReasons.map(({ code }) => code)).toEqual([
      'AGE_BELOW_MINIMUM',
      'WEIGHT_BELOW_MINIMUM',
      'DONATION_GAP_NOT_MET',
    ]);
    expect(repo.getEligibilityConfig).toHaveBeenCalledTimes(1);
  });

  it('returns NOT_FOUND before loading eligibility configuration for an unknown donor', async () => {
    repo.findDonorById.mockResolvedValue(null);

    await expect(donorService.getDonorEligibility('DNR-99999')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(repo.getEligibilityConfig).not.toHaveBeenCalled();
  });

  it('audits deactivation and reactivation as distinct state changes', async () => {
    repo.findDonorById
      .mockResolvedValueOnce(donorRow())
      .mockResolvedValueOnce(donorRow({ status: 'Inactive' }));
    repo.updateDonorStatus
      .mockResolvedValueOnce(donorRow({ status: 'Inactive' }))
      .mockResolvedValueOnce(donorRow({ status: 'Active' }));

    await donorService.setDonorStatus({
      actorUserId: 'USR-STF01',
      donorId: 'DNR-00006',
      status: 'Inactive',
    });
    await donorService.setDonorStatus({
      actorUserId: 'USR-STF01',
      donorId: 'DNR-00006',
      status: 'Active',
    });

    expect(logAudit.mock.calls.map(([event]) => event.action)).toEqual([
      'DONOR_DEACTIVATED',
      'DONOR_REACTIVATED',
    ]);
  });

  it('does not duplicate audit events for an unchanged status', async () => {
    repo.findDonorById.mockResolvedValue(donorRow());
    repo.updateDonorStatus.mockResolvedValue(donorRow());

    await donorService.setDonorStatus({
      actorUserId: 'USR-STF01',
      donorId: 'DNR-00006',
      status: 'Active',
    });

    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe('Donor service additional branch coverage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists donors and maps database rows to DTOs', async () => {
    repo.listDonors.mockResolvedValue([donorRow()]);
    const result = await donorService.listDonors({ status: 'Active' });
    expect(result.total).toBe(1);
    expect(result.donors[0]).toMatchObject({
      donorId: 'DNR-00006',
      fullName: 'Test Donor',
      weightKg: 58,
    });
  });

  it('returns a donor by ID', async () => {
    repo.findDonorById.mockResolvedValue(donorRow());
    const result = await donorService.getDonor('DNR-00006');
    expect(result.donorId).toBe('DNR-00006');
  });

  it('updates a donor and records an audit event', async () => {
    repo.findDonorById.mockResolvedValue(donorRow());
    repo.updateDonor.mockResolvedValue(donorRow({ full_name: 'Updated Donor' }));

    const result = await donorService.updateDonor({
      actorUserId: 'USR-STF01',
      donorId: 'DNR-00006',
      donor: { fullName: 'Updated Donor' },
    });

    expect(result.fullName).toBe('Updated Donor');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DONOR_UPDATED' }),
      expect.any(Object)
    );
  });

  it('passes through non-duplicate database errors during creation', async () => {
    const error = new Error('Database unavailable');
    repo.nextDonorId.mockResolvedValue('DNR-00006');
    repo.createDonor.mockRejectedValue(error);

    await expect(donorService.createDonor({
      actorUserId: 'USR-STF01',
      donor: {},
    })).rejects.toBe(error);
  });

  it('passes through non-duplicate database errors during update', async () => {
    const error = new Error('Database unavailable');
    repo.findDonorById.mockResolvedValue(donorRow());
    repo.updateDonor.mockRejectedValue(error);

    await expect(donorService.updateDonor({
      actorUserId: 'USR-STF01',
      donorId: 'DNR-00006',
      donor: {},
    })).rejects.toBe(error);
  });

  it('rejects an invalid donor status', async () => {
    await expect(donorService.setDonorStatus({
      actorUserId: 'USR-STF01',
      donorId: 'DNR-00006',
      status: 'Unknown',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  });

  it('returns NOT_FOUND when changing the status of an unknown donor', async () => {
    repo.findDonorById.mockResolvedValue(null);

    await expect(donorService.setDonorStatus({
      actorUserId: 'USR-STF01',
      donorId: 'DNR-99999',
      status: 'Inactive',
    })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

it('handles a null row while mapping donor list results', async () => {
  repo.listDonors.mockResolvedValue([null]);

  const result = await donorService.listDonors({});

  expect(result).toEqual({
    donors: [null],
    total: 1,
  });
});

it('passes through duplicate-key errors from other constraints', async () => {
  const error = {
    code: '23505',
    constraint: 'some_other_constraint',
  };

  repo.nextDonorId.mockResolvedValue('DNR-00006');
  repo.createDonor.mockRejectedValue(error);

  await expect(donorService.createDonor({
    actorUserId: 'USR-STF01',
    donor: {},
  })).rejects.toBe(error);
});

it('returns a donor DTO when the donor exists', async () => {
  const row = donorRow();
  repo.findDonorById.mockResolvedValue(row);

  const result = await donorService.getDonor('DNR-00006');

  expect(result).toMatchObject({
    donorId: 'DNR-00006',
    fullName: 'Test Donor',
    weightKg: 58,
  });
  expect(repo.findDonorById).toHaveBeenCalledWith('DNR-00006');
});

it('throws NOT_FOUND when getDonor receives no database row', async () => {
  repo.findDonorById.mockResolvedValue(null);

  await expect(
    donorService.getDonor('DNR-99999')
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    status: 404,
  });
});
