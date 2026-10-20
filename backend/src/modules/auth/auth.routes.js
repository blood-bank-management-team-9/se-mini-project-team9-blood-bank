// NFR-SEC-04 (session) + NFR-SEC-02 (RBAC) + NFR-SEC-05 (validation) â€” minimal proof routes.
const router = require('express').Router();
const { body } = require('express-validator');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { generateCsrfToken } = require('../../middleware/csrf');
const { query } = require('../../database/db');
const authService = require('./auth.service');

// Issues the CSRF token for the double-submit cookie pattern.
// Must be called once before any state-changing request.
router.get('/csrf', (req, res, next) => {
  try {
    // Force a session so csrf-csrf's getSessionIdentifier has a stable id.
    if (!req.session.csrfId) {
      req.session.csrfId = require('crypto').randomBytes(32).toString('hex');
    }
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
  } catch (err) {
    next(err);
  }
});

// Any logged-in user can read own session.
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Not logged in', requestId: req.id },
    });
  }
  return res.json({ user: req.session.user });
});

// Staff-only demo route â€” proves RBAC works end-to-end (TC-09 pattern).
router.get('/staff-only', requireRole('Staff'), (req, res) => {
  res.json({ ok: true, user: req.session.user });
});

// Validation demo â€” proves NFR-SEC-05 + parameterised query path.
router.post(
  '/demo-validate',
  validate([
    body('phone').isLength({ min: 10, max: 10 }).isNumeric(),
    body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    body('name').isLength({ min: 1, max: 60 }).trim().escape(),
  ]),
  (req, res) => res.json({ ok: true, received: req.body })
);

// TEST-ONLY: creates a session for a real user of the requested role.
// Guarded by NODE_ENV !== 'production'. Must be removed when real login lands.
if (process.env.NODE_ENV !== 'production') {
  router.post('/__dev-session', async (req, res, next) => {
    try {
      const role = req.body.role || 'Donor';
      if (!['Donor', 'Hospital/Patient', 'Staff', 'Admin'].includes(role)) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Unknown role: ${role}`,
            fields: [{ field: 'role', message: 'Must be one of the four roles' }],
            requestId: req.id,
          },
        });
      }
      const { rows } = await query(
        `SELECT user_id, name, role FROM users
         WHERE role = $1 AND status = 'Active'
         ORDER BY user_id LIMIT 1`,
        [role]
      );
      if (rows.length === 0) {
        return res.status(400).json({
          error: {
            code: 'NO_ACTIVE_USER',
            message: `No active ${role} user exists. Run: npm run db:seed --prefix backend`,
            requestId: req.id,
          },
        });
      }
      req.session.user = {
        userId: rows[0].user_id,
        role: rows[0].role,
        name: rows[0].name,
      };
      req.session.save((err) => {
        if (err) return next(err);
        return res.json({ ok: true, user: req.session.user });
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/__dev-logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });
}
// POST /api/auth/register â€” SAD 4.3, FR-AUTH-01, FR-AUTH-02, NFR-SEC-01
router.post(
  '/register',
  validate([
    body('name')
      .isLength({ min: 1, max: 60 })
      .withMessage('Name is required (1-60 characters)')
      .trim()
      .escape(),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .isLength({ max: 60 })
      .normalizeEmail(),
    body('phone')
      .isLength({ min: 10, max: 10 })
      .withMessage('Phone must be exactly 10 digits')
      .isNumeric()
      .withMessage('Phone must contain only digits'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain a lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain a digit'),
    body('role')
      .isIn(['Donor', 'Hospital/Patient'])
      .withMessage('Role must be Donor or Hospital/Patient'),
  ]),
  async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      return res.status(201).json(result);
    } catch (err) {
      if (err instanceof authService.AuthError) {
        return res.status(err.status).json({
          error: {
            code: err.code,
            message: err.publicMessage,
            requestId: req.id,
          },
        });
      }
      return next(err);
    }
  }
);
// POST /api/auth/login â€” SAD 4.3, SD-1, FR-AUTH-03, FR-AUTH-04
router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isString().isLength({ min: 1 }).withMessage('Password is required'),
  ]),
  async (req, res, next) => {
    try {
      const result = await authService.login({
        email: req.body.email,
        password: req.body.password,
        session: req.session,
      });
      // Persist the session before responding so the cookie is set.
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return res.status(200).json(result);
      });
    } catch (err) {
      if (err instanceof authService.AuthError) {
        return res.status(err.status).json({
          error: {
            code: err.code,
            message: err.publicMessage,
            ...err.extra, // includes { minutesLeft } on 423
            requestId: req.id,
          },
        });
      }
      return next(err);
    }
  }
);

// POST /api/auth/logout â€” FR-AUTH-07
router.post('/logout', (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Not logged in',
        requestId: req.id,
      },
    });
  }
  authService
    .logout(req.session)
    .then(() => {
      res.clearCookie('bbms.sid');
      return res.status(200).json({ message: 'Logged out' });
    })
    .catch(next);
});
module.exports = router;