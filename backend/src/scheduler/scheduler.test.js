const scheduler = require('./index');
const jobStatus = require('./jobStatus');

const cfg = {
  timeZone: 'Asia/Kolkata', dbUri: 'postgres://x',
  jobs: { expiryCron: '0 0 * * *', backupCron: '0 2 * * *', backupDir: './b', backupRetentionDays: 30 },
};

beforeEach(() => { jobStatus.reset(); jest.spyOn(console, 'log').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

describe('scheduler.start (C15)', () => {
  it('schedules midnight expiry and nightly backup in Asia/Kolkata and runs expiry at start-up', async () => {
    const cron = { schedule: jest.fn().mockReturnValue({}) };
    const stockService = { expireUnits: jest.fn().mockResolvedValue({ date: '2026-10-12', expired: 3 }) };
    scheduler.start({ cron, config: cfg, stockService });
    expect(cron.schedule).toHaveBeenCalledWith('0 0 * * *', expect.any(Function), { timezone: 'Asia/Kolkata' });
    expect(cron.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function), { timezone: 'Asia/Kolkata' });
    await new Promise(setImmediate);
    expect(stockService.expireUnits).toHaveBeenCalledTimes(1);
    expect(jobStatus.snapshot().expiry).toMatchObject({ ok: true, expired: 3 });
  });
});

describe('job failure handling', () => {
  it('records a failed expiry run instead of throwing', async () => {
    const stockService = { expireUnits: jest.fn().mockRejectedValue(new Error('db down')) };
    await expect(scheduler.runExpiryJob({ stockService })).resolves.toBeUndefined();
    expect(jobStatus.snapshot().expiry).toMatchObject({ ok: false, error: 'db down' });
  });

  it('runs backup then prune and records the result', async () => {
    const backupService = {
      runBackup: jest.fn().mockResolvedValue({ file: 'b/bbms-1.dump' }),
      pruneBackups: jest.fn().mockReturnValue(['bbms-old.dump']),
    };
    await scheduler.runBackupJob({ backupService, config: cfg });
    expect(backupService.pruneBackups).toHaveBeenCalledWith({ dir: './b', retentionDays: 30 });
    expect(jobStatus.snapshot().backup).toMatchObject({ ok: true, pruned: 1 });
  });

  it('records a failed backup', async () => {
    const backupService = { runBackup: jest.fn().mockRejectedValue(new Error('pg_dump exited with code 1')), pruneBackups: jest.fn() };
    await scheduler.runBackupJob({ backupService, config: cfg });
    expect(backupService.pruneBackups).not.toHaveBeenCalled();
    expect(jobStatus.snapshot().backup.ok).toBe(false);
  });
});
