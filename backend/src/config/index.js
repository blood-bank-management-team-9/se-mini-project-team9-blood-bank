require('dotenv').config();

// Defaults come from SAD 3.4 (C13) and SRS. They move to the system_config table
// once the Config Service (C13) exists.
module.exports = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',
  timeZone: 'Asia/Kolkata', // SAD 4.1: one time zone for search, expiry and eligibility
  dbUri: process.env.DB_URI,
  jobs: {
    expiryCron: process.env.EXPIRY_CRON || '0 0 * * *', // midnight (FR-STK-03)
    backupCron: process.env.BACKUP_CRON || '0 2 * * *', // nightly (NFR-SAF-03)
    backupDir: process.env.BACKUP_DIR || './backups',
    backupRetentionDays: Number(process.env.BACKUP_RETENTION_DAYS) || 30,
  },
};
