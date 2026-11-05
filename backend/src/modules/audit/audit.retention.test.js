jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/db');
const { runRetention, RETENTION_DAYS } = require('./audit.retention');

describe('audit.retention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes expired records and logs the deletion count', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    query.mockResolvedValue({ rowCount: 3 });

    const result = await runRetention();

    expect(result).toBe(3);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM audit_log'),
      [String(RETENTION_DAYS)]
    );
    expect(logSpy).toHaveBeenCalledWith(
      `[audit-retention] deleted 3 row(s) older than ${RETENTION_DAYS} days`
    );

    logSpy.mockRestore();
  });

  it('does not log when no expired records are deleted', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    query.mockResolvedValue({ rowCount: 0 });

    const result = await runRetention();

    expect(result).toBe(0);
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
