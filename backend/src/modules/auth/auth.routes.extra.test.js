// src/modules/auth/auth.routes.extra.test.js
const request = require('supertest');
const app = require('../../app');

describe('auth.routes extra coverage', () => {
  it('GET /api/auth/csrf returns a token string', async () => {
    const res = await request(app).get('/api/auth/csrf');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('csrfToken');
  });

  it('GET /api/auth/me returns 401 with no session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('PUT /api/auth/me returns 401 with no session', async () => {
    const res = await request(app)
      .put('/api/auth/me')
      .send({ name: 'X', phone: '1234567890' });
    expect(res.status).toBe(401);
  });

  it('PUT /api/auth/me rejects a missing name', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/__dev-session').send({ role: 'Donor' });
    const res = await agent.put('/api/auth/me').send({ phone: '1234567890' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/forgot-password rejects a malformed email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/reset-password rejects a bad password shape', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'abc', newPassword: 'weak' });
    expect(res.status).toBe(400);
  });

  it('GET /api/auth/staff-only rejects a Donor session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/__dev-session').send({ role: 'Donor' });
    const res = await agent.get('/api/auth/staff-only');
    expect(res.status).toBe(403);
  });

  it('GET /api/auth/staff-only allows Staff', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/__dev-session').send({ role: 'Staff' });
    const res = await agent.get('/api/auth/staff-only');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/auth/demo-validate rejects invalid bloodGroup', async () => {
    const res = await request(app)
      .post('/api/auth/demo-validate')
      .send({ phone: '1234567890', bloodGroup: 'Z+', name: 'Alice' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/logout returns 401 without session', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/__dev-session rejects an unknown role', async () => {
    const res = await request(app)
      .post('/api/auth/__dev-session')
      .send({ role: 'Wizard' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});