// STP TC-01 (valid registration + bcrypt hash + weak password rejection)
// STP TC-19 (duplicate email AND duplicate phone)
// FR-AUTH-01, FR-AUTH-02, NFR-SEC-01.

const request = require('supertest');
const app = require('../../app');
const db = require('../../database/db');

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describeIfDb('POST /api/auth/register', () => {
  const createdUserIds = [];

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.query('DELETE FROM users WHERE user_id = ANY($1)', [createdUserIds]);
    }
  });

  function uniqueEmail() {
    return `test.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;
  }
  function uniquePhone() {
    // 10 digits; last 8 from timestamp+random
    return ('98' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100).toString().padStart(2, '0')).slice(0, 10);
  }

  const valid = () => ({
    name: 'Test User',
    email: uniqueEmail(),
    phone: uniquePhone(),
    password: 'ValidPass123',
    role: 'Donor',
  });

  it('TC-01: valid registration returns 201 and stores a bcrypt hash', async () => {
    const payload = valid();
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      userId: expect.stringMatching(/^USR-DNR\d{2}$/),
      role: 'Donor',
      message: expect.any(String),
    });
    createdUserIds.push(res.body.userId);

    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [res.body.userId]
    );
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$10\$/);
    expect(rows[0].password_hash).not.toBe(payload.password);
  });

  it('TC-01: weak password "abc123" is rejected with 400', async () => {
    const payload = { ...valid(), password: 'abc123' };
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body.error)).toMatch(/password/i);
  });

  it('TC-19: duplicate email returns 409 "Account already exists"', async () => {
    const first = valid();
    const r1 = await request(app).post('/api/auth/register').send(first);
    expect(r1.status).toBe(201);
    createdUserIds.push(r1.body.userId);

    const second = { ...valid(), email: first.email };
    const r2 = await request(app).post('/api/auth/register').send(second);
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('ACCOUNT_EXISTS');
    expect(r2.body.error.message).toBe('Account already exists');
  });

  it('TC-19: duplicate phone returns 409 "Account already exists"', async () => {
    const first = valid();
    const r1 = await request(app).post('/api/auth/register').send(first);
    expect(r1.status).toBe(201);
    createdUserIds.push(r1.body.userId);

    const second = { ...valid(), phone: first.phone };
    const r2 = await request(app).post('/api/auth/register').send(second);
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('ACCOUNT_EXISTS');
    expect(r2.body.error.message).toBe('Account already exists');
  });

  it('rejects role=Admin with 400 (BR-01: no public admin creation)', async () => {
    const payload = { ...valid(), role: 'Admin' };
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects password without uppercase, without lowercase, without digit', async () => {
    const cases = ['alllowercase123', 'ALLUPPERCASE123', 'NoDigitsHere'];
    for (const password of cases) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...valid(), password });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects phone that is not 10 digits', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid(), phone: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});