// STP TC-02 (lockout after 5 failures, correct password refused during lock)
// STP TC-19 partial (role-based login for each role)
// FR-AUTH-03, FR-AUTH-04, FR-AUTH-07, NFR-SEC-06.

const request = require('supertest');
const app = require('../../app');
const db = require('../../database/db');

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

// Seeded user emails. Password for all seed accounts is `Test@1234` per seeds.sql.
const SEED_USERS = {
  Donor: { email: 'john.doe@example.com' },
  Staff: { email: 'staff@bloodbank.org' },
  Admin: { email: 'admin@bloodbank.org' },
  'Hospital/Patient': { email: 'hospital@citygen.org' },
};
const SEED_PASSWORD = 'Test@1234';

describeIfDb('POST /api/auth/login', () => {
  // Reset seeded users before each test so lockout state does not leak.
  beforeEach(async () => {
    await db.query(
      `UPDATE users
          SET failed_count = 0,
              locked_until = NULL,
              status = 'Active'
        WHERE email = ANY($1)`,
      [Object.values(SEED_USERS).map((u) => u.email)]
    );
  });

  it('TC-19: logs in each seeded role and returns userId + role', async () => {
    for (const [role, creds] of Object.entries(SEED_USERS)) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: creds.email, password: SEED_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        userId: expect.any(String),
        role,
        name: expect.any(String),
      });
    }
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.local', password: 'Test@1234' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 for wrong password (same message as unknown email)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USERS.Donor.email, password: 'WrongPass123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('TC-02: 5 failed attempts lock the account for 15 minutes', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: SEED_USERS.Donor.email, password: 'WrongPass123' });
    }
    // 6th attempt with the CORRECT password must be refused per FR-AUTH-04.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USERS.Donor.email, password: SEED_PASSWORD });
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(res.body.error.minutesLeft).toBeGreaterThan(0);
    expect(res.body.error.minutesLeft).toBeLessThanOrEqual(15);
  });

  it('lock does not affect other accounts (SO-3)', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: SEED_USERS.Donor.email, password: 'WrongPass123' });
    }
    // Staff account is unaffected.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USERS.Staff.email, password: SEED_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('returns 403 for inactive account with correct password', async () => {
    await db.query(
      `UPDATE users SET status = 'Inactive' WHERE email = $1`,
      [SEED_USERS.Donor.email]
    );
    try {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: SEED_USERS.Donor.email, password: SEED_PASSWORD });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    } finally {
      await db.query(
        `UPDATE users SET status = 'Active' WHERE email = $1`,
        [SEED_USERS.Donor.email]
      );
    }
  });

  it('returns 400 VALIDATION_ERROR for missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USERS.Donor.email });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // NFR-SEC-06: login events must be written to audit_log with user ID and timestamp.
  // NFR-SEC-07: no raw email in logs — only email_masked.
  it('writes LOGIN_SUCCESS and LOGIN_FAILED rows to audit_log (NFR-SEC-06)', async () => {
    // Clear prior audit rows for the donor so we can assert only the new ones.
    await db.query(
      `DELETE FROM audit_log
        WHERE user_id = (SELECT user_id FROM users WHERE email = $1)`,
      [SEED_USERS.Donor.email]
    );

    // Successful login.
    const okRes = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USERS.Donor.email, password: SEED_PASSWORD });
    expect(okRes.status).toBe(200);

    // Failed login.
    const badRes = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED_USERS.Donor.email, password: 'WrongPass123' });
    expect(badRes.status).toBe(401);

    const { rows } = await db.query(
      `SELECT action, new_value
         FROM audit_log
        WHERE user_id = (SELECT user_id FROM users WHERE email = $1)
        ORDER BY created_at DESC
        LIMIT 2`,
      [SEED_USERS.Donor.email]
    );
    const actions = rows.map((r) => r.action).sort();
    expect(actions).toEqual(['LOGIN_FAILED', 'LOGIN_SUCCESS']);

    // The masked email must be present and the raw email must not.
    for (const row of rows) {
      expect(row.new_value.email_masked).toBeDefined();
      expect(JSON.stringify(row.new_value)).not.toContain(SEED_USERS.Donor.email);
    }
  });
});

describeIfDb('POST /api/auth/logout (FR-AUTH-07)', () => {
  beforeEach(async () => {
    await db.query(
      `UPDATE users
          SET failed_count = 0,
              locked_until = NULL,
              status = 'Active'
        WHERE email = $1`,
      [SEED_USERS.Donor.email]
    );
  });

  it('ends the session: subsequent /me returns 401', async () => {
    const agent = request.agent(app);

    // Login with the seeded Donor.
    const login = await agent
      .post('/api/auth/login')
      .send({ email: SEED_USERS.Donor.email, password: SEED_PASSWORD });
    expect(login.status).toBe(200);

    // Confirm session works.
    const me1 = await agent.get('/api/auth/me');
    expect(me1.status).toBe(200);
    expect(me1.body.user.role).toBe('Donor');

    // Logout.
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    // Session gone.
    const me2 = await agent.get('/api/auth/me');
    expect(me2.status).toBe(401);
  });
});