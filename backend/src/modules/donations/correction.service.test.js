const { correctDonation } = require('./correction.service');

const CREATED = new Date('2026-10-11T10:00:00Z');
const base = () => ({
  donation: { donation_id: 'DON-1', donor_id: 'D1', collection_date: '2026-10-11', volume_ml: 350, blood_group: 'B+',
    screening_status: 'Passed', donation_status: 'Recorded', medical_notes: null, created_at: CREATED },
  unit: { unit_id: 'UNT-00001', status: 'Available', volume_ml: 350, collection_date: '2026-10-11', expiry_date: '2026-11-15' },
});

const setup = (over = {}) => {
  const data = { ...base(), ...over };
  const log = [];
  const repo = {
    findDonationForUpdate: jest.fn().mockResolvedValue(data.donation),
    findUnitForUpdate: jest.fn().mockResolvedValue(data.unit),
    updateDonation: jest.fn(async (...a) => log.push(['donation', a[2]])),
    updateUnit: jest.fn(async (...a) => log.push(['unit', a[2]])),
  };
  const audit = { logChange: jest.fn().mockResolvedValue() };
  let rolledBack = false;
  const tx = async (fn) => { try { return await fn({}); } catch (e) { rolledBack = true; throw e; } };
  return { repo, audit, tx, log, deps: { repo, audit, tx }, wasRolledBack: () => rolledBack };
};
const at = (iso) => new Date(iso);
const run = (s, changes, now = at('2026-10-11T20:00:00Z')) =>
  correctDonation({ donationId: 'DON-1', changes, staffId: 7, now }, s.deps);

describe('correctDonation (FR-DNR-06)', () => {
  it('corrects the volume within 24h, updates the unit and audits original and new value (TC-27)', async () => {
    const s = setup();
    const res = await run(s, { volumeMl: 450 });
    expect(res).toEqual({ donationId: 'DON-1', updated: { volumeMl: 450 } });
    expect(s.repo.updateUnit).toHaveBeenCalledWith({}, 'UNT-00001', { volumeMl: 450 });
    expect(s.audit.logChange).toHaveBeenCalledWith({}, expect.objectContaining({
      userId: 7, action: 'DONATION_CORRECTED', entity: 'donation:DON-1',
      originalValue: { volumeMl: 350 }, newValue: { volumeMl: 450 },
    }));
  });

  it('allows an edit at exactly 24 hours', async () => {
    const s = setup();
    await expect(run(s, { volumeMl: 450 }, at('2026-10-12T10:00:00Z'))).resolves.toBeDefined();
  });

  it('refuses an edit after 24 hours with EDIT_WINDOW_EXPIRED and changes nothing', async () => {
    const s = setup();
    await expect(run(s, { volumeMl: 450 }, at('2026-10-12T10:00:01Z'))).rejects.toMatchObject({ status: 409, code: 'EDIT_WINDOW_EXPIRED' });
    expect(s.repo.updateDonation).not.toHaveBeenCalled();
    expect(s.audit.logChange).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for an unknown donation', async () => {
    const s = setup({ donation: null });
    await expect(run(s, { volumeMl: 450 })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('recomputes the unit expiry when the collection date changes', async () => {
    const s = setup();
    const res = await run(s, { collectionDate: '2026-10-10' });
    expect(s.repo.updateUnit).toHaveBeenCalledWith({}, 'UNT-00001', { collectionDate: '2026-10-10', expiryDate: '2026-11-14' });
    expect(res.updated.expiryDate).toBe('2026-11-14');
  });

  it('refuses when the unit is already Reserved or Issued', async () => {
    const s = setup({ unit: { ...base().unit, status: 'Reserved' } });
    await expect(run(s, { volumeMl: 450 })).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
    expect(s.repo.updateDonation).not.toHaveBeenCalled();
  });

  it('Passed to Failed discards the unit and sets Failed Screening', async () => {
    const s = setup();
    const res = await run(s, { screeningStatus: 'Failed' });
    expect(s.repo.updateUnit).toHaveBeenCalledWith({}, 'UNT-00001', expect.objectContaining({ status: 'Discarded' }));
    expect(s.repo.updateDonation).toHaveBeenCalledWith({}, 'DON-1', expect.objectContaining({ donationStatus: 'Failed Screening' }));
    expect(res.updated.unitStatus).toBe('Discarded');
  });

  it('never turns a Failed screening into Passed', async () => {
    const s = setup({ donation: { ...base().donation, screening_status: 'Failed', donation_status: 'Failed Screening' }, unit: null });
    await expect(run(s, { screeningStatus: 'Passed' })).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
  });

  it('does nothing and writes no audit row when nothing actually changes', async () => {
    const s = setup();
    expect(await run(s, { volumeMl: 350 })).toEqual({ donationId: 'DON-1', updated: {} });
    expect(s.audit.logChange).not.toHaveBeenCalled();
  });

  it('rolls back when the audit write fails (atomic)', async () => {
    const s = setup();
    s.audit.logChange.mockRejectedValue(new Error('audit down'));
    await expect(run(s, { volumeMl: 450 })).rejects.toThrow('audit down');
    expect(s.wasRolledBack()).toBe(true);
  });
});
