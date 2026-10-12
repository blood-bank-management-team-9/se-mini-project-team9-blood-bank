const repo = require('./discard.repository');

it('locks the unit row (ADR-06) and passes the ID as a parameter', async () => {
  const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  await repo.findUnitForUpdate(tx, "UNT-1'; DROP TABLE blood_units;--");
  const [sql, params] = tx.query.mock.calls[0];
  expect(sql).toMatch(/FOR UPDATE/);
  expect(sql).not.toMatch(/DROP/);
  expect(params).toEqual(["UNT-1'; DROP TABLE blood_units;--"]);
});

it('only discards Available, Reserved or Expired units, and reports whether a row changed', async () => {
  const tx = { query: jest.fn().mockResolvedValueOnce({ rows: [{ unit_id: 'UNT-00001' }] }).mockResolvedValueOnce({ rows: [] }) };
  expect(await repo.markDiscarded(tx, 'UNT-00001', 'Leakage')).toBe(true);
  const [sql, params] = tx.query.mock.calls[0];
  expect(sql).toMatch(/status IN \('Available', 'Reserved', 'Expired'\)/);
  expect(params).toEqual(['UNT-00001', 'Leakage']);
  expect(await repo.markDiscarded(tx, 'UNT-00001', 'Leakage')).toBe(false);
});
