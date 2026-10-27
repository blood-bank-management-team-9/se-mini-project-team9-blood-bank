// RBAC and validation boundary for /api/stock (NFR-SEC-02, NFR-SEC-05). No database needed.
const request = require('supertest');
const app = require('../../app');

describe('Stock API authentication boundary', () => {
  it.each([
    ['get', '/api/stock/summary'],
    ['get', '/api/stock/units'],
  ])('%s %s requires authentication', async (method, url) => {
    const res = await request(app)[method](url).send({ reason: 'Leakage' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});