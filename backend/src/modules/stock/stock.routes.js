// C9 Stock API (SAD 4.3 /api/stock, FR-STK-01, 04, 05). Staff (and Admin) only.
const router = require('express').Router();
const { query: queryValidator } = require('express-validator');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const stockService = require('./stock.service');

const STOCK_ROLES = ['Staff', 'Admin'];

function handleStockError(err, req, res, next) {
  if (err instanceof stockService.StockError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.publicMessage, requestId: req.id },
    });
  }
  return next(err);
}

router.get('/summary', requireRole(...STOCK_ROLES), async (req, res, next) => {
  try {
    return res.status(200).json(await stockService.getSummary());
  } catch (err) {
    return handleStockError(err, req, res, next);
  }
});

router.get(
  '/units',
  requireRole(...STOCK_ROLES),
  validate([
    queryValidator('bloodGroup').optional().isIn(stockService.BLOOD_GROUPS)
      .withMessage('Invalid blood group'),
    queryValidator('status').optional().isIn(stockService.UNIT_STATUSES)
      .withMessage('Invalid unit status'),
  ]),
  async (req, res, next) => {
    try {
      const result = await stockService.listUnits({
        bloodGroup: req.query.bloodGroup,
        status: req.query.status,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleStockError(err, req, res, next);
    }
  }
);

module.exports = router;