const { validateDiscard, validUnitId, DISCARD_REASONS } = require('./discard.validation');

describe('validateDiscard (FR-STK-06)', () => {
  it('accepts every listed reason', () => {
    for (const reason of DISCARD_REASONS) expect(validateDiscard({ reason })).toEqual({ value: { reason }, fields: [] });
  });
  it('blocks a missing or blank reason', () => {
    for (const body of [{}, undefined, null, { reason: '' }]) {
      expect(validateDiscard(body).fields[0]).toMatchObject({ field: 'reason', message: expect.stringMatching(/Select a reason/) });
    }
  });
  it('blocks a reason that is not in the list', () => {
    expect(validateDiscard({ reason: 'Bored' }).fields[0].message).toMatch(/Hemolyzed/);
  });
});

describe('validUnitId', () => {
  it('accepts UNT-XXXXX and rejects anything else', () => {
    expect(validUnitId('UNT-00012')).toBe(true);
    expect(validUnitId('UNT-1')).toBe(false);
    expect(validUnitId("UNT-1'; DROP")).toBe(false);
  });
});
