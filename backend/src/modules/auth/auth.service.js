// C4 Auth Service — registration business logic (SAD 3.4, 4.3).
// Business rules only; HTTP mapping lives in the route layer.

const bcrypt = require('bcryptjs');
const { withTransaction } = require('../../database/transaction');
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

async function login({ email, password, session }) {
  const user = await repo.findByEmailForLogin(email);

  // 1. Unknown email — SAD 4.3: 401 INVALID_CREDENTIALS, same message as bad password.
  if (!user) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // 2. Locked account — SAD 4.3: 423 ACCOUNT_LOCKED, checked first, even with correct password.
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.max(
      1,
      Math.ceil((new Date(user.locked_until) - new Date()) / 60000)
    );
    throw new AuthError(
      'ACCOUNT_LOCKED',
      `Account is locked. Try again in ${minutesLeft} minute(s).`,
      423,
      { minutesLeft }
    );
  }

  // 3. Verify password (bcrypt). Wrong password = INVALID_CREDENTIALS, same as unknown email.
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    // Increment failure counter; lock on the 5th.
    const newCount = await repo.incrementFailedCount(user.user_id);
    if (newCount >= MAX_FAILED_ATTEMPTS) {
      await repo.lockAccount(user.user_id, LOCKOUT_MINUTES);
      throw new AuthError(
        'ACCOUNT_LOCKED',
        `Account is locked. Try again in ${LOCKOUT_MINUTES} minute(s).`,
        423,
        { minutesLeft: LOCKOUT_MINUTES }
      );
    }
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // 4. Correct password, but account inactive — SAD 4.3: 403 ACCOUNT_INACTIVE.
  if (user.status !== 'Active') {
    throw new AuthError(
      'ACCOUNT_INACTIVE',
      'Account is inactive. Contact the administrator.',
      403
    );
  }

  // 5. Success — reset failure counter and clear lock, then create the session.
  await repo.resetLoginFailures(user.user_id);

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