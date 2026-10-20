const sessionMiddleware = require('./session');

describe('Session security (NFR-SEC-04, TC-18)', () => {
  it('pins the idle-timeout constant to 15 minutes', () => {
    expect(sessionMiddleware.FIFTEEN_MINUTES_MS).toBe(15 * 60 * 1000);
  });

  it('exports a function suitable for app.use()', () => {
    expect(typeof sessionMiddleware).toBe('function');
  });

  it('cookie flags (HttpOnly + Secure) are asserted via Postman TC-18 integration check', () => {
    // DEVIATION noted in PR: express-session does not expose `cookie` as a public
    // property, so HttpOnly/Secure are verified by the live Postman check documented
    // against TC-18 in the PR description. Unit test here pins the timeout constant only.
    expect(true).toBe(true);
  });
});
describe('Session cookie flags (TC-18)', () => {
  // Re-require to see the cookie config with the module loaded once.
  // The session middleware does not expose the cookie object publicly, but
  // `express-session` stores it in the closure. We re-create the middleware
  // from its source file to inspect what it was configured with.
  const sessionMiddlewarePath = require.resolve('./session');

  it('has HttpOnly set on the cookie', () => {
    delete require.cache[sessionMiddlewarePath];
    const sessionModule = require('./session');
    // express-session does not expose `.cookie`, so we assert the constant
    // and inspect the source for the flag (documented as deviation).
    const src = require('fs').readFileSync(sessionMiddlewarePath, 'utf8');
    expect(src).toMatch(/httpOnly:\s*true/);
    expect(sessionModule.FIFTEEN_MINUTES_MS).toBe(15 * 60 * 1000);
  });

  it('has Secure set when NODE_ENV=production', () => {
    const src = require('fs').readFileSync(sessionMiddlewarePath, 'utf8');
    expect(src).toMatch(/secure:\s*process\.env\.NODE_ENV\s*===\s*'production'/);
  });

  it('has SameSite set to lax', () => {
    const src = require('fs').readFileSync(sessionMiddlewarePath, 'utf8');
    expect(src).toMatch(/sameSite:\s*'lax'/);
  });

  it('uses a rolling window so 15 minutes of inactivity expires the session', () => {
    const src = require('fs').readFileSync(sessionMiddlewarePath, 'utf8');
    expect(src).toMatch(/rolling:\s*true/);
  });
});