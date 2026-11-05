jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('../../database/transaction', () => ({
  withTransaction: jest.fn(),
}));

jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../audit/audit.repository', () => ({
  logAudit: jest.fn(),
}));

jest.mock('./admin.repository', () => ({
  insertStaffUser: jest.fn(),
  listUsers: jest.fn(),
  findUserById: jest.fn(),
  countOtherActiveAdmins: jest.fn(),
  updateUserStatus: jest.fn(),
  updateUserRole: jest.fn(),
  listAuditLogs: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const { withTransaction } = require('../../database/transaction');
const { query } = require('../../database/db');
const { logAudit } = require('../audit/audit.repository');
const repo = require('./admin.repository');
const service = require('./admin.service');

const txQuery = jest.fn();
const tx = { query: txQuery };

const user = {
  user_id: 'USR-001',
  name: 'Test User',
  email: 'test@example.com',
  phone: '9876543210',
  role: 'Staff',
  status: 'Active',
  created_at: '2026-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();

  withTransaction.mockImplementation(async (callback) => callback(tx));
  bcrypt.hash.mockResolvedValue('hashed-password');

  query.mockResolvedValue({ rows: [] });
  txQuery.mockResolvedValue({ rows: [] });

  repo.insertStaffUser.mockResolvedValue({
    ...user,
    user_id: 'USR-STF01',
  });

  repo.listUsers.mockResolvedValue([user]);
  repo.findUserById.mockResolvedValue(user);
  repo.countOtherActiveAdmins.mockResolvedValue(1);
  repo.updateUserStatus.mockResolvedValue(user);
  repo.updateUserRole.mockResolvedValue(user);
  repo.listAuditLogs.mockResolvedValue([]);
  logAudit.mockResolvedValue(undefined);
});

describe('admin.service', () => {
  describe('AdminError', () => {
    test('uses the default status code', () => {
      const error = new service.AdminError('TEST', 'Test error');

      expect(error.code).toBe('TEST');
      expect(error.status).toBe(400);
      expect(error.publicMessage).toBe('Test error');
    });

    test('uses a supplied status code', () => {
      const error = new service.AdminError('TEST', 'Test error', 403);

      expect(error.status).toBe(403);
    });
  });

  describe('createStaff', () => {
    const input = {
      name: 'New Staff',
      email: 'staff@example.com',
      phone: '9876543210',
      temporaryPassword: 'Temporary123',
    };

    test('rejects an existing email', async () => {
      query.mockResolvedValueOnce({ rows: [{ user_id: 'USR-001' }] });

      await expect(service.createStaff(input)).rejects.toMatchObject({
        code: 'ACCOUNT_EXISTS',
        status: 409,
      });

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    test('rejects an existing phone number', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'USR-002' }] });

      await expect(service.createStaff(input)).rejects.toMatchObject({
        code: 'ACCOUNT_EXISTS',
        status: 409,
      });

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    test('creates the first staff user when no previous staff user exists', async () => {
      txQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.createStaff(input);

      expect(bcrypt.hash).toHaveBeenCalledWith('Temporary123', 10);
      expect(repo.insertStaffUser).toHaveBeenCalledWith(tx, {
        userId: 'USR-STF01',
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: 'hashed-password',
      });

      expect(result).toEqual({
        userId: 'USR-STF01',
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        role: 'Staff',
        status: 'Active',
        createdAt: '2026-01-01',
      });

      expect(logAudit).toHaveBeenCalled();
    });

    test('increments the sequence when a staff user already exists', async () => {
      txQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'USR-STF05' }],
      });

      await service.createStaff(input);

      expect(repo.insertStaffUser).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ userId: 'USR-STF06' })
      );
    });

    test('rejects creation when the staff ID pool is exhausted', async () => {
      txQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'USR-STF99' }],
      });

      await expect(service.createStaff(input)).rejects.toMatchObject({
        message: 'User ID pool exhausted for Staff',
        status: 500,
      });

      expect(repo.insertStaffUser).not.toHaveBeenCalled();
    });
  });

  describe('listUsers', () => {
    test('lists users and returns their total count', async () => {
      const result = await service.listUsers({});

      expect(result.total).toBe(1);
      expect(result.users[0]).toEqual({
        userId: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
      });
    });

    test('passes valid filters to the repository', async () => {
      await service.listUsers({
        role: 'Staff',
        status: 'Active',
        q: 'test',
      });

      expect(repo.listUsers).toHaveBeenCalledWith({
        role: 'Staff',
        status: 'Active',
        q: 'test',
      });
    });

    test('rejects an invalid role filter', async () => {
      await expect(
        service.listUsers({ role: 'Invalid' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    });

    test('rejects an invalid status filter', async () => {
      await expect(
        service.listUsers({ status: 'Unknown' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    });

    test('handles a null user row', async () => {
      repo.listUsers.mockResolvedValue([null]);

      const result = await service.listUsers({});

      expect(result).toEqual({ users: [null], total: 1 });
    });
    test('returns an empty list when no users exist', async () => {
      repo.listUsers.mockResolvedValue([]);

      const result = await service.listUsers({});

      expect(result).toEqual({ users: [], total: 0 });
    });
  });

  describe('setStatus', () => {
    test('rejects an invalid status', async () => {
      await expect(
        service.setStatus({
          adminUserId: 'ADMIN-01',
          targetUserId: 'USR-01',
          status: 'Unknown',
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });

      expect(withTransaction).not.toHaveBeenCalled();
    });

    test('rejects when the target user does not exist', async () => {
      repo.findUserById.mockResolvedValue(null);

      await expect(
        service.setStatus({
          adminUserId: 'ADMIN-01',
          targetUserId: 'USR-01',
          status: 'Inactive',
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    });

    test('prevents an admin from changing their own status', async () => {
      await expect(
        service.setStatus({
          adminUserId: 'USR-001',
          targetUserId: 'USR-001',
          status: 'Inactive',
        })
      ).rejects.toMatchObject({
        code: 'SELF_ACTION_DENIED',
        status: 403,
      });
    });

    test('prevents deactivation of the last active admin', async () => {
      repo.findUserById.mockResolvedValue({
        ...user,
        role: 'Admin',
        status: 'Active',
      });
      repo.countOtherActiveAdmins.mockResolvedValue(0);

      await expect(
        service.setStatus({
          adminUserId: 'ADMIN-02',
          targetUserId: 'USR-001',
          status: 'Inactive',
        })
      ).rejects.toMatchObject({
        code: 'LAST_ADMIN',
        status: 409,
      });

      expect(repo.updateUserStatus).not.toHaveBeenCalled();
    });

    test('deactivates an admin when another active admin exists', async () => {
      repo.findUserById.mockResolvedValue({
        ...user,
        role: 'Admin',
        status: 'Active',
      });
      repo.countOtherActiveAdmins.mockResolvedValue(1);

      await service.setStatus({
        adminUserId: 'ADMIN-02',
        targetUserId: 'USR-001',
        status: 'Inactive',
      });

      expect(repo.updateUserStatus).toHaveBeenCalledWith(
        tx,
        'USR-001',
        'Inactive'
      );
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_DEACTIVATED' }),
        tx
      );
    });

    test('activates a user and records the activation audit action', async () => {
      await service.setStatus({
        adminUserId: 'ADMIN-02',
        targetUserId: 'USR-001',
        status: 'Active',
      });

      expect(repo.updateUserStatus).toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_ACTIVATED' }),
        tx
      );
    });

    test('does not check other admins when the target is not an active admin', async () => {
      repo.findUserById.mockResolvedValue({
        ...user,
        role: 'Staff',
        status: 'Active',
      });

      await service.setStatus({
        adminUserId: 'ADMIN-02',
        targetUserId: 'USR-001',
        status: 'Inactive',
      });

      expect(repo.countOtherActiveAdmins).not.toHaveBeenCalled();
      expect(repo.updateUserStatus).toHaveBeenCalled();
    });
  });

  describe('setRole', () => {
    test('rejects an invalid role', async () => {
      await expect(
        service.setRole({
          adminUserId: 'ADMIN-01',
          targetUserId: 'USR-01',
          role: 'Invalid',
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

      expect(withTransaction).not.toHaveBeenCalled();
    });

    test('rejects when the target user does not exist', async () => {
      repo.findUserById.mockResolvedValue(null);

      await expect(
        service.setRole({
          adminUserId: 'ADMIN-01',
          targetUserId: 'USR-01',
          role: 'Staff',
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    test('prevents an admin from changing their own role', async () => {
      await expect(
        service.setRole({
          adminUserId: 'USR-001',
          targetUserId: 'USR-001',
          role: 'Staff',
        })
      ).rejects.toMatchObject({
        code: 'SELF_ACTION_DENIED',
        status: 403,
      });
    });

    test('prevents demotion of the last active admin', async () => {
      repo.findUserById.mockResolvedValue({
        ...user,
        role: 'Admin',
        status: 'Active',
      });
      repo.countOtherActiveAdmins.mockResolvedValue(0);

      await expect(
        service.setRole({
          adminUserId: 'ADMIN-02',
          targetUserId: 'USR-001',
          role: 'Staff',
        })
      ).rejects.toMatchObject({
        code: 'LAST_ADMIN',
        status: 409,
      });

      expect(repo.updateUserRole).not.toHaveBeenCalled();
    });

    test('allows demotion when another active admin exists', async () => {
      repo.findUserById.mockResolvedValue({
        ...user,
        role: 'Admin',
        status: 'Active',
      });
      repo.countOtherActiveAdmins.mockResolvedValue(1);

      await service.setRole({
        adminUserId: 'ADMIN-02',
        targetUserId: 'USR-001',
        role: 'Staff',
      });

      expect(repo.updateUserRole).toHaveBeenCalledWith(
        tx,
        'USR-001',
        'Staff'
      );
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ROLE_CHANGED' }),
        tx
      );
    });

    test('changes role without checking other admins when target is not an active admin', async () => {
      repo.findUserById.mockResolvedValue({
        ...user,
        role: 'Staff',
        status: 'Active',
      });

      await service.setRole({
        adminUserId: 'ADMIN-02',
        targetUserId: 'USR-001',
        role: 'Donor',
      });

      expect(repo.countOtherActiveAdmins).not.toHaveBeenCalled();
      expect(repo.updateUserRole).toHaveBeenCalled();
    });

    test('does not check other admins when assigning the Admin role', async () => {
      repo.findUserById.mockResolvedValue({
        ...user,
        role: 'Admin',
        status: 'Active',
      });

      await service.setRole({
        adminUserId: 'ADMIN-02',
        targetUserId: 'USR-001',
        role: 'Admin',
      });

      expect(repo.countOtherActiveAdmins).not.toHaveBeenCalled();
      expect(repo.updateUserRole).toHaveBeenCalled();
    });
  });

  describe('listAuditLogs', () => {
    test('uses the default limit', async () => {
      await service.listAuditLogs();

      expect(repo.listAuditLogs).toHaveBeenCalledWith({ limit: 100 });
    });

    test('uses a valid supplied limit', async () => {
      await service.listAuditLogs({ limit: '25' });

      expect(repo.listAuditLogs).toHaveBeenCalledWith({ limit: 25 });
    });

    test('uses the default limit for an invalid value', async () => {
      await service.listAuditLogs({ limit: 'invalid' });

      expect(repo.listAuditLogs).toHaveBeenCalledWith({ limit: 100 });
    });

    test('does not allow a limit below one', async () => {
      await service.listAuditLogs({ limit: '-5' });

      expect(repo.listAuditLogs).toHaveBeenCalledWith({ limit: 1 });
    });

    test('does not allow a limit above 500', async () => {
      await service.listAuditLogs({ limit: '900' });

      expect(repo.listAuditLogs).toHaveBeenCalledWith({ limit: 500 });
    });
  });
});


