const { validateCorrection, validDonationId } = require('./correction.validation');
const NOW = new Date('2026-10-12T06:00:00Z');

describe('validateCorrection', () => {
  it('accepts valid fields', () => {
    const r = validateCorrection({ collectionDate: '2026-10-10', volumeMl: 450, screeningStatus: 'Failed', medicalNotes: ' low iron ' }, NOW);
    expect(r.fields).toEqual([]);
    expect(r.value).toEqual({ collectionDate: '2026-10-10', volumeMl: 450, screeningStatus: 'Failed', medicalNotes: 'low iron' });
  });
  it('rejects an empty body', () => {
    expect(validateCorrection({}, NOW).fields[0].field).toBe('body');
    expect(validateCorrection(null, NOW).fields[0].field).toBe('body');
  });
  it('rejects fields that cannot be corrected', () => {
    expect(validateCorrection({ donorId: 'D9' }, NOW).fields[0]).toMatchObject({ field: 'donorId' });
  });
  it('rejects bad volume, status, date and notes', () => {
    const r = validateCorrection({ volumeMl: 300, screeningStatus: 'Maybe', collectionDate: '2026-02-30', medicalNotes: 'x'.repeat(501) }, NOW);
    expect(r.fields.map((f) => f.field).sort()).toEqual(['collectionDate', 'medicalNotes', 'screeningStatus', 'volumeMl']);
  });
  it('rejects a future collection date', () => {
    expect(validateCorrection({ collectionDate: '2026-10-13' }, NOW).fields[0].message).toMatch(/future/);
  });
});

describe('validDonationId', () => {
  it('allows simple IDs and blocks odd characters', () => {
    expect(validDonationId('DON-00012')).toBe(true);
    expect(validDonationId("1'; DROP TABLE")).toBe(false);
  });
});
