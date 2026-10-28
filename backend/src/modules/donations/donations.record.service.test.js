jest.mock('../../database/transaction', () => ({
  withTransaction: jest.fn((callback) => callback({ query: jest.fn() })),
}));
jest.mock('../audit/audit.repository', () => ({ logAudit: jest.fn() }));
jest.mock('./donations.repository', () => ({
  findDonationForUpdate: jest.fn(),
  findUnitForUpdate: jest.fn(),
  updateDonation: jest.fn(),
  updateUnit: jest.fn(),
  syncLastDonationDate: jest.fn(),
}));
jest.mock('./donations.record.repository', () => ({
  findDonorForUpdate: jest.fn(),
  getToday: jest.fn(),
  getConfig: jest.fn(),
  nextDonationId: jest.fn(),
  nextUnitId: jest.fn(),
  insertDonation: jest.fn(),
  insertUnit: jest.fn(),
}));

const { logAudit } = require('../audit/audit.repository');
const { syncLastDonationDate } = require('./donations.repository');
const repo = require('./donations.record.repository');
const { recordDonation } = require('./donations.record.service');

const config = {
  eligibility_min_age: '18',
  eligibility_max_age: '65',
  eligibility_min_weight_kg: '45',
  eligibility_gap_days_male: '90',
  eligibility_gap_days_other: '120',
  shelf_life_days: '35',
};
const donor = (overrides = {}) => ({
  donor_id: 'DNR-00001',
  gender: 'Male',
  blood_group: 'B+',
  weight_kg: '72.5',
  status: 'Active',
  date_of_birth: '1995-04-12',
  last_donation_date: null,
  ...overrides,
});
const input = (overrides = {}) => ({
  donorId: 'DNR-00001',
  collectionDate: '2026-10-04',
  volumeMl: 350,
  screeningStatus: 'Passed',
  ...overrides,
});
const run = (overrides) => recordDonation({ actorUserId: 'USR-STF01', input: input(overrides) });

describe('Record donation (FR-DNR-01 to 05, BR-03, TC-04, TC-05, TC-27)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.findDonorForUpdate.mockResolvedValue(donor());
    repo.getToday.mockResolvedValue('2026-10-27');
    repo.getConfig.mockResolvedValue(config);
    repo.nextDonationId.mockResolvedValue('DON-00000005');
    repo.nextUnitId.mockResolvedValue('UNT-10005');
    repo.insertUnit.mockResolvedValue({ unit_id: 'UNT-10005', expiry_date: '2026-11-08' });
  });

  it('returns 404 for an unknown donor', async () => {
    repo.findDonorForUpdate.mockResolvedValue(null);
    await expect(run()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(repo.insertDonation).not.toHaveBeenCalled();
  });

  it('rejects a future collection date', async () => {
    await expect(run({ collectionDate: '2026-12-01' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(repo.insertDonation).not.toHaveBeenCalled();
  });

  it('requires a reason when screening fails', async () => {
    await expect(run({ screeningStatus: 'Failed' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    await expect(run({ screeningStatus: 'Failed', medicalNotes: '   ' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(repo.findDonorForUpdate).not.toHaveBeenCalled();
  });

  it('blocks an ineligible donor with the exact reasons (422)', async () => {
    repo.findDonorForUpdate.mockResolvedValue(donor({ last_donation_date: '2026-10-01' }));
    await expect(run({ collectionDate: '2026-10-27' })).rejects.toMatchObject({
      code: 'NOT_ELIGIBLE',
      status: 422,
      reasons: [expect.objectContaining({ code: 'DONATION_GAP_NOT_MET' })],
    });
    expect(repo.insertDonation).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('blocks a collection date earlier than the last donation date', async () => {
    repo.findDonorForUpdate.mockResolvedValue(donor({ last_donation_date: '2026-10-01' }));
    await expect(run({ collectionDate: '2026-06-01' })).rejects.toMatchObject({
      code: 'NOT_ELIGIBLE',
      status: 422,
      reasons: [expect.objectContaining({ code: 'DONATION_GAP_NOT_MET' })],
    });
    expect(repo.insertDonation).not.toHaveBeenCalled();
  });

  it('also blocks a failed screening for an ineligible donor (eligibility is checked before any record is saved)', async () => {
    repo.findDonorForUpdate.mockResolvedValue(donor({ last_donation_date: '2026-10-01' }));
    await expect(run({ collectionDate: '2026-10-27', screeningStatus: 'Failed', medicalNotes: 'Low haemoglobin' }))
      .rejects.toMatchObject({ code: 'NOT_ELIGIBLE', status: 422 });
    expect(repo.insertDonation).not.toHaveBeenCalled();
  });

  it('blocks an inactive donor (422)', async () => {
    repo.findDonorForUpdate.mockResolvedValue(donor({ status: 'Inactive' }));
    await expect(run()).rejects.toMatchObject({
      code: 'NOT_ELIGIBLE',
      status: 422,
      reasons: [expect.objectContaining({ code: 'DONOR_INACTIVE' })],
    });
  });

  it('records a passed donation, creates an Available unit and updates the last donation date', async () => {
    const result = await run();
    expect(result).toEqual({
      donationId: 'DON-00000005',
      donationStatus: 'Recorded',
      unitId: 'UNT-10005',
      expiryDate: '2026-11-08',
    });
    expect(repo.insertDonation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      donationId: 'DON-00000005',
      bloodGroup: 'B+',
      donationStatus: 'Recorded',
      recordedBy: 'USR-STF01',
    }));
    expect(repo.insertUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      unitId: 'UNT-10005',
      collectionDate: '2026-10-04',
      shelfLifeDays: 35,
    }));
    expect(syncLastDonationDate).toHaveBeenCalledWith(expect.anything(), 'DNR-00001');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DONATION_RECORDED', entityId: 'DON-00000005', userId: 'USR-STF01' }),
      expect.anything()
    );
  });

  it('uses the configured shelf life', async () => {
    repo.getConfig.mockResolvedValue({ ...config, shelf_life_days: '40' });
    await run();
    expect(repo.insertUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ shelfLifeDays: 40 }));
  });

  it('saves a failed screening without a unit and without touching the last donation date', async () => {
    const result = await run({ screeningStatus: 'Failed', medicalNotes: 'Low haemoglobin' });
    expect(result).toEqual({
      donationId: 'DON-00000005',
      donationStatus: 'Failed Screening',
      unitId: null,
      expiryDate: null,
    });
    expect(repo.insertDonation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      donationStatus: 'Failed Screening',
      medicalNotes: 'Low haemoglobin',
    }));
    expect(repo.insertUnit).not.toHaveBeenCalled();
    expect(syncLastDonationDate).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCREENING_FAILED' }),
      expect.anything()
    );
  });
});