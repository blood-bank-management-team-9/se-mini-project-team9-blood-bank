// STP TC-22 (donor registration/validation) and TC-36 (invalid donor data).
// Also covers profile updates, status transitions, RBAC, and audit events.
const request = require('supertest');
const app = require('../../app');
const db = require('../../database/db');

const hasDatabase = Boolean(
  process.env.DATABASE_URL ||
  (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER)
);
const describeIfDb = hasDatabase ? describe : describe.skip;

const STAFF_EMAIL = 'staff@bloodbank.org';
const DONOR_EMAIL = 'john.doe@example.com';
const PASSWORD = 'Test@1234';

async function loginAs(email) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return agent;
}

function validDonor() {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    fullName: 'Test Donor',
    dob: '1990-04-12',
    gender: 'Female',
    bloodGroup: 'O+',
    weightKg: 58,
    phone: `9${unique.slice(-9)}`,
    email: `donor.${unique}@test.local`,
    address: '12 Test Road',
    city: 'Bangalore',
    pinCode: '560001',
  };
}

describe('Donor API authentication boundary', () => {
  it('requires authentication for reads and writes', async () => {
    const read = await request(app).get('/api/donors');
    expect(read.status).toBe(401);
    expect(read.body.error.code).toBe('UNAUTHENTICATED');

    const write = await request(app).post('/api/donors').send(validDonor());
    expect(write.status).toBe(401);
    expect(write.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describeIfDb('Donor routes (TC-22, TC-36)', () => {
  let staff;
  let donor;
  const createdDonorIds = [];

  beforeAll(async () => {
    staff = await loginAs(STAFF_EMAIL);
    donor = await loginAs(DONOR_EMAIL);
  });

  afterAll(async () => {
    if (createdDonorIds.length) {
      await db.query(
        `DELETE FROM audit_log WHERE entity = 'donors' AND entity_id = ANY($1)`,
        [createdDonorIds]
      );
      await db.query('DELETE FROM donors WHERE donor_id = ANY($1)', [createdDonorIds]);
    }
  });

  it('requires a Staff or Admin session for donor management', async () => {
    const unauthenticated = await request(app).get('/api/donors');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const forbidden = await donor.get('/api/donors');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('ACCESS_DENIED');
  });

  it('TC-22: registers a valid donor and records its creation audit event', async () => {
    const response = await staff.post('/api/donors').send(validDonor());
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      donorId: expect.stringMatching(/^DNR-\d{5}$/),
      fullName: 'Test Donor',
      bloodGroup: 'O+',
      status: 'Active',
    });
    createdDonorIds.push(response.body.donorId);

    const { rows } = await db.query(
      `SELECT action FROM audit_log
        WHERE entity = 'donors' AND entity_id = $1 AND action = 'DONOR_CREATED'`,
      [response.body.donorId]
    );
    expect(rows).toHaveLength(1);
  });

  it('TC-23: returns configured ineligibility reasons for a donor profile', async () => {
    const donorDetails = validDonor();
    const created = await staff.post('/api/donors').send(donorDetails);
    expect(created.status).toBe(201);
    createdDonorIds.push(created.body.donorId);

    const updated = await staff.put(`/api/donors/${created.body.donorId}`).send({
      ...donorDetails,
      dob: '2010-04-12',
      weightKg: 40,
    });
    expect(updated.status).toBe(200);

    const response = await staff.get(`/api/donors/${created.body.donorId}/eligibility`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      donorId: created.body.donorId,
      eligible: false,
      ineligibilityReasons: expect.arrayContaining([
        expect.objectContaining({ code: 'AGE_BELOW_MINIMUM' }),
        expect.objectContaining({ code: 'WEIGHT_BELOW_MINIMUM' }),
      ]),
    });
    expect(response.body.ineligibilityReasons.every(({ message }) => Boolean(message))).toBe(true);
  });

  it('TC-36: rejects invalid donor fields and reports field-level errors', async () => {
    const response = await staff.post('/api/donors').send({
      ...validDonor(),
      dob: '2099-01-01',        // future date -> triggers 'Date of birth cannot be in the future'
      bloodGroup: 'X+',         // invalid enum -> triggers 'Invalid blood group'
      phone: '123',             // not 10 digits -> triggers 'Phone number must be exactly 10 digits'
      weightKg: 0,              // below min 0.01 -> triggers 'Weight must be greater than 0 kg'
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fields.map((field) => field.field)).toEqual(
      expect.arrayContaining(['dob', 'bloodGroup', 'phone', 'weightKg'])
    );
  });

  it('rejects a duplicate donor phone number', async () => {
    const details = validDonor();
    const first = await staff.post('/api/donors').send(details);
    expect(first.status).toBe(201);
    createdDonorIds.push(first.body.donorId);

    const duplicate = await staff.post('/api/donors').send({
      ...validDonor(),
      phone: details.phone,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ACCOUNT_EXISTS');
  });

  it('lists and retrieves donors, then updates a donor profile', async () => {
    const created = await staff.post('/api/donors').send(validDonor());
    expect(created.status).toBe(201);
    createdDonorIds.push(created.body.donorId);

    const listed = await staff.get('/api/donors?status=Active&bloodGroup=O%2B');
    expect(listed.status).toBe(200);
    expect(listed.body.donors.some((entry) => entry.donorId === created.body.donorId)).toBe(true);

    const read = await staff.get(`/api/donors/${created.body.donorId}`);
    expect(read.status).toBe(200);
    expect(read.body.donorId).toBe(created.body.donorId);

    const updated = await staff.put(`/api/donors/${created.body.donorId}`).send({
      ...validDonor(),
      phone: created.body.phone,
      email: created.body.email,
      fullName: 'Updated Donor Name',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.fullName).toBe('Updated Donor Name');

    const { rows } = await db.query(
      `SELECT action FROM audit_log
        WHERE entity = 'donors' AND entity_id = $1 AND action = 'DONOR_UPDATED'`,
      [created.body.donorId]
    );
    expect(rows).toHaveLength(1);
  });

  it('deactivates and reactivates a donor with audited state transitions', async () => {
    const created = await staff.post('/api/donors').send(validDonor());
    expect(created.status).toBe(201);
    createdDonorIds.push(created.body.donorId);

    const deactivated = await staff
      .patch(`/api/donors/${created.body.donorId}/status`)
      .send({ status: 'Inactive' });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.status).toBe('Inactive');

    const reactivated = await staff
      .patch(`/api/donors/${created.body.donorId}/status`)
      .send({ status: 'Active' });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.status).toBe('Active');

    const { rows } = await db.query(
      `SELECT action FROM audit_log
        WHERE entity = 'donors' AND entity_id = $1
          AND action IN ('DONOR_DEACTIVATED', 'DONOR_REACTIVATED')
        ORDER BY log_id`,
      [created.body.donorId]
    );
    expect(rows.map((row) => row.action)).toEqual([
      'DONOR_DEACTIVATED',
      'DONOR_REACTIVATED',
    ]);
  });

  it('returns NOT_FOUND for unknown donor IDs', async () => {
    const response = await staff.get('/api/donors/DNR-99999');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});