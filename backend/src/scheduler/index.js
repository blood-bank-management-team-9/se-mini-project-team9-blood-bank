const cron = require('node-cron');
const config = require('../config');
const stockService = require('../modules/stock/stock.service');
const backupService = require('./backup.service');
const jobStatus = require('./jobStatus');

// A failed job is recorded for monitoring and logged, never thrown, so it cannot crash the API.
const safely = async (name, fn) => {
  try {
    const result = await fn();
    jobStatus.record(name, { ok: true, ...result });
    console.log(`[scheduler] ${name} ok`, JSON.stringify(result));
  } catch (err) {
    jobStatus.record(name, { ok: false, error: err.message });
    console.error(`[scheduler] ${name} failed: ${err.message}`);
  }
};

exports.runExpiryJob = (deps = {}) =>
  safely('expiry', () => (deps.stockService || stockService).expireUnits());

exports.runBackupJob = (deps = {}) =>
  safely('backup', async () => {
    const { dbUri, jobs } = deps.config || config;
    const svc = deps.backupService || backupService;
    const { file } = await svc.runBackup({ dbUri, dir: jobs.backupDir });
    const removed = svc.pruneBackups({ dir: jobs.backupDir, retentionDays: jobs.backupRetentionDays });
    return { file, pruned: removed.length };
  });

// SAD C15: midnight expiry + nightly backup. The expiry job also runs once at start-up
// (SAD 3.7), so a missed midnight run is made up straight away.
exports.start = (deps = {}) => {
  const cfg = deps.config || config;
  const schedule = deps.cron || cron;
  const opts = { timezone: cfg.timeZone };
  const tasks = [
    schedule.schedule(cfg.jobs.expiryCron, () => exports.runExpiryJob(deps), opts),
    schedule.schedule(cfg.jobs.backupCron, () => exports.runBackupJob(deps), opts),
  ];
  exports.runExpiryJob(deps);
  return tasks;
};
