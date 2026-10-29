// FR-AUTH-06 (profile view and update), NFR-SEC-07 (no PII in logs).
// Donor and Hospital/Patient can update name, phone, address.
// Staff and Admin get 403 ACCESS_DENIED.
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
const PATIENT_EMAIL = 'hospital@citygen.org';
const PATIENT_ID = 'USR-HSP01';
const STAFF_EMAIL = 'staff@bloodbank.org';
const ADMIN_EMAIL = 'admin@bloodbank.org';
const PASSWORD = 'Test@1234';

async function loginAs(email) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

describeIfDb('Profile (FR-AUTH-06)', () => {
  const originalDonor = {
    name: 'John Doe (Donor)',
    phone: '9876543212',
    address: '12 MG Road, Bangalore',
  };
  const originalPatient = {
    name: 'City General Hospital',
    phone: '9876543213',
    address: '100 Hospital Road, Bangalore',
  };

  afterEach(async () => {
    // Restore original profile fields for the two users this suite mutates.
    await pool.query(
      `UPDATE users SET name = $2, phone = $3, address = $4 WHERE user_id = $1`,
      [DONOR_ID, originalDonor.name, originalDonor.phone, originalDonor.address]
    );
    await pool.query(
      `UPDATE users SET name = $2, phone = $3, address = $4 WHERE user_id = $1`,
      [PATIENT_ID, originalPatient.name, originalPatient.phone, originalPatient.address]
    );
  });

  it('GET /api/auth/me returns the DB-backed profile for a Donor', async () => {
    const donor = await loginAs(DONOR_EMAIL);
    const res = await donor.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: DONOR_ID,
      name: originalDonor.name,
      email: DONOR_EMAIL,
      phone: originalDonor.phone,
      address: originalDonor.address,
      role: 'Donor',
      status: 'Active',
    });
  });

  it('GET /api/auth/me returns the profile for a Hospital/Patient', async () => {
    const patient = await loginAs(PATIENT_EMAIL);
    const res = await patient.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: PATIENT_ID,
      role: 'Hospital/Patient',
      address: originalPatient.address,
    });
  });

  it('PUT /api/auth/me updates name, phone and address for a Donor', async () => {
    const donor = await loginAs(DONOR_EMAIL);
    const res = await donor.put('/api/auth/me').send({
      name: 'John Doe Updated',
      phone: '9876543212',
      address: '99 Test Street, Bangalore',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: DONOR_ID,
      name: 'John Doe Updated',
      address: '99 Test Street, Bangalore',
    });

    // Confirm the DB is updated.
    const { rows } = await pool.query(
      'SELECT name, address FROM users WHERE user_id = $1',
      [DONOR_ID]
    );
    expect(rows[0].name).toBe('John Doe Updated');
    expect(rows[0].address).toBe('99 Test Street, Bangalore');
  });

  it('PUT /api/auth/me updates name, phone and address for a Hospital/Patient', async () => {
    const patient = await loginAs(PATIENT_EMAIL);
    const res = await patient.put('/api/auth/me').send({
      name: 'City General Hospital (East)',
      phone: '9876543213',
      address: '200 New Hospital Road, Bangalore',
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('City General Hospital (East)');
    expect(res.body.address).toBe('200 New Hospital Road, Bangalore');
  });

  it('PUT /api/auth/me rejects a phone already used by another user (409 ACCOUNT_EXISTS)', async () => {
    const donor = await loginAs(DONOR_EMAIL);
    // Try to set the donor's phone to the Staff user's phone.
    const res = await donor.put('/api/auth/me').send({
      name: originalDonor.name,
      phone: '9876543211', // Staff phone
      address: originalDonor.address,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_EXISTS');
  });

  it('PUT /api/auth/me rejects a phone that is not 10 digits (400 VALIDATION_ERROR)', async () => {
    const donor = await loginAs(DONOR_EMAIL);
    const res = await donor.put('/api/auth/me').send({
      name: originalDonor.name,
      phone: '123',
      address: originalDonor.address,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PUT /api/auth/me rejects a missing name (400 VALIDATION_ERROR)', async () => {
    const donor = await loginAs(DONOR_EMAIL);
    const res = await donor.put('/api/auth/me').send({
      phone: originalDonor.phone,
      address: originalDonor.address,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Staff cannot access GET or PUT /api/auth/me (403 ACCESS_DENIED)', async () => {
    const staff = await loginAs(STAFF_EMAIL);
    const getRes = await staff.get('/api/auth/me');
    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe('ACCESS_DENIED');

    const putRes = await staff.put('/api/auth/me').send({
      name: 'Staff Updated',
      phone: '9876543211',
    });
    expect(putRes.status).toBe(403);
    expect(putRes.body.error.code).toBe('ACCESS_DENIED');
  });

  it('Admin cannot access GET or PUT /api/auth/me (403 ACCESS_DENIED)', async () => {
    const admin = await loginAs(ADMIN_EMAIL);
    const getRes = await admin.get('/api/auth/me');
    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe('ACCESS_DENIED');

    const putRes = await admin.put('/api/auth/me').send({
      name: 'Admin Updated',
      phone: '9876543210',
    });
    expect(putRes.status).toBe(403);
    expect(putRes.body.error.code).toBe('ACCESS_DENIED');
  });

  it('unauthenticated GET /api/auth/me returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('writes PROFILE_UPDATED to audit_log with masked phone (NFR-SEC-07)', async () => {
    const donor = await loginAs(DONOR_EMAIL);
    await pool.query(
      'DELETE FROM audit_log WHERE user_id = $1 AND action = $2',
      [DONOR_ID, 'PROFILE_UPDATED']
    );

    const res = await donor.put('/api/auth/me').send({
      name: 'John Doe Updated',
      phone: '9876543212',
      address: '12 MG Road, Bangalore',
    });
    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT new_value FROM audit_log
        WHERE user_id = $1 AND action = 'PROFILE_UPDATED'
        ORDER BY created_at DESC LIMIT 1`,
      [DONOR_ID]
    );
    expect(rows).toHaveLength(1);
    // Phone is masked: only last four digits visible.
    expect(rows[0].new_value.phone_masked).toBe('***3212');
    // Raw phone must not appear in new_value.
    expect(JSON.stringify(rows[0].new_value)).not.toContain('9876543212');
  });
});