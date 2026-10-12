const express = require('express');
const AppError = require('../../middleware/AppError');
const { requireRole } = require('../../middleware/rbac');
const { validateCorrection, validDonationId } = require('./correction.validation');
const defaultService = require('./correction.service');

// PUT /api/donations/:id  (Staff only) - SAD 4.3, FR-DNR-06
module.exports = ({ service = defaultService } = {}) => {
  const router = express.Router();
  router.put('/:id', requireRole('Staff'), async (req, res, next) => {
    try {
      if (!validDonationId(req.params.id)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid donation ID.', [{ field: 'id', message: 'Invalid donation ID.' }]);
      }
      const { value, fields } = validateCorrection(req.body);
      if (fields.length) throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', fields);
      const result = await service.correctDonation({
        donationId: req.params.id,
        changes: value,
        staffId: req.user.userId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });
  return router;
};
