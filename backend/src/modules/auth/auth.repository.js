// C4 Auth Service — data access (SAD 3.4).
// All SQL is parameterised ($1..$n). No string interpolation of user input.

const { query } = require('../../database/db');

async function findByEmail(email, tx = null) {
  const runner = tx ? tx.query.bind(tx) : query;
  const { rows } = await runner(
    'SELECT user_id, email, phone, role, status FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

async function findByPhone(phone, tx = null) {
  const runner = tx ? tx.query.bind(tx) : query;
  const { rows } = await runner(
    'SELECT user_id, email, phone, role, status FROM users WHERE phone = $1',
    [phone]
  );
  return rows[0] || null;
}

// Returns the highest existing numeric suffix for a given user_id prefix.
// Uses FOR UPDATE to serialize concurrent registrations for the same role.
// If no rows exist for the role, no lock is acquired (and the race window
// is documented in the PR as a known limitation).
async function maxSequenceForPrefix(prefix, tx) {
  const { rows } = await tx.query(
    `SELECT user_id FROM users
     WHERE user_id LIKE $1
     ORDER BY user_id DESC
     LIMIT 1
     FOR UPDATE`,
    [`${prefix}%`]
  );
  if (rows.length === 0) return 0;
  const match = rows[0].user_id.match(/(\d{2})$/);
  return match ? parseInt(match[1], 10) : 0;
}

async function insertUser(tx, { userId, name, email, phone, passwordHash, role }) {
  const { rows } = await tx.query(
    `INSERT INTO users (user_id, name, email, phone, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'Active')
     RETURNING user_id, name, email, role, status`,
    [userId, name, email, phone, passwordHash, role]
  );
  return rows[0];
}

module.exports = {
  findByEmail,
  findByPhone,
  maxSequenceForPrefix,
  insertUser,
};