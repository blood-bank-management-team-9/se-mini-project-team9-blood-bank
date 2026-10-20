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

class AuthError extends Error {
  constructor(code, publicMessage, status = 400) {
    super(publicMessage);
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
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

module.exports = { register, AuthError };