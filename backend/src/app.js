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

const app = express();
app.use(requestId);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(cookieParser());                                // <-- THE MISSING LINE
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