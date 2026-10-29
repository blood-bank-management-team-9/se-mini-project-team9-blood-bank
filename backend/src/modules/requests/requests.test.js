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

function futureDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}

describeIfDb('Request API (FR-REQ-01/02/03/08, BR-02, TC-30)', () => {
  let hospital;
  const createdRequestIds = [];

  beforeAll(async () => {
    hospital = await loginAsHospital();
  });

  afterAll(async () => {
    if (createdRequestIds.length) {
      await db.query(
        `DELETE FROM audit_log
          WHERE entity = 'blood_requests' AND entity_id = ANY($1)`,
        [createdRequestIds]
      );
      await db.query('DELETE FROM blood_requests WHERE request_id = ANY($1)', [createdRequestIds]);
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
});
