const repo = require('./donations.record.repository');

describe('getToday (SAD 4.1: dates use Asia/Kolkata)', () => {
  it('uses the India date, not the database session time zone', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ today: '2026-10-27' }] }) };
    await expect(repo.getToday(tx)).resolves.toBe('2026-10-27');
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toContain("AT TIME ZONE 'Asia/Kolkata'");
    expect(sql).not.toContain('CURRENT_DATE');
  });
});
