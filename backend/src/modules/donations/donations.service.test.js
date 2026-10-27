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

const { logAudit } = require('../audit/audit.repository');
const repo = require('./donations.repository');
const donationService = require('./donations.service');

const base = { actorUserId: 'USR-STF01', donationId: 'DON-00000001' };
const row = (overrides = {}) => ({
  donation_id: 'DON-00000001',
  donor_id: 'DNR-00001',
  donation_status: 'Recorded',
  volume_ml: 450,
  medical_notes: 'old note',
  collection_date: '2026-10-01',
  today: '2026-10-27',
  within_window: true,
  ...overrides,
});
const updatedRow = {
  donation_id: 'DON-00000001', volume_ml: 350, medical_notes: 'old note', collection_date: '2026-10-01',
};

describe('Donation correction (FR-DNR-06, TC-27)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.findDonationForUpdate.mockResolvedValue(row());
    repo.findUnitForUpdate.mockResolvedValue({ unit_id: 'UNT-10001', status: 'Available' });
    repo.updateDonation.mockResolvedValue(updatedRow);
  });

  it('rejects a request with no fields', async () => {
    await expect(donationService.correctDonation({ ...base, changes: {} }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(repo.findDonationForUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown donation', async () => {
    repo.findDonationForUpdate.mockResolvedValue(null);
    await expect(donationService.correctDonation({ ...base, changes: { volumeMl: 350 } }))
      .rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('refuses an edit after 24 hours', async () => {
    repo.findDonationForUpdate.mockResolvedValue(row({ within_window: false }));
    await expect(donationService.correctDonation({ ...base, changes: { volumeMl: 350 } }))
      .rejects.toMatchObject({ code: 'EDIT_WINDOW_EXPIRED', status: 409 });
    expect(repo.updateDonation).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('rejects a future collection date', async () => {
    await expect(donationService.correctDonation({ ...base, changes: { collectionDate: '2026-12-01' } }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(repo.updateDonation).not.toHaveBeenCalled();
  });

  it('rejects an edit that changes nothing', async () => {
    await expect(donationService.correctDonation({ ...base, changes: { volumeMl: 450 } }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('blocks the edit when the blood unit is no longer Available', async () => {
    repo.findUnitForUpdate.mockResolvedValue({ unit_id: 'UNT-10001', status: 'Issued' });
    await expect(donationService.correctDonation({ ...base, changes: { volumeMl: 350 } }))
      .rejects.toMatchObject({ code: 'INVALID_STATE', status: 409 });
    expect(repo.updateDonation).not.toHaveBeenCalled();
  });

  it('corrects the volume, syncs the unit and audits original and new value', async () => {
    const result = await donationService.correctDonation({ ...base, changes: { volumeMl: 350 } });
    expect(result).toMatchObject({ donationId: 'DON-00000001', volumeMl: 350 });
    expect(repo.updateDonation).toHaveBeenCalledWith(expect.anything(), 'DON-00000001', { volumeMl: 350 });
    expect(repo.updateUnit).toHaveBeenCalled();
    expect(repo.syncLastDonationDate).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'USR-STF01',
        action: 'DONATION_CORRECTED',
        entityId: 'DON-00000001',
        originalValue: { volumeMl: 450 },
        newValue: { volumeMl: 350, staffId: 'USR-STF01' },
      }),
      expect.anything()
    );
  });

  it('recalculates the unit and the donor last donation date when the date changes', async () => {
    await donationService.correctDonation({ ...base, changes: { collectionDate: '2026-10-02' } });
    expect(repo.updateUnit).toHaveBeenCalledWith(
      expect.anything(), 'DON-00000001', { collectionDate: '2026-10-02' }
    );
    expect(repo.syncLastDonationDate).toHaveBeenCalledWith(expect.anything(), 'DNR-00001');
  });

  it('clears medical notes when an empty string is sent', async () => {
    await donationService.correctDonation({ ...base, changes: { medicalNotes: '   ' } });
    expect(repo.updateDonation).toHaveBeenCalledWith(
      expect.anything(), 'DON-00000001', { medicalNotes: null }
    );
    expect(repo.updateUnit).not.toHaveBeenCalled();
  });
});