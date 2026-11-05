jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/db');
const repo = require('./admin.repository');

describe('admin.repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    test('lists users without filters', async () => {
      query.mockResolvedValue({ rows: [{ user_id: 'U001' }] });

      const result = await repo.listUsers();

      expect(result).toEqual([{ user_id: 'U001' }]);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        []
      );
    });

    test('filters users by role', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listUsers({ role: 'Admin' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE role = $1'),
        ['Admin']
      );
    });

    test('filters users by status', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listUsers({ status: 'Active' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['Active']
      );
    });

    test('filters users by search term', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listUsers({ q: 'Rohan' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('(name ILIKE $1 OR email ILIKE $1)'),
        ['%Rohan%']
      );
    });

    test('combines role, status and search filters', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listUsers({
        role: 'Staff',
        status: 'Active',
        q: 'Test',
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('role = $1 AND status = $2 AND (name ILIKE $3 OR email ILIKE $3)'),
        ['Staff', 'Active', '%Test%']
      );
    });
  });

  describe('findUserById', () => {
    test('finds a user without a transaction', async () => {
      query.mockResolvedValue({ rows: [{ user_id: 'U001' }] });

      const result = await repo.findUserById('U001');

      expect(result).toEqual({ user_id: 'U001' });
      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('FOR UPDATE'),
        ['U001']
      );
    });

    test('returns null when the user does not exist', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await repo.findUserById('U999');

      expect(result).toBeNull();
    });

    test('uses a transaction and locks the selected row', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({
          rows: [{ user_id: 'U001' }],
        }),
      };

      const result = await repo.findUserById('U001', tx);

      expect(result).toEqual({ user_id: 'U001' });
      expect(tx.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        ['U001']
      );
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('countOtherActiveAdmins', () => {
    test('returns the number of other active admins', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [{ n: 3 }] }),
      };

      const result = await repo.countOtherActiveAdmins('U001', tx);

      expect(result).toBe(3);
      expect(tx.query).toHaveBeenCalledWith(
        expect.stringContaining("role = 'Admin'"),
        ['U001']
      );
    });
  });

  describe('insertStaffUser', () => {
    test('inserts a staff user and returns the inserted row', async () => {
      const inserted = { user_id: 'S001', role: 'Staff' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [inserted] }),
      };

      const result = await repo.insertStaffUser(tx, {
        userId: 'S001',
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        passwordHash: 'hashed-password',
      });

      expect(result).toEqual(inserted);
      expect(tx.query).toHaveBeenCalledWith(
        expect.stringContaining("VALUES ($1, $2, $3, $4, $5, 'Staff', 'Active')"),
        ['S001', 'Test User', 'test@example.com', '9876543210', 'hashed-password']
      );
    });
  });

  describe('updateUserStatus', () => {
    test('updates and returns the user status', async () => {
      const updated = { user_id: 'U001', status: 'Inactive' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [updated] }),
      };

      const result = await repo.updateUserStatus(tx, 'U001', 'Inactive');

      expect(result).toEqual(updated);
      expect(tx.query).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $2'),
        ['U001', 'Inactive']
      );
    });
  });

  describe('updateUserRole', () => {
    test('updates and returns the user role', async () => {
      const updated = { user_id: 'U001', role: 'Staff' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [updated] }),
      };

      const result = await repo.updateUserRole(tx, 'U001', 'Staff');

      expect(result).toEqual(updated);
      expect(tx.query).toHaveBeenCalledWith(
        expect.stringContaining('SET role = $2'),
        ['U001', 'Staff']
      );
    });
  });

  describe('listAuditLogs', () => {
    test('uses the default limit', async () => {
      query.mockResolvedValue({ rows: [{ log_id: 1 }] });

      const result = await repo.listAuditLogs();

      expect(result).toEqual([{ log_id: 1 }]);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        [100]
      );
    });

    test('uses a supplied limit', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.listAuditLogs({ limit: 25 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        [25]
      );
    });
  });
});
