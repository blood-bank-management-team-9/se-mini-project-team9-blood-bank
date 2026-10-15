const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function runSeeds() {
  const seedsPath = path.join(__dirname, 'seeds.sql');
  const sql = fs.readFileSync(seedsPath, 'utf8');

  console.log('Running database seeds from seeds.sql...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Seed data inserted successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSeeds()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runSeeds;
