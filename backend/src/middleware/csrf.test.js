jest.mock('csrf-csrf', () => ({
  doubleCsrf: jest.fn((options) => {
    global.__testCsrfOptions = options;

    return {
      generateCsrfToken: jest.fn(),
      doubleCsrfProtection: jest.fn()
    };
  })
}));

const { doubleCsrf } = require('csrf-csrf');
const csrf = require('./csrf');

describe('CSRF middleware configuration', () => {
  afterEach(() => {
    delete process.env.CSRF_SECRET;
  });

  test('uses the default secret when no environment secret exists', () => {
    delete process.env.CSRF_SECRET;

    expect(global.__testCsrfOptions.getSecret())
      .toBe('dev-only-csrf-change-me');
  });

  test('uses the configured environment secret', () => {
    process.env.CSRF_SECRET = 'test-secret';

    expect(global.__testCsrfOptions.getSecret()).toBe('test-secret');
  });

  test('creates a session identifier when one is missing', () => {
    const session = {};

    const result = global.__testCsrfOptions.getSessionIdentifier({
      session
    });

    expect(session.csrfId).toBe(result);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  test('reuses an existing session identifier', () => {
    const session = { csrfId: 'existing-session-id' };

    const result = global.__testCsrfOptions.getSessionIdentifier({
      session
    });

    expect(result).toBe('existing-session-id');
  });

  test('returns an empty identifier when there is no session', () => {
    expect(
      global.__testCsrfOptions.getSessionIdentifier({})
    ).toBe('');
  });

  test('reads the CSRF token from the request header', () => {
    expect(
      global.__testCsrfOptions.getCsrfTokenFromRequest({
        headers: { 'x-csrf-token': 'test-token' }
      })
    ).toBe('test-token');
  });

  test('exports the CSRF functions returned by doubleCsrf', () => {
    expect(doubleCsrf).toHaveBeenCalled();
    expect(csrf.generateCsrfToken).toBeDefined();
    expect(csrf.doubleCsrfProtection).toBeDefined();
  });
});
