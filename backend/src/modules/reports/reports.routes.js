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

// Common filter validations (strict YYYY-MM-DD format as in PR #56)
const commonValidators = [
  queryValidator('from')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('from date must be in YYYY-MM-DD format'),
  queryValidator('to')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('to date must be in YYYY-MM-DD format'),
  queryValidator('bloodGroup')
    .optional()
    .isIn(reportsService.VALID_BLOOD_GROUPS)
    .withMessage('Invalid blood group filter'),
];

// GET /api/reports/stock
router.get(
  '/stock',
  requireRole('Staff', 'Admin'),
  validate([
    ...commonValidators,
    queryValidator('status')
      .optional()
      .isIn(reportsService.STOCK_STATUSES)
      .withMessage(`Invalid status (allowed: ${reportsService.STOCK_STATUSES.join(', ')})`),
  ]),
  async (req, res, next) => {
    try {
      const actorUserId = req.session?.user?.userId;
      const report = await reportsService.generateStockReport(req.query, actorUserId);
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
  validate([
    ...commonValidators,
    queryValidator('status')
      .optional()
      .isIn(reportsService.DONATION_SCREENING_STATUSES)
      .withMessage(`Invalid status (allowed: ${reportsService.DONATION_SCREENING_STATUSES.join(', ')})`),
  ]),
  async (req, res, next) => {
    try {
      const actorUserId = req.session?.user?.userId;
      const report = await reportsService.generateDonationReport(req.query, actorUserId);
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
  validate([
    ...commonValidators,
    queryValidator('status')
      .optional()
      .isIn(reportsService.REQUEST_STATUSES)
      .withMessage(`Invalid status (allowed: ${reportsService.REQUEST_STATUSES.join(', ')})`),
  ]),
  async (req, res, next) => {
    try {
      const actorUserId = req.session?.user?.userId;
      const report = await reportsService.generateRequestReport(req.query, actorUserId);
      return res.status(200).json(report);
    } catch (err) {
      return handleReportError(err, req, res, next);
    }
  }
);

// GET /api/reports/:type/export?format=csv|pdf
// FR-RPT-05, TC-10: CSV and PDF export
router.get(
  '/:type/export',
  requireRole('Staff', 'Admin'),
  validate([
    queryValidator('format')
      .optional()
      .isIn(['csv', 'pdf', 'CSV', 'PDF'])
      .withMessage('Export format must be "csv" or "pdf"'),
    ...commonValidators,
  ]),
  async (req, res, next) => {
    try {
      const { type } = req.params;
      const format = req.query.format || 'csv';
      const file = await reportsService.exportReport(type, format, req.query);

      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return res.status(200).send(file.data);
    } catch (err) {
      return handleReportError(err, req, res, next);
    }
  }
);

module.exports = router;
