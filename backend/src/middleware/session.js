// NFR-SEC-04: 15-minute idle expiry, HttpOnly + Secure cookie, PostgreSQL-backed store.
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { pool } = require('../database/db');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const sessionMiddleware = session({
  name: 'bbms.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-change-me',
  resave: false,
  saveUninitialized: false,
  rolling: true, // refresh cookie on each request -> 15 min of *inactivity* expires
  store: new PgSession({
    pool,
    tableName: 'sessions',
    createTableIfMissing: false, // table already exists in schema.sql
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: FIFTEEN_MINUTES_MS,
  },
});

module.exports = sessionMiddleware;
module.exports.FIFTEEN_MINUTES_MS = FIFTEEN_MINUTES_MS;