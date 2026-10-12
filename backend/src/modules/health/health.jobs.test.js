const request = require('supertest');
const app = require('../../app');
const jobStatus = require('../../scheduler/jobStatus');

it('GET /api/health reports the last job runs for monitoring (SAD 4.4)', async () => {
  jobStatus.reset();
  jobStatus.record('expiry', { ok: true, expired: 2 });
  const res = await request(app).get('/api/health');
  expect(res.body.jobs.expiry).toMatchObject({ ok: true, expired: 2 });
  expect(res.body.jobs.backup).toBeNull();
});
