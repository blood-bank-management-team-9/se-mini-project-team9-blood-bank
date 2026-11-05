jest.mock('./db', () => ({
  getClient: jest.fn(),
}));

const { getClient } = require('./db');
const { withTransaction } = require('./transaction');

beforeEach(() => jest.clearAllMocks());

describe('withTransaction unit tests', () => {
  test('commits and returns callback result', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    getClient.mockResolvedValue(client);

    const result = await withTransaction(async () => 'success');

    expect(result).toBe('success');
    expect(client.query.mock.calls.map(call => call[0])).toEqual([
      'BEGIN',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('rolls back and rethrows callback error', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    getClient.mockResolvedValue(client);

    await expect(
      withTransaction(async () => {
        throw new Error('Callback failed');
      })
    ).rejects.toThrow('Callback failed');

    expect(client.query.mock.calls.map(call => call[0])).toEqual([
      'BEGIN',
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('attempts rollback when BEGIN fails', async () => {
    const client = {
      query: jest.fn()
        .mockRejectedValueOnce(new Error('Begin failed'))
        .mockResolvedValueOnce({ rows: [] }),
      release: jest.fn(),
    };
    getClient.mockResolvedValue(client);

    await expect(
      withTransaction(async () => 'unused')
    ).rejects.toThrow('Begin failed');

    expect(client.query.mock.calls.map(call => call[0])).toEqual([
      'BEGIN',
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('preserves original error when rollback also fails', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('Rollback failed')),
      release: jest.fn(),
    };
    getClient.mockResolvedValue(client);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withTransaction(async () => {
        throw new Error('Original failure');
      })
    ).rejects.toThrow('Original failure');

    expect(consoleSpy).toHaveBeenCalledWith(
      'ROLLBACK failed',
      'Rollback failed'
    );
    expect(client.release).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  test('propagates connection errors before acquiring a client', async () => {
    getClient.mockRejectedValue(new Error('Connection failed'));

    await expect(
      withTransaction(async () => 'unused')
    ).rejects.toThrow('Connection failed');
  });
});
