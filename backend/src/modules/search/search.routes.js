// C7 Search Service — Routes (SAD 3.4, 4.3 /api/search)
// Endpoints:
// - GET /api/search/stock (Hospital/Patient, Staff, Admin) — FR-SRCH-01, 02, 05, TC-12
// - GET /api/search/donors (Staff, Admin) — FR-SRCH-03, 04, 05, 06, TC-09, TC-26

const router = require('express').Router();
const { query: queryValidator } = require('express-validator');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const searchService = require('./search.service');

// SAD 4.4 error handler for SearchError
function handleSearchError(err, req, res, next) {
  if (err instanceof searchService.SearchError) {
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

// GET /api/search/stock?bloodGroup=O%2B
router.get(
  '/stock',
  requireRole('Hospital/Patient', 'Staff', 'Admin'),
  validate([
    queryValidator('bloodGroup')
      .notEmpty()
      .withMessage('bloodGroup query parameter is required')
      .isIn(searchService.VALID_BLOOD_GROUPS)
      .withMessage('Invalid blood group (must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-)'),
  ]),
  async (req, res, next) => {
    try {
      const userRole = req.session?.user?.role;
      const result = await searchService.searchStock(req.query.bloodGroup, userRole);
      return res.status(200).json(result);
    } catch (err) {
      return handleSearchError(err, req, res, next);
    }
  }
);

// GET /api/search/donors?bloodGroup=&city=&pin=&page=
// Staff and Admin only. Donor and Hospital/Patient denied with 403 (FR-SRCH-04, TC-09)
router.get(
  '/donors',
  requireRole('Staff', 'Admin'),
  validate([
    queryValidator('bloodGroup')
      .optional()
      .isIn(searchService.VALID_BLOOD_GROUPS)
      .withMessage('Invalid blood group filter'),
    queryValidator('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    queryValidator('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    queryValidator('pin')
      .optional()
      .trim(),
    queryValidator('city')
      .optional()
      .trim(),
  ]),
  async (req, res, next) => {
    try {
      const { bloodGroup, city, pin, page, limit } = req.query;
      const result = await searchService.searchDonors({
        bloodGroup,
        city,
        pin,
        page,
        limit,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleSearchError(err, req, res, next);
    }
  }
);

module.exports = router;
