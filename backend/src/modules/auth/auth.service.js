// C4 Auth Service - registration business logic (SAD 3.4, 4.3).
// Business rules only; HTTP mapping lives in the route layer.

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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
function maskPhone(phone) {
  if (typeof phone !== 'string' || phone.length < 4) return '***';
  return `***${phone.slice(-4)}`;
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
// ---------------------------------------------------------------------------
// Password reset (FR-AUTH-05) — token is SHA-256-hashed before storage.
// The raw token is returned to the caller in the response body.
// EMAIL IS NOT SENT (dev-only; see PR deviation). Real SMTP is a follow-up.
// ---------------------------------------------------------------------------

const RESET_TOKEN_TTL_MINUTES = 15;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function requestPasswordReset({ email }) {
  const user = await repo.findByEmail(email);
  if (!user) {
    // Do not reveal whether the email is registered.
    // Return a generic response — same shape as success — so an attacker
    // cannot use this endpoint to enumerate accounts.
    return { message: 'If the email is registered, a reset link has been generated.' };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await withTransaction(async (tx) => {
    await repo.createResetToken(tx, {
      tokenHash,
      userId: user.user_id,
      expiresAt,
    });
    await logAudit(
      {
        userId: user.user_id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'users',
        entityId: user.user_id,
        newValue: { expires_at: expiresAt.toISOString() },
      },
      tx
    );
  });

  // DEV ONLY: return the raw token so the frontend / test can use it.
  // In production this must be sent by email and NOT returned.
  return {
    message: 'If the email is registered, a reset link has been generated.',
    resetToken: rawToken,
    expiresAt: expiresAt.toISOString(),
    resetUrl: `/reset-password?token=${rawToken}`,
  };
}

async function resetPassword({ token, newPassword }) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new AuthError('VALIDATION_ERROR', 'Token is required', 400);
  }

  const tokenHash = hashToken(token);

  return withTransaction(async (tx) => {
    const record = await repo.findResetTokenByHash(tokenHash, tx);
    if (!record) {
      throw new AuthError('INVALID_TOKEN', 'Reset link is invalid', 400);
    }
    if (record.used_at) {
      throw new AuthError('TOKEN_ALREADY_USED', 'Reset link has already been used', 400);
    }
    if (new Date(record.expires_at) <= new Date()) {
      throw new AuthError('TOKEN_EXPIRED', 'Reset link has expired', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await repo.updateUserPassword(record.user_id, passwordHash, tx);
    await repo.markResetTokenUsed(tokenHash, tx);
    await logAudit(
      {
        userId: record.user_id,
        action: 'PASSWORD_RESET_COMPLETED',
        entity: 'users',
        entityId: record.user_id,
        newValue: { reset_at: new Date().toISOString() },
      },
      tx
    );

    return { message: 'Password reset successfully' };
  });
}

// ---------------------------------------------------------------------------
// Profile (FR-AUTH-06) — Donor and Hospital/Patient only.
// ---------------------------------------------------------------------------

const PROFILE_ALLOWED_ROLES = ['Donor', 'Hospital/Patient'];

function ensureProfileRole(role) {
  if (!PROFILE_ALLOWED_ROLES.includes(role)) {
    throw new AuthError(
      'ACCESS_DENIED',
      'Profile management is available only to Donor and Hospital/Patient users',
      403
    );
  }
}

async function getProfile(userId, role) {
  ensureProfileRole(role);
  const profile = await repo.getProfile(userId);
  if (!profile) {
    throw new AuthError('NOT_FOUND', 'User not found', 404);
  }
  return {
    userId: profile.user_id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    role: profile.role,
    status: profile.status,
  };
}

async function updateProfile({ userId, role, name, phone, address }) {
  ensureProfileRole(role);

  if (phone) {
    const other = await repo.findOtherUserByPhone(phone, userId);
    if (other) {
      throw new AuthError('ACCOUNT_EXISTS', 'Phone number is already in use', 409);
    }
  }

  const updated = await repo.updateProfile(userId, { name, phone, address });
  if (!updated) {
    throw new AuthError('NOT_FOUND', 'User not found', 404);
  }

  await logAudit({
    userId,
    action: 'PROFILE_UPDATED',
    entity: 'users',
    entityId: userId,
    newValue: { name: updated.name, phone_masked: maskPhone(updated.phone) },
  });

  return {
    userId: updated.user_id,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    address: updated.address,
    role: updated.role,
    status: updated.status,
  };
}
module.exports = {
  register,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  getProfile,
  updateProfile,
  AuthError,
};
