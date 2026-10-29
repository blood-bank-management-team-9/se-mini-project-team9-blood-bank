jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/db');
const repo = require('./requests.repository');

describe('Request repository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allocates a monotonically increasing request ID under an advisory lock', async () => {
    const tx = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ request_id: 'REQ-00000009' }] }),
    };

    await expect(repo.nextRequestId(tx)).resolves.toBe('REQ-00000010');
    expect(tx.query).toHaveBeenNthCalledWith(1, 'SELECT pg_advisory_xact_lock($1)', [410940]);
    expect(tx.query.mock.calls[1][0]).toContain("request_id ~ '^REQ-[0-9]{8}$'");
  });

  it('starts request IDs at one when there are no existing requests', async () => {
    const tx = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    await expect(repo.nextRequestId(tx)).resolves.toBe('REQ-00000001');
  });

  it('filters requester history by authenticated requester ID', async () => {
    query.mockResolvedValue({ rows: [] });

    await repo.listRequestsForRequester('USR-HSP01');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE requester_id = $1');
    expect(sql).toContain('ORDER BY created_at DESC, request_id DESC');
    expect(params).toEqual(['USR-HSP01']);
  });

  it('locks cancellation reads using both request and requester IDs', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await repo.findRequestForUpdate(tx, 'REQ-00000001', 'USR-HSP01');

    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toContain('WHERE request_id = $1 AND requester_id = $2');
    expect(sql).toContain('FOR UPDATE');
    expect(params).toEqual(['REQ-00000001', 'USR-HSP01']);
  });

  it('changes status only while the owner’s request is pending', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await repo.cancelRequest(tx, 'REQ-00000001', 'USR-HSP01');

    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toContain("SET status = 'Cancelled'");
    expect(sql).toContain("status = 'Pending'");
    expect(sql).toContain('requester_id = $2');
    expect(params).toEqual(['REQ-00000001', 'USR-HSP01']);
  });
});
