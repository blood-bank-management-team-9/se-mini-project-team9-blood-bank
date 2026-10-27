const path = require('path');
const { Pool } = require('pg');

// Load backend/.env regardless of the process working directory.
// The tests, the server, and any script can then find the same config.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// NFR-PERF-03: Pool configuration to support 50 concurrent logged-in users with 3s SLA
const poolConfig = {
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'blood_bank',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      }),
  max: parseInt(process.env.DB_POOL_MAX || '50', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '3000', 10),
};

const pool = new Pool(poolConfig);

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
  pool,
  query,
  getClient,
};