jest.mock('../../database/transaction', () => ({
  withTransaction: jest.fn((callback) => callback({ query: jest.fn() })),
}));
jest.mock('../audit/audit.repository', () => ({ logAudit: jest.fn() }));
jest.mock('./donations.repository', () => ({
  findDonationForUpdate: jest.fn(),
  getShelfLifeDays: jest.fn(),
  getDonorGapDays: jest.fn(),
  findGapConflict: jest.fn(),
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
    repo.getShelfLifeDays.mockResolvedValue(35);
    repo.getDonorGapDays.mockResolvedValue(90);
    repo.findGapConflict.mockResolvedValue(null);
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

  it('blocks the edit when the blood unit is no longer Available and volume changes', async () => {
    repo.findUnitForUpdate.mockResolvedValue({ unit_id: 'UNT-10001', status: 'Issued' });
    await expect(donationService.correctDonation({ ...base, changes: { volumeMl: 350 } }))
      .rejects.toMatchObject({ code: 'INVALID_STATE', status: 409 });
    expect(repo.updateDonation).not.toHaveBeenCalled();
  });

  it('allows a notes-only edit even when the blood unit is Issued', async () => {
    repo.findUnitForUpdate.mockResolvedValue({ unit_id: 'UNT-10001', status: 'Issued' });
    await expect(
      donationService.correctDonation({ ...base, changes: { medicalNotes: 'Corrected notes' } })
    ).resolves.toMatchObject({ donationId: 'DON-00000001' });
    expect(repo.updateDonation).toHaveBeenCalledWith(
      expect.anything(), 'DON-00000001', { medicalNotes: 'Corrected notes' }
    );
    expect(repo.updateUnit).not.toHaveBeenCalled();
  });

  it('succeeds when donation has no unit (findUnitForUpdate returns null)', async () => {
    repo.findUnitForUpdate.mockResolvedValue(null);
    await expect(
      donationService.correctDonation({ ...base, changes: { volumeMl: 350 } })
    ).resolves.toMatchObject({ donationId: 'DON-00000001' });
    expect(repo.updateDonation).toHaveBeenCalledWith(
      expect.anything(), 'DON-00000001', { volumeMl: 350 }
    );
    expect(repo.updateUnit).not.toHaveBeenCalled();
  });

  it('rejects a collection date that would produce an already-expired blood unit', async () => {
    // collection_date 2026-09-01 + 35 days = 2026-10-06 <= today (2026-10-27)
    await expect(
      donationService.correctDonation({ ...base, changes: { collectionDate: '2026-09-01' } })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      publicMessage: expect.stringContaining('already-expired'),
    });
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
      expect.anything(), 'DON-00000001', { volumeMl: undefined, collectionDate: '2026-10-02', shelfLifeDays: 35 }
    );
    expect(repo.syncLastDonationDate).toHaveBeenCalledWith(expect.anything(), 'DNR-00001');
  });

  it('blocks a corrected date that breaks the minimum gap to another donation (422)', async () => {
    repo.findGapConflict.mockResolvedValue({ donation_id: 'DON-00000002', collection_date: '2026-09-20' });
    await expect(donationService.correctDonation({ ...base, changes: { collectionDate: '2026-10-02' } }))
      .rejects.toMatchObject({
        code: 'NOT_ELIGIBLE',
        status: 422,
        reasons: [expect.objectContaining({ code: 'DONATION_GAP_NOT_MET' })],
      });
    expect(repo.updateDonation).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('allows a corrected date exactly gapDays apart from another donation (boundary check)', async () => {
    // When the gap is exactly 90 days, findGapConflict returns null and correction succeeds
    repo.findGapConflict.mockResolvedValue(null);
    await expect(
      donationService.correctDonation({ ...base, changes: { collectionDate: '2026-10-02' } })
    ).resolves.toMatchObject({ donationId: 'DON-00000001' });
    expect(repo.updateDonation).toHaveBeenCalled();
  });

  it('skips gap check when a non-Recorded donation changes its collection date', async () => {
    repo.findDonationForUpdate.mockResolvedValue(row({ donation_status: 'Failed Screening' }));
    await donationService.correctDonation({ ...base, changes: { collectionDate: '2026-10-02' } });
    expect(repo.getDonorGapDays).not.toHaveBeenCalled();
    expect(repo.findGapConflict).not.toHaveBeenCalled();
    expect(repo.syncLastDonationDate).not.toHaveBeenCalled();
  });

  it('throws 500 CONFIG_ERROR when getDonorGapDays returns null for a Recorded donation', async () => {
    repo.getDonorGapDays.mockResolvedValue(null);
    await expect(
      donationService.correctDonation({ ...base, changes: { collectionDate: '2026-10-02' } })
    ).rejects.toMatchObject({
      code: 'CONFIG_ERROR',
      status: 500,
    });
    expect(repo.updateDonation).not.toHaveBeenCalled();
  });

  it('does not check the gap when the date is not changed', async () => {
    await donationService.correctDonation({ ...base, changes: { volumeMl: 350 } });
    expect(repo.getDonorGapDays).not.toHaveBeenCalled();
  });

  it('clears medical notes when an empty string is sent', async () => {
    await donationService.correctDonation({ ...base, changes: { medicalNotes: '   ' } });
    expect(repo.updateDonation).toHaveBeenCalledWith(
      expect.anything(), 'DON-00000001', { medicalNotes: null }
    );
    expect(repo.updateUnit).not.toHaveBeenCalled();
  });
});