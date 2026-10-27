// C11 Report Service — Routes (SAD 3.4, 4.3 /api/reports)
// Endpoints:
// - GET /api/reports/stock?from=&to=&bloodGroup=&status= (Staff, Admin) — FR-RPT-01, 04, 06, TC-10
// - GET /api/reports/donation?from=&to=&bloodGroup=&status= (Staff, Admin) — FR-RPT-02, 04, 06
// - GET /api/reports/request?from=&to=&bloodGroup=&status= (Staff, Admin) — FR-RPT-03, 04, 06, TC-32
// Unauthorized roles receive 403 ACCESS_DENIED per FR-RPT-06 & TC-09.

const router = require('express').Router();
const { query: queryValidator } = require('express-validator');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const reportsService = require('./reports.service');

// SAD 4.4 error handler for ReportError
function handleReportError(err, req, res, next) {
  if (err instanceof reportsService.ReportError) {
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

// Common filter validations
const reportFilterValidators = [
  queryValidator('from')
    .optional()
    .isISO8601()
    .withMessage('from date must be valid ISO8601 date (YYYY-MM-DD)'),
  queryValidator('to')
    .optional()
    .isISO8601()
    .withMessage('to date must be valid ISO8601 date (YYYY-MM-DD)'),
  queryValidator('bloodGroup')
    .optional()
    .isIn(reportsService.VALID_BLOOD_GROUPS)
    .withMessage('Invalid blood group filter'),
  queryValidator('status')
    .optional()
    .trim(),
];

// GET /api/reports/stock
router.get(
  '/stock',
  requireRole('Staff', 'Admin'),
  validate(reportFilterValidators),
  async (req, res, next) => {
    try {
      const report = await reportsService.generateStockReport(req.query);
      return res.status(200).json(report);
    } catch (err) {
      return handleReportError(err, req, res, next);
    }
  }
);

// GET /api/reports/donation
router.get(
  '/donation',
  requireRole('Staff', 'Admin'),
  validate(reportFilterValidators),
  async (req, res, next) => {
    try {
      const report = await reportsService.generateDonationReport(req.query);
      return res.status(200).json(report);
    } catch (err) {
      return handleReportError(err, req, res, next);
    }
  }
);

// GET /api/reports/request
router.get(
  '/request',
  requireRole('Staff', 'Admin'),
  validate(reportFilterValidators),
  async (req, res, next) => {
    try {
      const report = await reportsService.generateRequestReport(req.query);
      return res.status(200).json(report);
    } catch (err) {
      return handleReportError(err, req, res, next);
    }
  }
);

module.exports = router;
