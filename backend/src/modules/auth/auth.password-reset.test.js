// STP TC-20 (password reset: request → use once → reuse rejected → expired rejected)
// FR-AUTH-05, NFR-SEC-07 (no PII in logs).
// Requires a live PostgreSQL via backend/.env (skips if DATABASE_URL is unset).

const request = require('supertest');
const app = require('../../app');
const { pool } = require('../../database/db');
const hasDatabase = Boolean(
  process.env.DATABASE_URL ||
  (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER)
);
const describeIfDb = hasDatabase ? describe : describe.skip;

const DONOR_EMAIL = 'john.doe@example.com';
const DONOR_ID = 'USR-DNR01';

describeIfDb('Password reset (TC-20, FR-AUTH-05)', () => {
  // Reset the donor to a known password before each test so tests are independent.
  beforeAll(async () => {
    // Restore the seed password for the donor if a previous test changed it.
    await pool.query(
      `UPDATE users
          SET password_hash = '$2b$10$w3OKVq0YKqTSozS8Neu.quLt9laFtz06c0SO8RE.r0nakZtKFJu5q',
              failed_count = 0,
              locked_until = NULL
        WHERE user_id = $1`,
      [DONOR_ID]
    );
  });

  afterEach(async () => {
    // Delete any tokens created by the test, so runs do not accumulate rows.
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [DONOR_ID]
    );
  });

  afterAll(async () => {
    // Restore the seed hash one more time, in case the last test used a
    // different password. Then leave the DB as we found it.
    await pool.query(
      `UPDATE users
          SET password_hash = '$2b$10$w3OKVq0YKqTSozS8Neu.quLt9laFtz06c0SO8RE.r0nakZtKFJu5q',
              failed_count = 0,
              locked_until = NULL
        WHERE user_id = $1`,
      [DONOR_ID]
    );
  });

  it('unknown email returns a generic success message (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@nowhere.local' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If the email is registered/);
    // The dev response does not leak a token for an unknown email.
    expect(res.body.resetToken).toBeUndefined();
  });

  it('known email returns a token and an expiry', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: DONOR_EMAIL });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: expect.any(String),
      resetToken: expect.any(String),
      expiresAt: expect.any(String),
    });
    // 32-byte hex = 64 chars.
    expect(res.body.resetToken).toHaveLength(64);

    const expiresInMs = new Date(res.body.expiresAt).getTime() - Date.now();
    expect(expiresInMs).toBeGreaterThan(14 * 60 * 1000);
    expect(expiresInMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it('valid token resets the password; the new password works for login', async () => {
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: DONOR_EMAIL });
    expect(forgot.status).toBe(200);
    const token = forgot.body.resetToken;

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NewPass123' });
    expect(reset.status).toBe(200);
    expect(reset.body.message).toMatch(/Password reset successfully/);

    // Login with the new password.
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: DONOR_EMAIL, password: 'NewPass123' });
    expect(login.status).toBe(200);
    expect(login.body.role).toBe('Donor');
  });

  it('reusing the same token is rejected', async () => {
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: DONOR_EMAIL });
    const token = forgot.body.resetToken;

    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NewPass123' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'AnotherPass456' });
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('TOKEN_ALREADY_USED');
  });

  it('expired token is rejected', async () => {
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: DONOR_EMAIL });
    const token = forgot.body.resetToken;

    // Expire the token by moving its stored expiry to the past.
    await pool.query(
      `UPDATE password_reset_tokens
          SET expires_at = NOW() - INTERVAL '1 minute'
        WHERE user_id = $1`,
      [DONOR_ID]
    );

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NewPass123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('invalid token is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), newPassword: 'NewPass123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('new token invalidates the previous unused token', async () => {
    const first = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: DONOR_EMAIL });
    const firstToken = first.body.resetToken;

    const second = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: DONOR_EMAIL });
    const secondToken = second.body.resetToken;

    // The first token is gone from the table; reset with it fails.
    const firstAttempt = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: firstToken, newPassword: 'NewPass123' });
    expect(firstAttempt.status).toBe(400);
    expect(firstAttempt.body.error.code).toBe('INVALID_TOKEN');

    // The second token works.
    const secondAttempt = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: secondToken, newPassword: 'NewPass123' });
    expect(secondAttempt.status).toBe(200);
  });

  it('writes PASSWORD_RESET_REQUESTED and PASSWORD_RESET_COMPLETED to audit_log', async () => {
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: DONOR_EMAIL });
    const token = forgot.body.resetToken;

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NewPass123' });

    const { rows } = await pool.query(
      `SELECT action FROM audit_log
        WHERE user_id = $1
          AND action IN ('PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED')
        ORDER BY created_at`,
      [DONOR_ID]
    );
    const actions = rows.map((r) => r.action);
    expect(actions).toContain('PASSWORD_RESET_REQUESTED');
    expect(actions).toContain('PASSWORD_RESET_COMPLETED');
  });
});