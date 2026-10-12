const { expireUnits } = require('./stock.service');
const repo = require('./stock.repository');

describe('stock.service.expireUnits (FR-STK-03)', () => {
  it('expires units on or before today in IST and reports the count', async () => {
    const repository = { expireUnitsOnOrBefore: jest.fn().mockResolvedValue(['UNT-00001', 'UNT-00002']) };
    const result = await expireUnits({ now: new Date('2026-11-07T18:30:00Z'), repository });
    expect(repository.expireUnitsOnOrBefore).toHaveBeenCalledWith('2026-11-08');
    expect(result).toEqual({ date: '2026-11-08', expired: 2 });
  });

  it('is safe to run again when nothing is left to expire', async () => {
    const repository = { expireUnitsOnOrBefore: jest.fn().mockResolvedValue([]) };
    expect((await expireUnits({ repository })).expired).toBe(0);
  });
});

describe('stock.repository.expireUnitsOnOrBefore', () => {
  it('uses a parameterised query that only touches Available and Reserved units', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ unit_id: 'UNT-00009' }] }) };
    const ids = await repo.expireUnitsOnOrBefore('2026-11-08', db);
    const [sql, params] = db.query.mock.calls[0];
    expect(params).toEqual(['2026-11-08']);
    expect(sql).toMatch(/\$1/);
    expect(sql).toMatch(/'Available', 'Reserved'/);
    expect(sql).not.toMatch(/2026/);
    expect(ids).toEqual(['UNT-00009']);
  });
});
