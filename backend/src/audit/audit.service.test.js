const { logChange } = require('./audit.service');

it('inserts original and new values as JSON through the given transaction', async () => {
  const tx = { query: jest.fn().mockResolvedValue({}) };
  await logChange(tx, { userId: 7, action: 'DONATION_CORRECTED', entity: 'donation:DON-1', originalValue: { volumeMl: 350 }, newValue: { volumeMl: 450 } });
  const [sql, params] = tx.query.mock.calls[0];
  expect(sql).toMatch(/INSERT INTO audit_log/);
  expect(params).toEqual([7, 'DONATION_CORRECTED', 'donation:DON-1', '{"volumeMl":350}', '{"volumeMl":450}']);
});
