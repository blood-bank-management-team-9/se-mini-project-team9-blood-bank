// STP TC-30: request submission, owner-scoped tracking, and pending cancellation.
const request = require('supertest');
const app = require('../../app');
const db = require('../../database/db');

const hasDatabase = Boolean(
  process.env.DATABASE_URL ||
  (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER)
);
const describeIfDb = hasDatabase ? describe : describe.skip;

const HOSPITAL_EMAIL = 'hospital@citygen.org';
const PASSWORD = 'Test@1234';

async function loginAsHospital() {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/login')
    .send({ email: HOSPITAL_EMAIL, password: PASSWORD });
  if (response.status !== 200) {
    throw new Error(`Hospital login failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return agent;
}

async function loginAsStaff() {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/login')
    .send({ email: 'staff@bloodbank.org', password: PASSWORD });
  if (response.status !== 200) {
    throw new Error(`Staff login failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return agent;
}

function futureDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}

describeIfDb('Request API (FR-REQ-01/02/03/08, BR-02, TC-30)', () => {
  let hospital;
  let staff;
  const createdRequestIds = [];
  const createdUnitIds = [];

  beforeAll(async () => {
    hospital = await loginAsHospital();
    staff = await loginAsStaff();
  }, 30000);

  afterAll(async () => {
    if (createdRequestIds.length) {
      await db.query(
        `DELETE FROM audit_log
          WHERE entity = 'blood_requests' AND entity_id = ANY($1)`,
        [createdRequestIds]
      );
      await db.query('DELETE FROM blood_requests WHERE request_id = ANY($1)', [createdRequestIds]);
    }
    if (createdUnitIds.length) {
      await db.query('DELETE FROM blood_units WHERE unit_id = ANY($1)', [createdUnitIds]);
    }
  });

  it('submits, tracks, and cancels its own pending request', async () => {
    const body = {
      patientName: 'TC-30 Test Patient',
      bloodGroup: 'O+',
      units: 2,
      requiredByDate: futureDate(),
      hospitalName: 'TC-30 Test Hospital',
      contactNumber: '9876543213',
      priority: 'Urgent',
    };

    const created = await hospital.post('/api/requests').send(body);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      requestId: expect.stringMatching(/^REQ-\d{8}$/),
      patientName: body.patientName,
      bloodGroup: body.bloodGroup,
      units: body.units,
      requiredByDate: body.requiredByDate,
      priority: body.priority,
      status: 'Pending',
    });
    createdRequestIds.push(created.body.requestId);

    const history = await hospital.get('/api/requests/mine');
    expect(history.status).toBe(200);
    expect(history.body.requests.some(({ requestId }) => requestId === created.body.requestId)).toBe(true);

    const cancelled = await hospital.patch(`/api/requests/${created.body.requestId}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('Cancelled');

    const repeatedCancellation = await hospital.patch(`/api/requests/${created.body.requestId}/cancel`);
    expect(repeatedCancellation.status).toBe(409);
    expect(repeatedCancellation.body.error.code).toBe('REQUEST_NOT_CANCELLABLE');
  });

  it('rejects a past required-by date', async () => {
    const response = await hospital.post('/api/requests').send({
      patientName: 'Past Date Patient',
      bloodGroup: 'A+',
      units: 1,
      requiredByDate: '2000-01-01',
      hospitalName: 'TC-30 Test Hospital',
      contactNumber: '9876543213',
      priority: 'Normal',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('orders urgent requests first, reserves FEFO stock, rejects, and issues only after group confirmation', async () => {
    const donation = await db.query(
      "SELECT donation_id FROM donations WHERE blood_group = 'O+' ORDER BY donation_id LIMIT 1"
    );
    if (!donation.rows.length) throw new Error('TC-31 requires an existing O+ donation for test units');

    const suffix = String(Math.floor(100000 + Math.random() * 800000));
    const unitIds = [`UNT-97${suffix}`, `UNT-97${String(Number(suffix) + 1).padStart(6, '0')}`];
    createdUnitIds.push(...unitIds);
    await db.query(
      `INSERT INTO blood_units
         (unit_id, donation_id, blood_group, volume_ml, collection_date, expiry_date, status)
       VALUES
         ($1, $3, 'O+', 450, CURRENT_DATE, CURRENT_DATE + 2, 'Available'),
         ($2, $3, 'O+', 450, CURRENT_DATE, CURRENT_DATE + 1, 'Available')`,
      [...unitIds, donation.rows[0].donation_id]
    );

    const common = {
      patientName: 'TC-31 Test Patient',
      bloodGroup: 'O+',
      units: 2,
      requiredByDate: futureDate(),
      hospitalName: 'TC-31 Test Hospital',
      contactNumber: '9876543213',
    };
    const normal = await hospital.post('/api/requests').send({ ...common, priority: 'Normal', units: 1 });
    const urgent = await hospital.post('/api/requests').send({ ...common, priority: 'Urgent' });
    expect(normal.status).toBe(201);
    expect(urgent.status).toBe(201);
    createdRequestIds.push(normal.body.requestId, urgent.body.requestId);

    const queue = await staff.get('/api/requests/pending');
    expect(queue.status).toBe(200);
    const urgentIndex = queue.body.requests.findIndex(({ requestId }) => requestId === urgent.body.requestId);
    const normalIndex = queue.body.requests.findIndex(({ requestId }) => requestId === normal.body.requestId);
    expect(urgentIndex).toBeGreaterThanOrEqual(0);
    expect(normalIndex).toBeGreaterThan(urgentIndex);

    const approval = await staff.patch(`/api/requests/${urgent.body.requestId}/approve`);
    expect(approval.status).toBe(200);
    expect(approval.body.status).toBe('Approved');
    expect(approval.body.reservedUnitIds).toEqual([unitIds[1], unitIds[0]]);
    const reserved = await db.query(
      'SELECT unit_id, status FROM blood_units WHERE unit_id = ANY($1) ORDER BY unit_id',
      [unitIds]
    );
    expect(reserved.rows).toHaveLength(2);
    expect(reserved.rows.every(({ status }) => status === 'Reserved')).toBe(true);

    const mismatch = await staff.patch(`/api/requests/${urgent.body.requestId}/issue`)
      .send({ recipientBloodGroup: 'A+', confirmMatch: true });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error.code).toBe('BLOOD_GROUP_MISMATCH');

    const issue = await staff.patch(`/api/requests/${urgent.body.requestId}/issue`)
      .send({ recipientBloodGroup: 'O+', confirmMatch: true });
    expect(issue.status).toBe(200);
    expect(issue.body.status).toBe('Issued');
    expect(issue.body.issuedUnitIds).toEqual([unitIds[1], unitIds[0]]);

    const rejected = await staff.patch(`/api/requests/${normal.body.requestId}/reject`)
      .send({ reason: 'TC-31 test rejection' });
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({
      status: 'Rejected',
      rejectionReason: 'TC-31 test rejection',
    });
  });
});
