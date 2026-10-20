// C5 Admin Service — routes (SAD 3.4, 4.3 /api/admin/users).
// All routes require the Admin role (BR-01). Non-admin → 403 ACCESS_DENIED
// via requireRole, and the attempt is written to audit_log by the RBAC middleware.

const router = require('express').Router();
const { body, query: queryValidator } = require('express-validator');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const adminService = require('./admin.service');

const VALID_ROLES = ['Donor', 'Hospital/Patient', 'Staff', 'Admin'];
const VALID_STATUSES = ['Active', 'Inactive'];

// Map an AdminError to the SAD 4.4 error body. Unknown errors fall through.
function handleAdminError(err, req, res, next) {
  if (err instanceof adminService.AdminError) {
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

// POST /api/admin/users — create a Staff account (FR-ADM-01)
router.post(
  '/users',
  requireRole('Admin'),
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
    body('temporaryPassword')
      .isLength({ min: 8 })
      .withMessage('Temporary password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain a lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain a digit'),
  ]),
  async (req, res, next) => {
    try {
      const created = await adminService.createStaff(req.body);
      return res.status(201).json(created);
    } catch (err) {
      return handleAdminError(err, req, res, next);
    }
  }
);

// GET /api/admin/users — list/filter users (FR-ADM-02)
router.get(
  '/users',
  requireRole('Admin'),
  validate([
    queryValidator('role')
      .optional()
      .isIn(VALID_ROLES)
      .withMessage('Role must be Donor, Hospital/Patient, Staff or Admin'),
    queryValidator('status')
      .optional()
      .isIn(VALID_STATUSES)
      .withMessage('Status must be Active or Inactive'),
    queryValidator('q')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage('Search term too long'),
  ]),
  async (req, res, next) => {
    try {
      const result = await adminService.listUsers({
        role: req.query.role,
        status: req.query.status,
        q: req.query.q,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleAdminError(err, req, res, next);
    }
  }
);

// PATCH /api/admin/users/:id/status — activate/deactivate (FR-ADM-03, FR-ADM-06)
router.patch(
  '/users/:id/status',
  requireRole('Admin'),
  validate([
    body('status')
      .isIn(VALID_STATUSES)
      .withMessage('Status must be Active or Inactive'),
  ]),
  async (req, res, next) => {
    try {
      const updated = await adminService.setStatus({
        adminUserId: req.session.user.userId,
        targetUserId: req.params.id,
        status: req.body.status,
      });
      return res.status(200).json(updated);
    } catch (err) {
      return handleAdminError(err, req, res, next);
    }
  }
);

// PATCH /api/admin/users/:id/role — assign role (FR-ADM-04, FR-ADM-06)
router.patch(
  '/users/:id/role',
  requireRole('Admin'),
  validate([
    body('role')
      .isIn(VALID_ROLES)
      .withMessage('Role must be Donor, Hospital/Patient, Staff or Admin'),
  ]),
  async (req, res, next) => {
    try {
      const updated = await adminService.setRole({
        adminUserId: req.session.user.userId,
        targetUserId: req.params.id,
        role: req.body.role,
      });
      return res.status(200).json(updated);
    } catch (err) {
      return handleAdminError(err, req, res, next);
    }
  }
);

// GET /api/admin/audit-logs — audit log viewer (FR-ADM-05)
router.get(
  '/audit-logs',
  requireRole('Admin'),
  async (req, res, next) => {
    try {
      const logs = await adminService.listAuditLogs({ limit: req.query.limit });
      return res.status(200).json({ logs });
    } catch (err) {
      return handleAdminError(err, req, res, next);
    }
  }
);

module.exports = router;