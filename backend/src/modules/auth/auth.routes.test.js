
jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../middleware/csrf', () => ({
  generateCsrfToken: jest.fn(),
}));

jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('./auth.service', () => {
  class AuthError extends Error {
    constructor(code, publicMessage, status = 400, extra = {}) {
      super(publicMessage);
      this.code = code;
      this.publicMessage = publicMessage;
      this.status = status;
      this.extra = extra;
    }
  }

  return {
    AuthError,
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  };
});

const express = require('express');
const request = require('supertest');
const router = require('./auth.routes');
const authService = require('./auth.service');
const { query } = require('../../database/db');
const { generateCsrfToken } = require('../../middleware/csrf');

function createApp() {
  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    req.id = 'REQ001';

    if (req.headers['x-no-session'] === '1') {
      req.session = null;
    } else {
      req.session = {
        user: req.headers['x-auth-user']
          ? { userId: 'U001', role: 'Donor' }
          : undefined,
        save: (callback) => callback(null),
        destroy: (callback) => callback(null),
      };

      if (req.headers['x-existing-session'] === '1') {
        req.session.csrfId = 'existing-csrf-id';
      }

      if (req.headers['x-save-error'] === '1') {
        req.session.save = (callback) =>
          callback(new Error('Session save failed'));
      }

      if (req.headers['x-destroy-error'] === '1') {
        req.session.destroy = (callback) =>
          callback(new Error('Destroy failed'));
      }
    }

    next();
  });

  app.use('/api/auth', router);

  app.use((err, req, res, next) => {
    res.status(500).json({ forwarded: err.message });
  });

  return app;
}

const validRegistration = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '9876543210',
  password: 'Password123',
  role: 'Donor',
};

