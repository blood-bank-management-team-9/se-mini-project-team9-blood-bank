const { todayInTz, stamp } = require('./dates');

describe('todayInTz (Asia/Kolkata)', () => {
  it('rolls over at 00:00 IST, which is 18:30 UTC the day before', () => {
    expect(todayInTz(new Date('2026-10-03T18:29:00Z'))).toBe('2026-10-03');
    expect(todayInTz(new Date('2026-10-03T18:30:00Z'))).toBe('2026-10-04');
  });
});

describe('stamp', () => {
  it('is filename safe', () => {
    expect(stamp(new Date('2026-10-12T02:00:00Z'))).toBe('20261012-020000');
  });
});
