// src/modules/donors/donors.repository.test.js
jest.mock('../../database/db', () => ({ query: jest.fn() }));
const db = require('../../database/db');
const repo = require('./donors.repository');

const mkRes = (rows) => ({ rows });
const txMock = (rowsOrNull = []) => ({
  query: jest.fn().mockResolvedValue(mkRes(rowsOrNull)),
});
// For multi-call tx (nextDonorId does 2 queries)
function txSequence(responses) {
  const queue = [...responses];
  return {
    query: jest.fn().mockImplementation(() => Promise.resolve(queue.shift() || mkRes([]))),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('donors.repository', () => {
  // ── listDonors ─────────────────────────────────────────────────────
  describe('listDonors', () => {
    it('no filters → empty WHERE, no params', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await repo.listDonors();
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).not.toMatch(/WHERE/);
      expect(params).toEqual([]);
    });

    it('applies status as $1', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await repo.listDonors({ status: 'Active' });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/status = \$1/);
      expect(params).toEqual(['Active']);
    });

    it('applies bloodGroup as $1 when status absent', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await repo.listDonors({ bloodGroup: 'O+' });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/blood_group = \$1/);
      expect(params).toEqual(['O+']);
    });

    it('applies q with ILIKE across name/phone/email', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await repo.listDonors({ q: 'ali' });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/full_name ILIKE \$1/);
      expect(sql).toMatch(/phone ILIKE \$1/);
      expect(sql).toMatch(/email ILIKE \$1/);
      expect(params).toEqual(['%ali%']);
    });

    it('combines status + bloodGroup + q with numbered params', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await repo.listDonors({ status: 'Active', bloodGroup: 'A+', q: 'bob' });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/status = \$1/);
      expect(sql).toMatch(/blood_group = \$2/);
      expect(sql).toMatch(/ILIKE \$3/);
      expect(params).toEqual(['Active', 'A+', '%bob%']);
    });

    it('returns the rows from the query', async () => {
      db.query.mockResolvedValueOnce(mkRes([{ donor_id: 'DNR-1' }]));
      await expect(repo.listDonors()).resolves.toEqual([{ donor_id: 'DNR-1' }]);
    });
  });

  // ── findDonorById ──────────────────────────────────────────────────
  describe('findDonorById', () => {
    it('uses global query when no tx given', async () => {
      db.query.mockResolvedValueOnce(mkRes([{ donor_id: 'DNR-1' }]));
      const row = await repo.findDonorById('DNR-1');
      expect(row.donor_id).toBe('DNR-1');
      const [sql] = db.query.mock.calls[0];
      expect(sql).not.toMatch(/FOR UPDATE/);
    });

    it('adds FOR UPDATE when tx is provided', async () => {
      const tx = txMock([{ donor_id: 'DNR-1' }]);
      await repo.findDonorById('DNR-1', tx);
      const [sql] = tx.query.mock.calls[0];
      expect(sql).toMatch(/FOR UPDATE/);
    });

    it('returns null when not found', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await expect(repo.findDonorById('DNR-404')).resolves.toBeNull();
    });
  });

  // ── findDonorByUserId ──────────────────────────────────────────────
  describe('findDonorByUserId', () => {
    it('uses global query without tx', async () => {
      db.query.mockResolvedValueOnce(mkRes([{ donor_id: 'DNR-1', user_id: 'USR-1' }]));
      const row = await repo.findDonorByUserId('USR-1');
      expect(row.user_id).toBe('USR-1');
      expect(db.query.mock.calls[0][0]).not.toMatch(/FOR UPDATE/);
    });

    it('adds FOR UPDATE when tx is provided', async () => {
      const tx = txMock([{ donor_id: 'DNR-1' }]);
      await repo.findDonorByUserId('USR-1', tx);
      expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    });

    it('returns null when not found', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await expect(repo.findDonorByUserId('USR-404')).resolves.toBeNull();
    });
  });

  // ── findDonorAccountById ───────────────────────────────────────────
  describe('findDonorAccountById', () => {
    it('returns the phone row and locks it', async () => {
      const tx = txMock([{ phone: '9999999999' }]);
      const row = await repo.findDonorAccountById('USR-1', tx);
      expect(row).toEqual({ phone: '9999999999' });
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/role = 'Donor'/);
      expect(sql).toMatch(/FOR UPDATE/);
      expect(params).toEqual(['USR-1']);
    });

    it('returns null when not found', async () => {
      const tx = txMock([]);
      await expect(repo.findDonorAccountById('USR-404', tx)).resolves.toBeNull();
    });
  });

  // ── findDonorByPhone ───────────────────────────────────────────────
  describe('findDonorByPhone', () => {
    it('returns the donor_id+user_id row and locks it', async () => {
      const tx = txMock([{ donor_id: 'DNR-1', user_id: null }]);
      const row = await repo.findDonorByPhone('9999999999', tx);
      expect(row).toEqual({ donor_id: 'DNR-1', user_id: null });
      expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    });

    it('returns null when not found', async () => {
      const tx = txMock([]);
      await expect(repo.findDonorByPhone('0', tx)).resolves.toBeNull();
    });
  });

  // ── linkDonorToUser ────────────────────────────────────────────────
  describe('linkDonorToUser', () => {
    it('binds (donorId, userId) and returns the returned donor row', async () => {
      const tx = txMock([{ donor_id: 'DNR-1' }]);
      const row = await repo.linkDonorToUser(tx, 'DNR-1', 'USR-1');
      expect(row).toEqual({ donor_id: 'DNR-1' });
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/user_id IS NULL/);
      expect(sql).toMatch(/RETURNING donor_id/);
      expect(params).toEqual(['DNR-1', 'USR-1']);
    });

    it('returns null when the donor is already linked (user_id NOT NULL)', async () => {
      const tx = txMock([]);
      await expect(repo.linkDonorToUser(tx, 'DNR-1', 'USR-1')).resolves.toBeNull();
    });
  });

  // ── listDonationHistory ────────────────────────────────────────────
  describe('listDonationHistory', () => {
    it('joins via donor.user_id and returns rows', async () => {
      db.query.mockResolvedValueOnce(mkRes([{ donation_id: 'DON-1' }]));
      const rows = await repo.listDonationHistory('USR-1');
      expect(rows).toEqual([{ donation_id: 'DON-1' }]);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/JOIN donors/);
      expect(sql).toMatch(/donor.user_id = \$1/);
      expect(params).toEqual(['USR-1']);
    });

    it('returns [] when the donor has no donations', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await expect(repo.listDonationHistory('USR-1')).resolves.toEqual([]);
    });
  });

  // ── nextDonorId ────────────────────────────────────────────────────
  describe('nextDonorId', () => {
    it('takes advisory lock, then returns next ID padded to 5 digits', async () => {
      const tx = txSequence([
        mkRes([]),                                // advisory lock
        mkRes([{ donor_id: 'DNR-00042' }]),       // current max
      ]);
      await expect(repo.nextDonorId(tx)).resolves.toBe('DNR-00043');
      expect(tx.query.mock.calls[0][0]).toMatch(/pg_advisory_xact_lock/);
    });

    it('starts at DNR-00001 when the table is empty', async () => {
      const tx = txSequence([mkRes([]), mkRes([])]);
      await expect(repo.nextDonorId(tx)).resolves.toBe('DNR-00001');
    });

    it('throws DONOR_ID_POOL_EXHAUSTED at max', async () => {
      const tx = txSequence([
        mkRes([]),
        mkRes([{ donor_id: 'DNR-99999' }]),
      ]);
      await expect(repo.nextDonorId(tx)).rejects.toMatchObject({
        code: 'DONOR_ID_POOL_EXHAUSTED',
      });
    });
  });

  // ── createDonor ────────────────────────────────────────────────────
  describe('createDonor', () => {
    it('binds all fields, defaults email/address to null', async () => {
      const tx = txMock([{ donor_id: 'DNR-00001' }]);
      const row = await repo.createDonor(tx, 'DNR-00001', {
        fullName: 'Alice',
        dob: '1990-01-01',
        gender: 'Female',
        bloodGroup: 'O+',
        weightKg: 55,
        phone: '9999999999',
        city: 'Pune',
        pinCode: '411001',
        // email + address omitted → must default to null
      });
      expect(row.donor_id).toBe('DNR-00001');
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO donors/);
      expect(sql).toMatch(/'Active'/);
      expect(params).toEqual([
        'DNR-00001',
        'Alice',
        '1990-01-01',
        'Female',
        'O+',
        55,
        '9999999999',
        null,
        null,
        'Pune',
        '411001',
      ]);
    });
  });

  // ── updateDonor ────────────────────────────────────────────────────
  describe('updateDonor', () => {
    it('binds all fields, defaults email/address to null, returns updated row', async () => {
      const tx = txMock([{ donor_id: 'DNR-1', full_name: 'Alice2' }]);
      const row = await repo.updateDonor(tx, 'DNR-1', {
        fullName: 'Alice2',
        dob: '1990-01-01',
        gender: 'Female',
        bloodGroup: 'A+',
        weightKg: 56,
        phone: '8888888888',
        city: 'Mumbai',
        pinCode: '400001',
      });
      expect(row.full_name).toBe('Alice2');
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/UPDATE donors/);
      expect(params).toEqual([
        'DNR-1', 'Alice2', '1990-01-01', 'Female', 'A+', 56,
        '8888888888', null, null, 'Mumbai', '400001',
      ]);
    });

    it('returns null when the donor row does not exist', async () => {
      const tx = txMock([]);
      await expect(repo.updateDonor(tx, 'DNR-404', {
        fullName: 'X', dob: '1990-01-01', gender: 'Male',
        bloodGroup: 'O+', weightKg: 70, phone: '1', city: 'X', pinCode: '1',
      })).resolves.toBeNull();
    });
  });

  // ── updateDonorStatus ──────────────────────────────────────────────
  describe('updateDonorStatus', () => {
    it('binds (donorId, status) and returns the updated row', async () => {
      const tx = txMock([{ donor_id: 'DNR-1', status: 'Inactive' }]);
      const row = await repo.updateDonorStatus(tx, 'DNR-1', 'Inactive');
      expect(row.status).toBe('Inactive');
      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toMatch(/SET status = \$2/);
      expect(params).toEqual(['DNR-1', 'Inactive']);
    });

    it('returns null when not found', async () => {
      const tx = txMock([]);
      await expect(repo.updateDonorStatus(tx, 'DNR-404', 'Active')).resolves.toBeNull();
    });
  });

  // ── getEligibilityConfig ───────────────────────────────────────────
  describe('getEligibilityConfig', () => {
    it('returns a key→value object built from rows', async () => {
      db.query.mockResolvedValueOnce(mkRes([
        { key: 'eligibility_min_age', value: '18' },
        { key: 'eligibility_max_age', value: '65' },
        { key: 'eligibility_gap_days_male', value: '90' },
      ]));
      const cfg = await repo.getEligibilityConfig();
      expect(cfg).toEqual({
        eligibility_min_age: '18',
        eligibility_max_age: '65',
        eligibility_gap_days_male: '90',
      });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/system_config/);
      expect(params[0]).toContain('eligibility_min_age');
    });

    it('returns {} when no config rows exist', async () => {
      db.query.mockResolvedValueOnce(mkRes([]));
      await expect(repo.getEligibilityConfig()).resolves.toEqual({});
    });
  });
});