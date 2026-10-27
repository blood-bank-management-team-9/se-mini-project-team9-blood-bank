const repo = require('./donations.repository');

describe('updateUnit shelf life (SRS 2.5, SAD C9/C13)', () => {
  it('reads the shelf life from system_config instead of a hard-coded value', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await repo.updateUnit(tx, 'DON-00000001', { collectionDate: '2026-10-02' });
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toContain("key = 'shelf_life_days'");
    expect(sql).not.toMatch(/\+ 35\b/);
    expect(params).toEqual(['DON-00000001', null, '2026-10-02']);
  });
});