const { withTransaction } = require('./transaction');

const fakePool = () => {
  const calls = [];
  const client = { query: jest.fn(async (q) => calls.push(q)), release: jest.fn() };
  return { calls, client, pool: { connect: async () => client } };
};

it('commits when the work succeeds', async () => {
  const { calls, client, pool } = fakePool();
  expect(await withTransaction(async () => 42, pool)).toBe(42);
  expect(calls).toEqual(['BEGIN', 'COMMIT']);
  expect(client.release).toHaveBeenCalled();
});

it('rolls back and rethrows when the work fails', async () => {
  const { calls, client, pool } = fakePool();
  await expect(withTransaction(async () => { throw new Error('boom'); }, pool)).rejects.toThrow('boom');
  expect(calls).toEqual(['BEGIN', 'ROLLBACK']);
  expect(client.release).toHaveBeenCalled();
});
