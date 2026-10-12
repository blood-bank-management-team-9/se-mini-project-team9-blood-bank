const { Pool } = require('pg');
const { dbUri } = require('../config');

// Created lazily so tests and the health check work without a database.
let pool;
exports.getPool = () => {
  if (!pool) pool = new Pool({ connectionString: dbUri });
  return pool;
};
