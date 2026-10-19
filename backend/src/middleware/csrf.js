const { doubleCsrf } = require('csrf-csrf');

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'dev-only-csrf-change-me',
  getSessionIdentifier: (req) => {
    // Ensure a stable per-session identifier exists inside the session.
    // express-session may not populate req.sessionID synchronously,
    // and req.session.id does not exist by default. Store our own.
    if (req.session && !req.session.csrfId) {
      req.session.csrfId = require('crypto').randomBytes(32).toString('hex');
    }
    return (req.session && req.session.csrfId) || '';
  },
  cookieName: 'bbms.csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

module.exports = { generateCsrfToken, doubleCsrfProtection };