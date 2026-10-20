// C4 Auth Service - registration business logic (SAD 3.4, 4.3).
// Business rules only; HTTP mapping lives in the route layer.

const bcrypt = require('bcryptjs');
const { withTransaction } = require('../../database/transaction');
const { logAudit } = require('../audit/audit.repository');
const repo = require('./auth.repository');

const BCRYPT_ROUNDS = 10;
const ALLOWED_ROLES = ['Donor', 'Hospital/Patient'];
const ROLE_PREFIXES = {
  Donor: 'USR-DNR',
  'Hospital/Patient': 'USR-HSP',
};

// Schema constraint: users.user_id is VARCHAR(10). See deviation note in PR.
const MAX_SEQUENCE = 99;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

class AuthError extends Error {
  constructor(code, publicMessage, status = 400, extra = {}) {
    super(publicMessage);
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
    this.extra = extra;
  }
}

async function register({ name, email, phone, password, role }) {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new AuthError(
      'VALIDATION_ERROR',
      'Role must be Donor or Hospital/Patient',
      400
    );
  }

  // Fast-fail before the expensive bcrypt hash.
  // UNIQUE constraints on users.email/phone remain the race-condition guard.
  if (await repo.findByEmail(email)) {
    throw new AuthError('ACCOUNT_EXISTS', 'Account already exists', 409);
  }

  if (await repo.findByPhone(phone)) {
    throw new AuthError('ACCOUNT_EXISTS', 'Account already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await withTransaction(async (tx) => {
    const prefix = ROLE_PREFIXES[role];
    const currentMax = await repo.maxSequenceForPrefix(prefix, tx);
    const nextSeq = currentMax + 1;

    if (nextSeq > MAX_SEQUENCE) {
      // Schema limitation (VARCHAR(10)). No new error code:
      // the generic 500 INTERNAL_ERROR path handles it.
      const err = new Error('User ID pool exhausted for role');
      err.status = 500;
      throw err;
    }

    const userId = `${prefix}${String(nextSeq).padStart(2, '0')}`;

    return repo.insertUser(tx, {
      userId,
      name,
      email,
      phone,
      passwordHash,
      role,
    });
  });

  return {
    userId: result.user_id,
    role: result.role,
    message: 'Account created successfully',
  };
}

// ---------------------------------------------------------------------------
// Login / lockout / logout (issue #6: FR-AUTH-03, FR-AUTH-04, FR-AUTH-07)
// ---------------------------------------------------------------------------

// Mask email addresses before including them in audit logs.
function maskEmail(email) {
  if (typeof email !== 'string') return null;

  const atIndex = email.indexOf('@');

  if (atIndex <= 0) return '***';

  return `${email[0]}***${email.slice(atIndex)}`;
}

async function login({ email, password, session }) {
  const user = await repo.findByEmailForLogin(email);

  // 1. Unknown email — 401, same message as wrong password.
  if (!user) {
    await logAudit({
      userId: null,
      action: 'LOGIN_FAILED',
      entity: 'users',
      entityId: null,
      newValue: {
        email_masked: maskEmail(email),
        reason: 'unknown_email',
      },
    });

    throw new AuthError(
      'INVALID_CREDENTIALS',
      'Invalid email or password',
      401
    );
  }

  // 2. Locked account — checked before password verification.
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.max(
      1,
      Math.ceil((new Date(user.locked_until) - new Date()) / 60000)
    );

    await logAudit({
      userId: user.user_id,
      action: 'LOGIN_FAILED',
      entity: 'users',
      entityId: user.user_id,
      newValue: {
        email_masked: maskEmail(email),
        reason: 'locked',
        minutes_left: minutesLeft,
      },
    });

    throw new AuthError(
      'ACCOUNT_LOCKED',
      `Account is locked. Try again in ${minutesLeft} minute(s).`,
      423,
      { minutesLeft }
    );
  }

  // 3. Verify password.
  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatches) {
    const newCount = await repo.incrementFailedCount(user.user_id);

    // Lock the account after the fifth failed attempt.
    if (newCount >= MAX_FAILED_ATTEMPTS) {
      await repo.lockAccount(user.user_id, LOCKOUT_MINUTES);

      await logAudit({
        userId: user.user_id,
        action: 'LOGIN_LOCKED',
        entity: 'users',
        entityId: user.user_id,
        newValue: {
          email_masked: maskEmail(email),
          reason: 'max_failures',
          failed_count: newCount,
        },
      });

      throw new AuthError(
        'ACCOUNT_LOCKED',
        `Account is locked. Try again in ${LOCKOUT_MINUTES} minute(s).`,
        423,
        { minutesLeft: LOCKOUT_MINUTES }
      );
    }

    await logAudit({
      userId: user.user_id,
      action: 'LOGIN_FAILED',
      entity: 'users',
      entityId: user.user_id,
      newValue: {
        email_masked: maskEmail(email),
        reason: 'bad_password',
        failed_count: newCount,
      },
    });

    throw new AuthError(
      'INVALID_CREDENTIALS',
      'Invalid email or password',
      401
    );
  }

  // 4. Correct password, but account is inactive.
  if (user.status !== 'Active') {
    await logAudit({
      userId: user.user_id,
      action: 'LOGIN_FAILED',
      entity: 'users',
      entityId: user.user_id,
      newValue: {
        email_masked: maskEmail(email),
        reason: 'inactive',
      },
    });

    throw new AuthError(
      'ACCOUNT_INACTIVE',
      'Account is inactive. Contact the administrator.',
      403
    );
  }

  // 5. Successful login — reset failures and record the audit event.
  await repo.resetLoginFailures(user.user_id);

  await logAudit({
    userId: user.user_id,
    action: 'LOGIN_SUCCESS',
    entity: 'users',
    entityId: user.user_id,
    newValue: {
      email_masked: maskEmail(email),
      role: user.role,
    },
  });

  session.user = {
    userId: user.user_id,
    name: user.name,
    role: user.role,
  };

  return {
    userId: user.user_id,
    name: user.name,
    role: user.role,
  };
}

async function logout(session) {
  if (!session) return;

  await new Promise((resolve, reject) => {
    session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { register, login, logout, AuthError };
