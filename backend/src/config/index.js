const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Same database settings as src/database/db.js, as one connection string for pg_dump.
const buildDbUri = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = encodeURIComponent(process.env.DB_USER || 'postgres');
  const password = encodeURIComponent(process.env.DB_PASSWORD || 'postgres');
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'blood_bank';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
};

// Defaults come from SAD 3.4 (C13). They move to the system_config table
// once the Config Service (C13) exists.
module.exports = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',
  timeZone: 'Asia/Kolkata', // SAD 4.1: one time zone for search, expiry and eligibility
  dbUri: buildDbUri(),
  jobs: {
    expiryCron: process.env.EXPIRY_CRON || '0 0 * * *', // midnight (FR-STK-03)
    backupCron: process.env.BACKUP_CRON || '0 3 * * *', // nightly (NFR-SAF-03)
    backupDir: process.env.BACKUP_DIR || './backups',
    backupRetentionDays: Number(process.env.BACKUP_RETENTION_DAYS) || 30,
  },
};