// C5 Admin Service — user management business logic (SAD 3.4, 4.3).
// Business rules only; HTTP mapping lives in the route layer.

const bcrypt = require('bcryptjs');
const { withTransaction } = require('../../database/transaction');
const { logAudit } = require('../audit/audit.repository');
const repo = require('./admin.repository');
const { query } = require('../../database/db');

const BCRYPT_ROUNDS = 10;
const VALID_ROLES = ['Donor', 'Hospital/Patient', 'Staff', 'Admin'];
const VALID_STATUSES = ['Active', 'Inactive'];
const STAFF_PREFIX = 'USR-STF';
const MAX_SEQUENCE = 99;

class AdminError extends Error {
  constructor(code, publicMessage, status = 400) {
    super(publicMessage);
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

// Convert a raw DB user row to the API shape (camelCase userId).
function toUserDto(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function createStaff({ name, email, phone, temporaryPassword }) {
  const existingEmail = await query(
    'SELECT user_id FROM users WHERE email = $1',
    [email]
  );
  if (existingEmail.rows.length > 0) {
    throw new AdminError('ACCOUNT_EXISTS', 'Account already exists', 409);
  }
  const existingPhone = await query(
    'SELECT user_id FROM users WHERE phone = $1',
    [phone]
  );
  if (existingPhone.rows.length > 0) {
    throw new AdminError('ACCOUNT_EXISTS', 'Account already exists', 409);
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

  return withTransaction(async (tx) => {
    const { rows: last } = await tx.query(
      `SELECT user_id FROM users
        WHERE user_id LIKE $1
        ORDER BY user_id DESC
        LIMIT 1
        FOR UPDATE`,
      [`${STAFF_PREFIX}%`]
    );
    const currentMax = last.length === 0
      ? 0
      : parseInt(last[0].user_id.match(/(\d{2})$/)[1], 10);
    const nextSeq = currentMax + 1;

    if (nextSeq > MAX_SEQUENCE) {
      const err = new Error('User ID pool exhausted for Staff');
      err.status = 500;
      throw err;
    }

    const userId = `${STAFF_PREFIX}${String(nextSeq).padStart(2, '0')}`;

    const inserted = await repo.insertStaffUser(tx, {
      userId,
      name,
      email,
      phone,
      passwordHash,
    });

    await logAudit(
      {
        userId: null,
        action: 'USER_CREATED',
        entity: 'users',
        entityId: inserted.user_id,
        newValue: { role: inserted.role, status: inserted.status },
      },
      tx
    );

    return toUserDto(inserted);
  });
}

async function listUsers({ role, status, q }) {
  if (role && !VALID_ROLES.includes(role)) {
    throw new AdminError('VALIDATION_ERROR', 'Invalid role filter', 400);
  }
  if (status && !VALID_STATUSES.includes(status)) {
    throw new AdminError('VALIDATION_ERROR', 'Invalid status filter', 400);
  }
  const users = await repo.listUsers({ role, status, q });
  return { users: users.map(toUserDto), total: users.length };
}

async function setStatus({ adminUserId, targetUserId, status }) {
  if (!VALID_STATUSES.includes(status)) {
    throw new AdminError('VALIDATION_ERROR', 'Invalid status', 400);
  }

  return withTransaction(async (tx) => {
    const target = await repo.findUserById(targetUserId, tx);
    if (!target) {
      throw new AdminError('NOT_FOUND', 'User not found', 404);
    }

    if (targetUserId === adminUserId) {
      throw new AdminError(
        'SELF_ACTION_DENIED',
        'You cannot change your own account status',
        403
      );
    }

    if (
      status === 'Inactive' &&
      target.role === 'Admin' &&
      target.status === 'Active'
    ) {
      const others = await repo.countOtherActiveAdmins(targetUserId, tx);
      if (others === 0) {
        throw new AdminError(
          'LAST_ADMIN',
          'Cannot deactivate the last active admin',
          409
        );
      }
    }

    const updated = await repo.updateUserStatus(tx, targetUserId, status);

    await logAudit(
      {
        userId: adminUserId,
        action: status === 'Active' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity: 'users',
        entityId: targetUserId,
        originalValue: { status: target.status },
        newValue: { status },
      },
      tx
    );

    return toUserDto(updated);
  });
}

async function setRole({ adminUserId, targetUserId, role }) {
  if (!VALID_ROLES.includes(role)) {
    throw new AdminError('VALIDATION_ERROR', 'Invalid role', 400);
  }

  return withTransaction(async (tx) => {
    const target = await repo.findUserById(targetUserId, tx);
    if (!target) {
      throw new AdminError('NOT_FOUND', 'User not found', 404);
    }

    if (targetUserId === adminUserId) {
      throw new AdminError(
        'SELF_ACTION_DENIED',
        'You cannot change your own role',
        403
      );
    }

    if (
      target.role === 'Admin' &&
      target.status === 'Active' &&
      role !== 'Admin'
    ) {
      const others = await repo.countOtherActiveAdmins(targetUserId, tx);
      if (others === 0) {
        throw new AdminError(
          'LAST_ADMIN',
          'Cannot demote the last active admin',
          409
        );
      }
    }

    const updated = await repo.updateUserRole(tx, targetUserId, role);

    await logAudit(
      {
        userId: adminUserId,
        action: 'ROLE_CHANGED',
        entity: 'users',
        entityId: targetUserId,
        originalValue: { role: target.role },
        newValue: { role },
      },
      tx
    );

    return toUserDto(updated);
  });
}

async function listAuditLogs({ limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  return repo.listAuditLogs({ limit: safeLimit });
}

module.exports = {
  createStaff,
  listUsers,
  setStatus,
  setRole,
  listAuditLogs,
  AdminError,
};