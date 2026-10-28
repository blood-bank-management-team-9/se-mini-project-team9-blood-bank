const repo = require('./donations.repository');

describe('findDonationForUpdate today (SAD 4.1: dates use Asia/Kolkata)', () => {
  it('uses the India date, not the database session time zone', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await repo.findDonationForUpdate(tx, 'DON-00000001');
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toContain("AT TIME ZONE 'Asia/Kolkata'");
    expect(sql).not.toContain('CURRENT_DATE');
  });
});