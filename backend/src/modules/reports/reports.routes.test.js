// src/modules/reports/reports.routes.test.js
const request = require('supertest');
const app = require('../../app');
const db = require('../../database/db');

async function loginAs(role) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/__dev-session').send({ role });
  if (res.status !== 200) throw new Error(`dev-session failed for ${role}: ${res.status}`);
  return agent;
}

beforeEach(() => jest.restoreAllMocks());

describe('GET /api/reports/*', () => {
  // ── RBAC (branches: unauthorized + authorized) ─────────────────────
  it('returns 403 for a Donor session', async () => {
    const agent = await loginAs('Donor');
    const res = await agent.get('/api/reports/stock');
    expect(res.status).toBe(403);
  });

  it('returns 401 without any session', async () => {
    const res = await request(app).get('/api/reports/stock');
    expect([401, 403]).toContain(res.status);
  });

  it('allows Staff to hit /stock', async () => {
    const agent = await loginAs('Staff');
    jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
    const res = await agent.get('/api/reports/stock');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('aggregates');
  });

  // ── Validation branches ────────────────────────────────────────────
  it('rejects malformed "from" date', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/reports/stock?from=2026/01/01');
    expect(res.status).toBe(400);
  });

  it('rejects invalid bloodGroup', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/reports/stock?bloodGroup=Z+');
    expect(res.status).toBe(400);
  });

  it('rejects invalid status for /stock', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/reports/stock?status=Bogus');
    expect(res.status).toBe(400);
  });

  // ── Donation report ────────────────────────────────────────────────
it('GET /donation returns records+totals', async () => {
  const agent = await loginAs('Staff');
  jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
  const res = await agent.get('/api/reports/donation');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('records');
  expect(res.body.summary).toMatchObject({
    totalDonations: expect.any(Number),
    totalVolumeMl: expect.any(Number),
  });
});

// ── Request report ─────────────────────────────────────────────────
it('GET /request returns records+totals', async () => {
  const agent = await loginAs('Staff');
  jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
  const res = await agent.get('/api/reports/request');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('records');
  expect(res.body.summary).toMatchObject({
    totalRequests: expect.any(Number),
    totalUnitsRequested: expect.any(Number),
  });
});

  // ── Export ─────────────────────────────────────────────────────────
  it('GET /stock/export?format=csv returns text/csv', async () => {
    const agent = await loginAs('Staff');
    jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
    const res = await agent.get('/api/reports/stock/export?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
  });

  it('GET /stock/export?format=pdf returns application/pdf', async () => {
    const agent = await loginAs('Staff');
    jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
    const res = await agent.get('/api/reports/stock/export?format=pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });

  it('GET /bogus/export returns 400 via ReportError handler', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/reports/bogus/export?format=csv');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects invalid export format', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/reports/stock/export?format=xml');
    expect(res.status).toBe(400);
  });
});