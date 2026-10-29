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

  it('orders the staff queue by Urgent first, then FIFO', async () => {
    query.mockResolvedValue({ rows: [] });

    await repo.listPendingRequests();

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("WHERE status = 'Pending'");
    expect(sql).toContain("CASE priority WHEN 'Urgent' THEN 0 ELSE 1 END");
    expect(sql).toContain('created_at ASC, request_id ASC');
    expect(params).toBeUndefined();
  });

  it('locks available unexpired inventory in FEFO order before reserving it', async () => {
    const tx = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ unit_id: 'UNT-00002' }, { unit_id: 'UNT-00001' }] })
        .mockResolvedValueOnce({ rows: [{ unit_id: 'UNT-00002' }, { unit_id: 'UNT-00001' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await expect(repo.reserveFefoUnits(tx, {
      requestId: 'REQ-00000001',
      bloodGroup: 'O+',
      units: 2,
    })).resolves.toEqual(['UNT-00002', 'UNT-00001']);

    const [selectSql, selectParams] = tx.query.mock.calls[0];
    expect(selectSql).toContain("status = 'Available'");
    expect(selectSql).toContain('expiry_date > CURRENT_DATE');
    expect(selectSql).toContain('ORDER BY expiry_date ASC, unit_id ASC');
    expect(selectSql).toContain('FOR UPDATE SKIP LOCKED');
    expect(selectParams).toEqual(['O+', 2]);
    expect(tx.query.mock.calls[1][1]).toEqual([['UNT-00002', 'UNT-00001']]);
    expect(tx.query.mock.calls[2][1]).toEqual(['REQ-00000001', ['UNT-00002', 'UNT-00001']]);
  });

  it('does not reserve or link units when FEFO stock is insufficient', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ unit_id: 'UNT-00001' }] }) };

    await expect(repo.reserveFefoUnits(tx, {
      requestId: 'REQ-00000001',
      bloodGroup: 'O+',
      units: 2,
    })).resolves.toBeNull();
    expect(tx.query).toHaveBeenCalledTimes(1);
  });

  it('issues only reserved units that have not expired', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ unit_id: 'UNT-00001' }] }) };

    await expect(repo.issueReservedUnits(tx, ['UNT-00001'])).resolves.toEqual(['UNT-00001']);

    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toContain("SET status = 'Issued'");
    expect(sql).toContain("status = 'Reserved'");
    expect(sql).toContain('expiry_date > CURRENT_DATE');
    expect(params).toEqual([['UNT-00001']]);
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
