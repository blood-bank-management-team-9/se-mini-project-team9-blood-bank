const repo = require('./correction.repository');

const fakeTx = () => ({ query: jest.fn().mockResolvedValue({ rows: [{ donation_id: 'DON-1' }] }) });

it('locks the donation row and uses parameters only', async () => {
  const tx = fakeTx();
  await repo.findDonationForUpdate(tx, "DON-1'; DROP TABLE donations;--");
  const [sql, params] = tx.query.mock.calls[0];
  expect(sql).toMatch(/FOR UPDATE/);
  expect(sql).not.toMatch(/DROP/);
  expect(params).toEqual(["DON-1'; DROP TABLE donations;--"]);
});

it('builds an UPDATE from a fixed column map and ignores unknown keys', async () => {
  const tx = fakeTx();
  await repo.updateDonation(tx, 'DON-1', { volumeMl: 450, donationStatus: 'Failed Screening', evil: 'x; DROP' });
  const [sql, params] = tx.query.mock.calls[0];
  expect(sql).toBe('UPDATE donations SET volume_ml = $1, donation_status = $2 WHERE donation_id = $3');
  expect(params).toEqual([450, 'Failed Screening', 'DON-1']);
});

it('does not run a query when there is nothing to update', async () => {
  const tx = fakeTx();
  await repo.updateUnit(tx, 'UNT-1', {});
  expect(tx.query).not.toHaveBeenCalled();
});

it('finds the unit of a donation with a row lock', async () => {
  const tx = fakeTx();
  await repo.findUnitForUpdate(tx, 'DON-1');
  expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
});
