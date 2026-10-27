const request = require('supertest');
const app = require('../../app');
const { pool } = require('../../database/db');

describe('GET /api/health (NFR-QUAL-02, TC-37)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await pool.end().catch(() => {});
  });

  it('returns 200 and healthy status when database is connected', async () => {
    jest.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('returns 503 and degraded status when database is unavailable', async () => {
    jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.database).toBe('unavailable');
  });
});

describe('unknown routes', () => {
  it('returns 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('Resource not found');
    expect(res.body.error.requestId).toBeDefined();
  });
});