describe('auth.routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    generateCsrfToken.mockReturnValue('csrf-token');
  });

  describe('GET /csrf', () => {
    test('creates a session csrf ID and returns a token', async () => {
      const response = await request(app).get('/api/auth/csrf');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ csrfToken: 'csrf-token' });
      expect(generateCsrfToken).toHaveBeenCalled();
    });

    test('reuses an existing csrf ID', async () => {
      const response = await request(app)
        .get('/api/auth/csrf')
        .set('x-existing-session', '1');

      expect(response.status).toBe(200);
      expect(response.body.csrfToken).toBe('csrf-token');
    });

    test('forwards csrf generation errors', async () => {
      generateCsrfToken.mockImplementation(() => {
        throw new Error('CSRF failed');
      });

      const response = await request(app).get('/api/auth/csrf');

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('CSRF failed');
    });
  });

  describe('GET /me', () => {
    test('returns 401 when there is no session', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('x-no-session', '1');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('returns 401 when there is no logged-in user', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    test('returns the logged-in user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('x-auth-user', '1');

      expect(response.status).toBe(200);
      expect(response.body.user.userId).toBe('U001');
    });
  });

  describe('GET /staff-only', () => {
    test('returns the authenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/staff-only')
        .set('x-auth-user', '1');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });

  describe('POST /demo-validate', () => {
    test('accepts valid details', async () => {
      const response = await request(app)
        .post('/api/auth/demo-validate')
        .send({
          phone: '9876543210',
          bloodGroup: 'A+',
          name: 'Test User',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    test('rejects invalid details', async () => {
      const response = await request(app)
        .post('/api/auth/demo-validate')
        .send({
          phone: '123',
          bloodGroup: 'INVALID',
          name: '',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /__dev-session', () => {
    test('creates a session using the default Donor role', async () => {
      query.mockResolvedValue({
        rows: [{ user_id: 'U001', name: 'Test User', role: 'Donor' }],
      });

      const response = await request(app)
        .post('/api/auth/__dev-session')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('Donor');
      expect(query).toHaveBeenCalledWith(expect.any(String), ['Donor']);
    });

    test('rejects an invalid role', async () => {
      const response = await request(app)
        .post('/api/auth/__dev-session')
        .send({ role: 'Invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(query).not.toHaveBeenCalled();
    });

    test('returns an error when no active user exists', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/__dev-session')
        .send({ role: 'Staff' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('NO_ACTIVE_USER');
    });

    test('creates a session for a requested valid role', async () => {
      query.mockResolvedValue({
        rows: [{ user_id: 'S001', name: 'Staff User', role: 'Staff' }],
      });

      const response = await request(app)
        .post('/api/auth/__dev-session')
        .send({ role: 'Staff' });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('Staff');
    });

    test('forwards session save errors', async () => {
      query.mockResolvedValue({
        rows: [{ user_id: 'U001', name: 'Test User', role: 'Donor' }],
      });

      const response = await request(app)
        .post('/api/auth/__dev-session')
        .set('x-save-error', '1')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Session save failed');
    });

    test('forwards database errors', async () => {
      query.mockRejectedValue(new Error('Database failed'));

      const response = await request(app)
        .post('/api/auth/__dev-session')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Database failed');
    });
  });

  describe('POST /__dev-logout', () => {
    test('destroys the session', async () => {
      const response = await request(app).post('/api/auth/__dev-logout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    });
  });

  describe('POST /register', () => {
    test('registers a valid user', async () => {
      authService.register.mockResolvedValue({ userId: 'USR-DNR01' });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(201);
      expect(response.body.userId).toBe('USR-DNR01');
    });

    test('rejects invalid registration details', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: '',
          email: 'invalid',
          phone: '123',
          password: 'weak',
          role: 'Admin',
        });

      expect(response.status).toBe(400);
      expect(authService.register).not.toHaveBeenCalled();
    });

    test('returns an AuthError response', async () => {
      authService.register.mockRejectedValue(
        new authService.AuthError('ACCOUNT_EXISTS', 'Account exists', 409)
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ACCOUNT_EXISTS');
      expect(response.body.error.requestId).toBe('REQ001');
    });

    test('forwards unexpected errors', async () => {
      authService.register.mockRejectedValue(
        new Error('Registration failed')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Registration failed');
    });
  });

  describe('POST /login', () => {
    test('logs in and saves the session', async () => {
      authService.login.mockResolvedValue({ userId: 'U001' });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe('U001');
      expect(authService.login).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'Password123',
        })
      );
    });

    test('rejects invalid login details', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid', password: '' });

      expect(response.status).toBe(400);
      expect(authService.login).not.toHaveBeenCalled();
    });

    test('forwards session save errors', async () => {
      authService.login.mockResolvedValue({ userId: 'U001' });

      const response = await request(app)
        .post('/api/auth/login')
        .set('x-save-error', '1')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Session save failed');
    });

    test('returns an AuthError response with extra fields', async () => {
      authService.login.mockRejectedValue(
        new authService.AuthError(
          'ACCOUNT_LOCKED',
          'Account locked',
          423,
          { minutesLeft: 10 }
        )
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(423);
      expect(response.body.error.minutesLeft).toBe(10);
    });

    test('returns an AuthError response without extra fields', async () => {
      authService.login.mockRejectedValue(
        new authService.AuthError(
          'INVALID_CREDENTIALS',
          'Invalid credentials',
          401
        )
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('forwards unexpected errors', async () => {
      authService.login.mockRejectedValue(new Error('Login failed'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Login failed');
    });
  });

  describe('POST /logout', () => {
    test('rejects logout without a session', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('x-no-session', '1');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('rejects logout without a logged-in user', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(401);
    });

    test('logs out an authenticated user', async () => {
      authService.logout.mockResolvedValue();

      const response = await request(app)
        .post('/api/auth/logout')
        .set('x-auth-user', '1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out');
      expect(authService.logout).toHaveBeenCalled();
    });

    test('forwards logout errors', async () => {
      authService.logout.mockRejectedValue(new Error('Logout failed'));

      const response = await request(app)
        .post('/api/auth/logout')
        .set('x-auth-user', '1');

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Logout failed');
    });
  });

  test('does not register development session route in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    let productionRouter;

    try {
      process.env.NODE_ENV = 'production';

      jest.isolateModules(() => {
        productionRouter = require('./auth.routes');
      });
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }

    const productionApp = express();
    productionApp.use(express.json());
    productionApp.use('/api/auth', productionRouter);

    const response = await request(productionApp)
      .post('/api/auth/__dev-session')
      .send({});

    expect(response.status).toBe(404);
  });
});