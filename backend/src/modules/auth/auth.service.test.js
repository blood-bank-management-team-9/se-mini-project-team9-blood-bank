jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock('../../database/transaction', () => ({
  withTransaction: jest.fn()
}));

jest.mock('../audit/audit.repository', () => ({
  logAudit: jest.fn()
}));

jest.mock('./auth.repository', () => ({
  findByEmailForLogin: jest.fn(),
  incrementFailedCount: jest.fn(),
  lockAccount: jest.fn(),
  resetLoginFailures: jest.fn(),
  findByEmail: jest.fn(),
  findByPhone: jest.fn(),
  maxSequenceForPrefix: jest.fn(),
  insertUser: jest.fn()
}));

const bcrypt = require('bcryptjs');
const repo = require('./auth.repository');
const { logAudit } = require('../audit/audit.repository');
const authService = require('./auth.service');

describe('Authentication service - Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logAudit.mockResolvedValue();
  });

  const user = {
    user_id: 'USR-DNR01',
    name: 'Test User',
    email: 'test@example.com',
    role: 'Donor',
    password_hash: 'hashedPassword',
    status: 'Active',
    locked_until: null
  };

  test('masks a non-string email as null in the audit log', async () => {
    repo.findByEmailForLogin.mockResolvedValue(null);

    await expect(
      authService.login({
        email: null,
        password: 'Test@1234',
        session: {}
      })
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS'
    });

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({
          email_masked: null
        })
      })
    );
  });

  test('masks an email without a valid @ position as ***', async () => {
    repo.findByEmailForLogin.mockResolvedValue(null);

    await expect(
      authService.login({
        email: 'invalid-email',
        password: 'Test@1234',
        session: {}
      })
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS'
    });

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({
          email_masked: '***'
        })
      })
    );
  });
  test('rejects unknown email', async () => {
    repo.findByEmailForLogin.mockResolvedValue(null);

    await expect(
      authService.login({
        email: 'unknown@example.com',
        password: 'Test@1234',
        session: {}
      })
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401
    });

    expect(logAudit).toHaveBeenCalled();
  });

  test('rejects an already locked account', async () => {
    repo.findByEmailForLogin.mockResolvedValue({
      ...user,
      locked_until: new Date(Date.now() + 120000)
    });

    await expect(
      authService.login({
        email: user.email,
        password: 'Test@1234',
        session: {}
      })
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
      status: 423
    });

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('rejects incorrect password before lockout limit', async () => {
    repo.findByEmailForLogin.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);
    repo.incrementFailedCount.mockResolvedValue(2);

    await expect(
      authService.login({
        email: user.email,
        password: 'WrongPassword',
        session: {}
      })
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401
    });

    expect(repo.incrementFailedCount).toHaveBeenCalledWith(user.user_id);
  });

  test('locks account after fifth failed attempt', async () => {
    repo.findByEmailForLogin.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);
    repo.incrementFailedCount.mockResolvedValue(5);
    repo.lockAccount.mockResolvedValue();

    await expect(
      authService.login({
        email: user.email,
        password: 'WrongPassword',
        session: {}
      })
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
      status: 423
    });

    expect(repo.lockAccount).toHaveBeenCalledWith(user.user_id, 15);
  });

  test('rejects inactive account', async () => {
    repo.findByEmailForLogin.mockResolvedValue({
      ...user,
      status: 'Inactive'
    });

    bcrypt.compare.mockResolvedValue(true);

    await expect(
      authService.login({
        email: user.email,
        password: 'Test@1234',
        session: {}
      })
    ).rejects.toMatchObject({
      code: 'ACCOUNT_INACTIVE',
      status: 403
    });

    expect(repo.resetLoginFailures).not.toHaveBeenCalled();
  });

  test('successfully logs in an active user', async () => {
    repo.findByEmailForLogin.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);
    repo.resetLoginFailures.mockResolvedValue();

    const loginSession = {};

    const result = await authService.login({
      email: user.email,
      password: 'Test@1234',
      session: loginSession
    });

    expect(result).toMatchObject({
      userId: user.user_id,
      name: user.name,
      role: 'Donor'
    });

    expect(loginSession.user).toMatchObject({
      userId: user.user_id,
      role: 'Donor'
    });

    expect(repo.resetLoginFailures).toHaveBeenCalledWith(user.user_id);
  });
});

describe('Authentication service - Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const registration = {
    name: 'Test User',
    email: 'new@example.com',
    phone: '9876543210',
    password: 'Test@1234',
    role: 'Donor'
  };

  test('rejects an invalid role', async () => {
    await expect(
      authService.register({
        ...registration,
        role: 'Admin'
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400
    });

    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  test('rejects an existing email', async () => {
    repo.findByEmail.mockResolvedValue({ user_id: 'USR-DNR01' });

    await expect(
      authService.register(registration)
    ).rejects.toMatchObject({
      code: 'ACCOUNT_EXISTS',
      status: 409
    });

    expect(repo.findByPhone).not.toHaveBeenCalled();
  });

  test('rejects an existing phone number', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.findByPhone.mockResolvedValue({ user_id: 'USR-DNR02' });

    await expect(
      authService.register(registration)
    ).rejects.toMatchObject({
      code: 'ACCOUNT_EXISTS',
      status: 409
    });

    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  test('successfully registers a donor', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.findByPhone.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashedPassword');

    repo.maxSequenceForPrefix.mockResolvedValue(1);
    repo.insertUser.mockResolvedValue({
      user_id: 'USR-DNR02',
      role: 'Donor'
    });

    const { withTransaction } = require('../../database/transaction');

    withTransaction.mockImplementation(async (callback) => {
      return callback({});
    });

    const result = await authService.register(registration);

    expect(result).toEqual({
      userId: 'USR-DNR02',
      role: 'Donor',
      message: 'Account created successfully'
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('Test@1234', 10);
  });

  test('rejects registration when the user ID sequence is exhausted', async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.findByPhone.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashedPassword');

    repo.maxSequenceForPrefix.mockResolvedValue(99);

    const { withTransaction } = require('../../database/transaction');

    withTransaction.mockImplementation(async (callback) => {
      return callback({});
    });

    await expect(
      authService.register(registration)
    ).rejects.toMatchObject({
      message: 'User ID pool exhausted for role',
      status: 500
    });
  });
});

describe('Authentication service - Logout', () => {
  test('returns when no session is supplied', async () => {
    await expect(authService.logout(null)).resolves.toBeUndefined();
  });

  test('destroys an existing session', async () => {
    const session = {
      destroy: jest.fn((callback) => callback(null))
    };

    await expect(authService.logout(session)).resolves.toBeUndefined();

    expect(session.destroy).toHaveBeenCalled();
  });

  test('rejects when session destruction fails', async () => {
    const session = {
      destroy: jest.fn((callback) => callback(new Error('Session error')))
    };

    await expect(authService.logout(session)).rejects.toThrow('Session error');
  });
});



describe('AuthError defaults', () => {
  test('uses the default status and extra values', () => {
    const error = new authService.AuthError(
      'TEST_ERROR',
      'Test error'
    );

    expect(error.status).toBe(400);
    expect(error.extra).toEqual({});
    expect(error.code).toBe('TEST_ERROR');
    expect(error.publicMessage).toBe('Test error');
  });
});
