// C12 Audit & Logging — retention job (NFR-SEC-06).
// "Keep these logs for 1 year." Deletes audit_log rows older than 365 days.
// Runs daily at 02:00 local time when NODE_ENV !== 'test'.

const { query } = require('../../database/db');

// NFR-SEC-06 says "1 year". Hard-coded to 365 to match the SRS literally.
// If the team later wants it configurable, move this value to system_config.
const RETENTION_DAYS = 365;

async function runRetention() {
  const { rowCount } = await query(
    `DELETE FROM audit_log
      WHERE created_at < NOW() - ($1 || ' days')::interval`,
    [String(RETENTION_DAYS)]
  );
  if (rowCount > 0) {
    // eslint-disable-next-line no-console
    console.log(`[audit-retention] deleted ${rowCount} row(s) older than ${RETENTION_DAYS} days`);
  }
  return rowCount;
}

module.exports = { runRetention, RETENTION_DAYS };