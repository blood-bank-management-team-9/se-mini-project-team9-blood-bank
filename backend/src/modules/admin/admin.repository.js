// C5 Admin Service — data access (SAD 3.4, 4.3).
// All SQL is parameterised ($1..$n). No string interpolation of user input.

const { query } = require('../../database/db');

// Returns users optionally filtered by role, status, and a search term
// matching name or email (case-insensitive). No pagination — SRS does not
// require it for the admin list (documented as deviation).
async function listUsers({ role, status, q } = {}) {
  const conditions = [];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT user_id, name, email, phone, role, status, created_at
       FROM users
       ${where}
       ORDER BY created_at DESC`,
    params
  );
  return rows;
}

// Fetches a user by ID. Pass tx to lock the row (SELECT ... FOR UPDATE)
// when the caller needs to serialize concurrent updates.
async function findUserById(userId, tx = null) {
  const runner = tx ? tx.query.bind(tx) : query;
  const suffix = tx ? ' FOR UPDATE' : '';
  const { rows } = await runner(
    `SELECT user_id, name, email, phone, role, status, created_at
       FROM users
      WHERE user_id = $1${suffix}`,
    [userId]
  );
  return rows[0] || null;
}

// Counts active admins other than the given user. Used by last-admin protection.
// Must be called inside a transaction with FOR UPDATE on the target row.
async function countOtherActiveAdmins(excludeUserId, tx) {
  const { rows } = await tx.query(
    `SELECT COUNT(*)::int AS n
       FROM users
      WHERE role = 'Admin'
        AND status = 'Active'
        AND user_id <> $1`,
    [excludeUserId]
  );
  return rows[0].n;
}

// Inserts a new Staff user inside a transaction. Role is forced to 'Staff'
// because FR-ADM-01 only allows admin creation of staff accounts.
async function insertStaffUser(tx, { userId, name, email, phone, passwordHash }) {
  const { rows } = await tx.query(
    `INSERT INTO users (user_id, name, email, phone, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5, 'Staff', 'Active')
     RETURNING user_id, name, email, phone, role, status, created_at`,
    [userId, name, email, phone, passwordHash]
  );
  return rows[0];
}

async function updateUserStatus(tx, userId, status) {
  const { rows } = await tx.query(
    `UPDATE users
        SET status = $2
      WHERE user_id = $1
      RETURNING user_id, name, email, phone, role, status, created_at`,
    [userId, status]
  );
  return rows[0];
}

async function updateUserRole(tx, userId, role) {
  const { rows } = await tx.query(
    `UPDATE users
        SET role = $2
      WHERE user_id = $1
      RETURNING user_id, name, email, phone, role, status, created_at`,
    [userId, role]
  );
  return rows[0];
}

// Returns the most recent audit_log rows. Admin-only, read-only.
async function listAuditLogs({ limit = 100 } = {}) {
  const { rows } = await query(
    `SELECT log_id, user_id, action, entity, entity_id,
            original_value, new_value, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  listUsers,
  findUserById,
  countOtherActiveAdmins,
  insertStaffUser,
  updateUserStatus,
  updateUserRole,
  listAuditLogs,
};