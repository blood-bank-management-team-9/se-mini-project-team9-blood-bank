const { pool } = require('./db');
const runMigrations = require('./migrate');

async function resetDatabase() {
  console.log('Resetting database: dropping existing tables...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      DROP TABLE IF EXISTS blood_request_units CASCADE;
      DROP TABLE IF EXISTS blood_requests CASCADE;
      DROP TABLE IF EXISTS blood_units CASCADE;
      DROP TABLE IF EXISTS donations CASCADE;
      DROP TABLE IF EXISTS donors CASCADE;
      DROP TABLE IF EXISTS password_reset_tokens CASCADE;
      DROP TABLE IF EXISTS audit_log CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS system_config CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    await client.query('COMMIT');
    console.log('Tables dropped.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset failed:', err.message);
    throw err;
  } finally {
    client.release();
  }

  // Now re-run migrations
  await runMigrations();
}

if (require.main === module) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = resetDatabase;
