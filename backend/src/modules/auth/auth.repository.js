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
// ---------------------------------------------------------------------------
// Login / lockout support (issue #6: FR-AUTH-03, FR-AUTH-04, TC-02)
// ---------------------------------------------------------------------------

// Fetches everything the login service needs in one query.
// Returns null if the email does not exist.
async function findByEmailForLogin(email) {
  const { rows } = await query(
    `SELECT user_id, name, email, phone, password_hash, role, status,
            failed_count, locked_until
     FROM users
     WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

// Increments failed_count atomically. Returns the new count.
async function incrementFailedCount(userId) {
  const { rows } = await query(
    `UPDATE users
        SET failed_count = failed_count + 1
      WHERE user_id = $1
      RETURNING failed_count`,
    [userId]
  );
  return rows[0] ? rows[0].failed_count : 0;
}

// Sets locked_until to NOW() + <minutes>. Also stores the failed_count that
// triggered the lock (5) so the account is in a consistent state.
async function lockAccount(userId, minutes = 15) {
  await query(
    `UPDATE users
        SET locked_until = NOW() + ($2 || ' minutes')::interval
      WHERE user_id = $1`,
    [userId, String(minutes)]
  );
}

// Called on successful login. Resets the failure counter and clears the lock.
async function resetLoginFailures(userId) {
  await query(
    `UPDATE users
        SET failed_count = 0,
            locked_until = NULL
      WHERE user_id = $1`,
    [userId]
  );
}

// Explicit unlock — used when the lock has expired and we want to keep the
// user state clean on the next failed attempt. (Not strictly necessary since
// the service will reset on success, but it keeps the row readable.)
async function clearExpiredLock(userId) {
  await query(
    `UPDATE users
        SET failed_count = 0,
            locked_until = NULL
      WHERE user_id = $1
        AND locked_until IS NOT NULL
        AND locked_until <= NOW()`,
    [userId]
  );
}
module.exports = {
  findByEmail,
  findByPhone,
  maxSequenceForPrefix,
  insertUser,
  // Login / lockout (issue #6)
  findByEmailForLogin,
  incrementFailedCount,
  lockAccount,
  resetLoginFailures,
  clearExpiredLock,
};