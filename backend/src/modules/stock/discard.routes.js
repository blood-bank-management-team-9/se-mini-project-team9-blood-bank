const express = require('express');
const AppError = require('../../middleware/AppError');
const { requireRole } = require('../../middleware/rbac');
const { validateDiscard, validUnitId } = require('./discard.validation');
const defaultService = require('./discard.service');

// PATCH /api/stock/units/:unitId/discard  (Staff only) - SAD 4.3, FR-STK-06
module.exports = ({ service = defaultService } = {}) => {
  const router = express.Router();
  router.patch('/units/:unitId/discard', requireRole('Staff'), async (req, res, next) => {
    try {
      if (!validUnitId(req.params.unitId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid unit ID.', [{ field: 'unitId', message: 'Invalid unit ID.' }]);
      }
      const { value, fields } = validateDiscard(req.body);
      if (fields.length) throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', fields);
      const result = await service.discardUnit({
        unitId: req.params.unitId,
        reason: value.reason,
        staffId: req.user.userId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });
  return router;
};
