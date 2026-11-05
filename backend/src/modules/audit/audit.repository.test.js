jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/db');
const { logAudit } = require('./audit.repository');

describe('audit.repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the database query when no transaction is supplied', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    await logAudit({
      action: 'DONOR_CREATED',
      entity: 'donors',
      entityId: 'DNR-00001',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      [null, 'DONOR_CREATED', 'donors', 'DNR-00001', null, null]
    );
  });

  it('uses the supplied transaction query when a transaction is supplied', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };

    await logAudit({
      userId: 'USR-STF01',
      action: 'DONOR_UPDATED',
      entity: 'donors',
      entityId: 'DNR-00001',
      originalValue: { status: 'Inactive' },
      newValue: { status: 'Active' },
    }, tx);

    expect(tx.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      [
        'USR-STF01',
        'DONOR_UPDATED',
        'donors',
        'DNR-00001',
        { status: 'Inactive' },
        { status: 'Active' },
      ]
    );
    expect(query).not.toHaveBeenCalled();
  });
});

it('uses default values for omitted optional audit fields', async () => {
  await logAudit({
    action: 'DONOR_VIEWED',
    entity: 'donors',
  });

  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO audit_log'),
    [null, 'DONOR_VIEWED', 'donors', null, null, null]
  );
});
