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
