// C6 Donor Management — unit tests for donors.service.js
// Mocks the repository layer so no database is required.

jest.mock('../../database/transaction', () => ({
  withTransaction: jest.fn((callback) => callback({ query: jest.fn() })),
}));
jest.mock('../audit/audit.repository', () => ({
  logAudit: jest.fn(),
}));
jest.mock('./donors.repository', () => ({
  listDonors: jest.fn(),
  findDonorById: jest.fn(),
  findDonorByUserId: jest.fn(),
  findDonorAccountById: jest.fn(),
  findDonorByPhone: jest.fn(),
  linkDonorToUser: jest.fn(),
  listDonationHistory: jest.fn(),
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

  it('links a donor record matching the authenticated donor account phone', async () => {
    repo.findDonorByUserId.mockResolvedValue(null);
    repo.findDonorAccountById.mockResolvedValue({ phone: '9876501234' });
    repo.findDonorByPhone.mockResolvedValue({ donor_id: 'DNR-00006', user_id: null });
    repo.linkDonorToUser.mockResolvedValue({ donor_id: 'DNR-00006' });

    await expect(donorService.linkDonorAccount({
      userId: 'USR-DNR01',
      role: 'Donor',
    })).resolves.toEqual({ donorId: 'DNR-00006' });

    expect(repo.findDonorByPhone).toHaveBeenCalledWith('9876501234', expect.any(Object));
    expect(repo.linkDonorToUser).toHaveBeenCalledWith(
      expect.any(Object),
      'DNR-00006',
      'USR-DNR01'
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'USR-DNR01',
        action: 'DONOR_ACCOUNT_LINKED',
        entityId: 'DNR-00006',
      }),
      expect.any(Object)
    );
  });

  it('does not link a donor record already claimed by another account', async () => {
    repo.findDonorByUserId.mockResolvedValue(null);
    repo.findDonorAccountById.mockResolvedValue({ phone: '9876501234' });
    repo.findDonorByPhone.mockResolvedValue({
      donor_id: 'DNR-00006',
      user_id: 'USR-DNR02',
    });

    await expect(donorService.linkDonorAccount({
      userId: 'USR-DNR01',
      role: 'Donor',
    })).rejects.toMatchObject({
      code: 'DONOR_ALREADY_LINKED',
      status: 409,
    });
    expect(repo.linkDonorToUser).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('returns only donation history belonging to the authenticated linked donor', async () => {
    // Updated to return the full donor row, because the service now evaluates eligibility
    repo.findDonorByUserId.mockResolvedValue(donorRow());
    repo.getEligibilityConfig.mockResolvedValue({
      eligibility_min_age: '18',
      eligibility_max_age: '65',
      eligibility_min_weight_kg: '45',
      eligibility_gap_days_male: '90',
      eligibility_gap_days_other: '120',
    });
    repo.listDonationHistory.mockResolvedValue([{
      donation_id: 'DON-00000001',
      collection_date: '2026-10-01',
      volume_ml: 350,
      blood_group: 'O+',
      screening_status: 'Passed',
      donation_status: 'Recorded',
    }]);

    const result = await donorService.getOwnDonationHistory('USR-DNR01', 'Donor');

    expect(result).toEqual({
      donorId: 'DNR-00006',
      bloodGroup: 'O+',
      gender: 'Female',
      eligibility: expect.objectContaining({ eligible: true }),
      donations: [{
        donationId: 'DON-00000001',
        collectionDate: '2026-10-01',
        volumeMl: 350,
        bloodGroup: 'O+',
        screeningStatus: 'Passed',
        donationStatus: 'Recorded',
      }],
      total: 1,
    });
    expect(repo.listDonationHistory).toHaveBeenCalledWith('USR-DNR01');
  });

  it('does not return a history for an unlinked donor account', async () => {
    repo.findDonorByUserId.mockResolvedValue(null);

    await expect(donorService.getOwnDonationHistory('USR-DNR01', 'Donor')).rejects.toMatchObject({
      code: 'DONOR_NOT_LINKED',
      status: 404,
    });
    expect(repo.listDonationHistory).not.toHaveBeenCalled();
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