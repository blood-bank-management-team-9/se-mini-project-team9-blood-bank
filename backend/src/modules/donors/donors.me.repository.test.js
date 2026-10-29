jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/db');
const repo = require('./donors.repository');

describe('Donor self-service repository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scopes donation history to the linked authenticated user', async () => {
    query.mockResolvedValue({ rows: [] });

    await repo.listDonationHistory('USR-DNR01');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('JOIN donors donor ON donor.donor_id = d.donor_id');
    expect(sql).toContain('WHERE donor.user_id = $1');
    expect(sql).not.toContain('medical_notes');
    expect(params).toEqual(['USR-DNR01']);
  });

  it('selects only a donor account by user ID and locks it before linking', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ phone: '9876501234' }] }) };

    await repo.findDonorAccountById('USR-DNR01', tx);

    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toContain("WHERE user_id = $1 AND role = 'Donor'");
    expect(sql).toContain('FOR UPDATE');
    expect(params).toEqual(['USR-DNR01']);
  });
});
