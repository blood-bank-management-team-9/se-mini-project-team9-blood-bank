jest.mock('../../database/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/db');
const repo = require('./auth.repository');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth.repository', () => {
  describe('findByEmail', () => {
    it('returns a user when found', async () => {
      const user = { user_id: 'USR001', email: 'test@example.com' };
      query.mockResolvedValue({ rows: [user] });

      await expect(repo.findByEmail('test@example.com')).resolves.toEqual(user);
      expect(query.mock.calls[0][1]).toEqual(['test@example.com']);
    });

    it('returns null when the user is not found', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(repo.findByEmail('missing@example.com')).resolves.toBeNull();
    });

    it('uses the supplied transaction', async () => {
      const user = { user_id: 'USR002', email: 'tx@example.com' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [user] }),
      };

      await expect(repo.findByEmail('tx@example.com', tx)).resolves.toEqual(user);

      expect(tx.query.mock.calls[0][1]).toEqual(['tx@example.com']);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('findByPhone', () => {
    it('returns a user when found', async () => {
      const user = { user_id: 'USR003', phone: '9876543210' };
      query.mockResolvedValue({ rows: [user] });

      await expect(repo.findByPhone('9876543210')).resolves.toEqual(user);
      expect(query.mock.calls[0][1]).toEqual(['9876543210']);
    });

    it('returns null when the user is not found', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(repo.findByPhone('0000000000')).resolves.toBeNull();
    });

    it('uses the supplied transaction', async () => {
      const user = { user_id: 'USR004', phone: '9123456780' };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [user] }),
      };

      await expect(repo.findByPhone('9123456780', tx)).resolves.toEqual(user);

      expect(tx.query.mock.calls[0][1]).toEqual(['9123456780']);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('maxSequenceForPrefix', () => {
    it('returns zero when no users match the prefix', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };

      await expect(repo.maxSequenceForPrefix('DNR', tx)).resolves.toBe(0);
      expect(tx.query.mock.calls[0][1]).toEqual(['DNR%']);
    });

    it('returns the numeric suffix when a matching user exists', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({
          rows: [{ user_id: 'DNR-25' }],
        }),
      };

      await expect(repo.maxSequenceForPrefix('DNR-', tx)).resolves.toBe(25);
    });

    it('returns zero when the user ID has no two-digit suffix', async () => {
      const tx = {
        query: jest.fn().mockResolvedValue({
          rows: [{ user_id: 'DNR-ABC' }],
        }),
      };

      await expect(repo.maxSequenceForPrefix('DNR-', tx)).resolves.toBe(0);
    });
  });

  describe('insertUser', () => {
    it('inserts a user and returns the created record', async () => {
      const user = {
        user_id: 'DNR-01',
        name: 'Test Donor',
        email: 'test@example.com',
        phone: '9876543210',
        password_hash: 'hashed-password',
        role: 'donor',
        status: 'Active',
      };
      const tx = {
        query: jest.fn().mockResolvedValue({ rows: [user] }),
      };

      await expect(
        repo.insertUser(tx, {
          userId: 'DNR-01',
          name: 'Test Donor',
          email: 'test@example.com',
          phone: '9876543210',
          passwordHash: 'hashed-password',
          role: 'donor',
        })
      ).resolves.toEqual(user);

      expect(tx.query.mock.calls[0][1]).toEqual([
        'DNR-01',
        'Test Donor',
        'test@example.com',
        '9876543210',
        'hashed-password',
        'donor',
      ]);
    });
  });

  describe('findByEmailForLogin', () => {
    it('returns the login user when found', async () => {
      const user = {
        user_id: 'USR001',
        email: 'test@example.com',
        failed_count: 2,
      };
      query.mockResolvedValue({ rows: [user] });

      await expect(
        repo.findByEmailForLogin('test@example.com')
      ).resolves.toEqual(user);

      expect(query.mock.calls[0][1]).toEqual(['test@example.com']);
    });

    it('returns null when the email does not exist', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(
        repo.findByEmailForLogin('missing@example.com')
      ).resolves.toBeNull();
    });
  });

  describe('incrementFailedCount', () => {
    it('returns the updated failed count', async () => {
      query.mockResolvedValue({ rows: [{ failed_count: 3 }] });

      await expect(repo.incrementFailedCount('USR001')).resolves.toBe(3);
      expect(query.mock.calls[0][1]).toEqual(['USR001']);
    });

    it('returns zero when no user is updated', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(repo.incrementFailedCount('USR999')).resolves.toBe(0);
    });
  });

  describe('lockAccount', () => {
    it('uses the default lock duration of 15 minutes', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(repo.lockAccount('USR001')).resolves.toBeUndefined();

      expect(query.mock.calls[0][1]).toEqual(['USR001', '15']);
    });

    it('uses a supplied lock duration', async () => {
      query.mockResolvedValue({ rows: [] });

      await repo.lockAccount('USR002', 30);

      expect(query.mock.calls[0][1]).toEqual(['USR002', '30']);
    });
  });

  describe('resetLoginFailures', () => {
    it('resets the failed count and clears the lock', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(repo.resetLoginFailures('USR001')).resolves.toBeUndefined();

      expect(query.mock.calls[0][1]).toEqual(['USR001']);
      expect(query.mock.calls[0][0]).toContain('failed_count = 0');
      expect(query.mock.calls[0][0]).toContain('locked_until = NULL');
    });
  });

  describe('clearExpiredLock', () => {
    it('clears an expired account lock', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(repo.clearExpiredLock('USR001')).resolves.toBeUndefined();

      expect(query.mock.calls[0][1]).toEqual(['USR001']);
      expect(query.mock.calls[0][0]).toContain('locked_until IS NOT NULL');
      expect(query.mock.calls[0][0]).toContain('locked_until <= NOW()');
    });
  });
});
