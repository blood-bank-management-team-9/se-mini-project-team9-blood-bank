jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn(() => (req, res, next) => {
    req.session = { user: { userId: 'ADMIN001' } };
    next();
  }),
}));

jest.mock('./admin.service', () => {
  class AdminError extends Error {}

  return {
    AdminError,
    createStaff: jest.fn(),
    listUsers: jest.fn(),
    setStatus: jest.fn(),
    setRole: jest.fn(),
    listAuditLogs: jest.fn(),
  };
});

const express = require('express');
const request = require('supertest');
const router = require('./admin.routes');
const service = require('./admin.service');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api/admin', router);

  app.use((err, req, res, next) => {
    res.status(500).json({ forwarded: err.message });
  });

  return app;
}

function makeAdminError() {
  const error = new service.AdminError('Admin operation failed');
  error.status = 409;
  error.code = 'ADMIN_ERROR';
  error.publicMessage = 'Admin operation could not be completed';
  return error;
}

describe('admin.routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  describe('POST /users', () => {
    const validBody = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '9876543210',
      temporaryPassword: 'Password123',
    };

    test('creates a staff user', async () => {
      service.createStaff.mockResolvedValue({ user_id: 'S001' });

      const response = await request(app)
        .post('/api/admin/users')
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ user_id: 'S001' });
      expect(service.createStaff).toHaveBeenCalled();
    });

    test('rejects invalid staff details', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .send({
          name: '',
          email: 'invalid',
          phone: '123',
          temporaryPassword: 'weak',
        });

      expect(response.status).toBe(400);
      expect(service.createStaff).not.toHaveBeenCalled();
    });

    test('returns an AdminError response', async () => {
      service.createStaff.mockRejectedValue(makeAdminError());

      const response = await request(app)
        .post('/api/admin/users')
        .send(validBody);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ADMIN_ERROR');
      expect(response.body.error.requestId).toBeUndefined();
    });

    test('forwards an unexpected error', async () => {
      service.createStaff.mockRejectedValue(new Error('Unexpected failure'));

      const response = await request(app)
        .post('/api/admin/users')
        .send(validBody);

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Unexpected failure');
    });
  });

  describe('GET /users', () => {
    test('lists users with filters', async () => {
      service.listUsers.mockResolvedValue({ users: [], total: 0 });

      const response = await request(app)
        .get('/api/admin/users')
        .query({ role: 'Staff', status: 'Active', q: 'Test' });

      expect(response.status).toBe(200);
      expect(service.listUsers).toHaveBeenCalledWith({
        role: 'Staff',
        status: 'Active',
        q: 'Test',
      });
    });

    test('rejects an invalid role filter', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .query({ role: 'InvalidRole' });

      expect(response.status).toBe(400);
      expect(service.listUsers).not.toHaveBeenCalled();
    });

    test('returns an AdminError response', async () => {
      service.listUsers.mockRejectedValue(makeAdminError());

      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ADMIN_ERROR');
    });

    test('forwards an unexpected error', async () => {
      service.listUsers.mockRejectedValue(new Error('List failed'));

      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('List failed');
    });
  });

  describe('PATCH /users/:id/status', () => {
    test('updates a user status', async () => {
      service.setStatus.mockResolvedValue({
        user_id: 'U001',
        status: 'Inactive',
      });

      const response = await request(app)
        .patch('/api/admin/users/U001/status')
        .send({ status: 'Inactive' });

      expect(response.status).toBe(200);
      expect(service.setStatus).toHaveBeenCalledWith({
        adminUserId: 'ADMIN001',
        targetUserId: 'U001',
        status: 'Inactive',
      });
    });

    test('rejects an invalid status', async () => {
      const response = await request(app)
        .patch('/api/admin/users/U001/status')
        .send({ status: 'Invalid' });

      expect(response.status).toBe(400);
      expect(service.setStatus).not.toHaveBeenCalled();
    });

    test('returns an AdminError response', async () => {
      service.setStatus.mockRejectedValue(makeAdminError());

      const response = await request(app)
        .patch('/api/admin/users/U001/status')
        .send({ status: 'Active' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ADMIN_ERROR');
    });

    test('forwards an unexpected error', async () => {
      service.setStatus.mockRejectedValue(new Error('Status update failed'));

      const response = await request(app)
        .patch('/api/admin/users/U001/status')
        .send({ status: 'Active' });

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Status update failed');
    });
  });

  describe('PATCH /users/:id/role', () => {
    test('updates a user role', async () => {
      service.setRole.mockResolvedValue({
        user_id: 'U001',
        role: 'Staff',
      });

      const response = await request(app)
        .patch('/api/admin/users/U001/role')
        .send({ role: 'Staff' });

      expect(response.status).toBe(200);
      expect(service.setRole).toHaveBeenCalledWith({
        adminUserId: 'ADMIN001',
        targetUserId: 'U001',
        role: 'Staff',
      });
    });

    test('rejects an invalid role', async () => {
      const response = await request(app)
        .patch('/api/admin/users/U001/role')
        .send({ role: 'Invalid' });

      expect(response.status).toBe(400);
      expect(service.setRole).not.toHaveBeenCalled();
    });

    test('returns an AdminError response', async () => {
      service.setRole.mockRejectedValue(makeAdminError());

      const response = await request(app)
        .patch('/api/admin/users/U001/role')
        .send({ role: 'Staff' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ADMIN_ERROR');
    });

    test('forwards an unexpected error', async () => {
      service.setRole.mockRejectedValue(new Error('Role update failed'));

      const response = await request(app)
        .patch('/api/admin/users/U001/role')
        .send({ role: 'Staff' });

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Role update failed');
    });
  });

  describe('GET /audit-logs', () => {
    test('returns audit logs with the supplied limit', async () => {
      service.listAuditLogs.mockResolvedValue([{ log_id: 1 }]);

      const response = await request(app)
        .get('/api/admin/audit-logs')
        .query({ limit: '20' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ logs: [{ log_id: 1 }] });
      expect(service.listAuditLogs).toHaveBeenCalledWith({ limit: '20' });
    });

    test('returns an AdminError response', async () => {
      service.listAuditLogs.mockRejectedValue(makeAdminError());

      const response = await request(app).get('/api/admin/audit-logs');

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ADMIN_ERROR');
    });

    test('forwards an unexpected error', async () => {
      service.listAuditLogs.mockRejectedValue(new Error('Audit logs failed'));

      const response = await request(app).get('/api/admin/audit-logs');

      expect(response.status).toBe(500);
      expect(response.body.forwarded).toBe('Audit logs failed');
    });
  });
});
