// src/modules/search/search.routes.test.js
const request = require('supertest');
const app = require('../../app');
const db = require('../../database/db');
const searchService = require('./search.service');

async function loginAs(role) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/__dev-session').send({ role });
  if (res.status !== 200) throw new Error(`dev-session failed for ${role}: ${res.status}`);
  return agent;
}

beforeEach(() => jest.restoreAllMocks());

describe('GET /api/search/*', () => {
  // ── /stock RBAC + validation ───────────────────────────────────────
  it('returns 401 without session', async () => {
    const res = await request(app).get('/api/search/stock?bloodGroup=O%2B');
    expect([401, 403]).toContain(res.status);
  });

  it('rejects Donor (403)', async () => {
    const agent = await loginAs('Donor');
    const res = await agent.get('/api/search/stock?bloodGroup=O%2B');
    expect(res.status).toBe(403);
  });

  it('requires bloodGroup (400)', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/search/stock');
    expect(res.status).toBe(400);
  });

  it('rejects invalid bloodGroup (400)', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/search/stock?bloodGroup=Z%2B');
    expect(res.status).toBe(400);
  });

  it('returns 200 with data for Hospital/Patient', async () => {
    const agent = await loginAs('Hospital/Patient');
    jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
    const res = await agent.get('/api/search/stock?bloodGroup=O%2B');
    expect(res.status).toBe(200);
  });

  it('returns 200 for Staff', async () => {
    const agent = await loginAs('Staff');
    jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
    const res = await agent.get('/api/search/stock?bloodGroup=A%2B');
    expect(res.status).toBe(200);
  });

  // ── /stock ERROR path (covers handleSearchError + catch) ───────────
  it('returns mapped status when searchService throws SearchError', async () => {
    const agent = await loginAs('Staff');
    const err = new searchService.SearchError(
      'INVALID_QUERY',
      'Bad filter',
      422
    );
    jest.spyOn(searchService, 'searchStock').mockRejectedValueOnce(err);
    const res = await agent.get('/api/search/stock?bloodGroup=O%2B');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });

  it('passes non-SearchError to next() → 500 via default handler', async () => {
    const agent = await loginAs('Staff');
    jest.spyOn(searchService, 'searchStock').mockRejectedValueOnce(new Error('boom'));
    const res = await agent.get('/api/search/stock?bloodGroup=O%2B');
    // With the real errorHandler, unexpected errors become 500.
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  // ── /donors RBAC + validation ──────────────────────────────────────
  it('/donors rejects Donor (403)', async () => {
    const agent = await loginAs('Donor');
    const res = await agent.get('/api/search/donors');
    expect(res.status).toBe(403);
  });

  it('/donors rejects Hospital/Patient (403)', async () => {
    const agent = await loginAs('Hospital/Patient');
    const res = await agent.get('/api/search/donors');
    expect(res.status).toBe(403);
  });

  it('/donors allows Staff and returns data', async () => {
    const agent = await loginAs('Staff');
    jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
    const res = await agent.get('/api/search/donors');
    expect(res.status).toBe(200);
  });

  it('/donors rejects invalid bloodGroup filter (400)', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/search/donors?bloodGroup=Z%2B');
    expect(res.status).toBe(400);
  });

  it('/donors rejects page=0 (400)', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/search/donors?page=0');
    expect(res.status).toBe(400);
  });

  it('/donors rejects limit>100 (400)', async () => {
    const agent = await loginAs('Staff');
    const res = await agent.get('/api/search/donors?limit=500');
    expect(res.status).toBe(400);
  });

  it('/donors accepts valid filters', async () => {
    const agent = await loginAs('Staff');
    jest.spyOn(db, 'query').mockResolvedValue({ rows: [] });
    const res = await agent.get(
      '/api/search/donors?bloodGroup=O%2B&city=Pune&pin=411001&page=1&limit=20'
    );
    expect(res.status).toBe(200);
  });

  // ── /donors ERROR path ─────────────────────────────────────────────
  it('/donors returns mapped status on SearchError', async () => {
    const agent = await loginAs('Staff');
    const err = new searchService.SearchError('PAGE_TOO_HIGH', 'Page too high', 422);
    jest.spyOn(searchService, 'searchDonors').mockRejectedValueOnce(err);
    const res = await agent.get('/api/search/donors?page=999');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAGE_TOO_HIGH');
  });

  it('/donors passes non-SearchError to next()', async () => {
    const agent = await loginAs('Staff');
    jest.spyOn(searchService, 'searchDonors').mockRejectedValueOnce(new Error('kaboom'));
    const res = await agent.get('/api/search/donors');
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});