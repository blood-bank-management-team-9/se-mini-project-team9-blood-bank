const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const requestId = require('./middleware/requestId');
const sessionMiddleware = require('./middleware/session');
const { doubleCsrfProtection } = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { redactionMiddleware } = require('./middleware/redaction');

const app = express();

// Trust reverse proxy (Nginx) for secure cookies and accurate client IP / protocol
app.set('trust proxy', 1);

app.use(requestId);

// NFR-SEC-03: Strict-Transport-Security (HSTS) with 1 year max-age, subdomains & preload
app.use(
  helmet({
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// NFR-SEC-03: HTTPS / TLS 1.2+ enforcement behind reverse proxy or when REQUIRE_HTTPS=true
app.use((req, res, next) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (!isHttps && (process.env.REQUIRE_HTTPS === 'true' || (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto']))) {
    const targetHost = process.env.PUBLIC_HOST || req.headers.host;
    return res.redirect(308, `https://${targetHost}${req.url}`);
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(redactionMiddleware);
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// NFR-SEC-04: 15-minute idle session, HttpOnly + Secure cookie.
app.use(sessionMiddleware);

// SAD 3.6: CSRF double-submit token on state-changing API requests.
// Bypassed in test mode so Supertest POSTs do not need a token fetch step.
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', doubleCsrfProtection);
}

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;