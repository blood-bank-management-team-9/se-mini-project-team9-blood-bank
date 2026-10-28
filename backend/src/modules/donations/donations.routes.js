// C8 Donation API (SAD 4.3 PUT /api/donations/{id}, FR-DNR-06). Staff only (BR-01).
const router = require('express').Router();
const { body, param } = require('express-validator');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const donationService = require('./donations.service');

const DONATION_ROLES = ['Staff'];
const ALLOWED_CORRECTION_FIELDS = ['volumeMl', 'collectionDate', 'medicalNotes'];

function handleDonationError(err, req, res, next) {
  if (err instanceof donationService.DonationError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.publicMessage,
        ...(err.reasons ? { reasons: err.reasons } : {}),
        requestId: req.id,
      },
    });
  }
  return next(err);
}

router.put(
  '/:donationId',
  requireRole(...DONATION_ROLES),
  validate([
    param('donationId').matches(/^DON-\d{5,}$/).withMessage('Invalid donation id'),
    body().custom((value) => {
      if (typeof value === 'object' && value !== null) {
        const unknown = Object.keys(value).filter((k) => !ALLOWED_CORRECTION_FIELDS.includes(k));
        if (unknown.length > 0) {
          throw new Error(`Unknown field(s): ${unknown.join(', ')}`);
        }
      }
      return true;
    }),
    body('volumeMl').optional()
      .custom((v) => donationService.VOLUMES_ML.includes(v))
      .withMessage('Volume must be 350 or 450 ml'),
    body('collectionDate').optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).bail()
      .isISO8601({ strict: true })
      .withMessage('Collection date must be a valid YYYY-MM-DD date'),
    body('medicalNotes').optional({ nullable: true })
      .isString().bail()
      .trim()
      .isLength({ max: donationService.NOTES_MAX_LENGTH })
      .withMessage('Medical notes must be at most 200 characters'),
  ]),
  async (req, res, next) => {
    try {
      const changes = {};
      if (req.body.volumeMl !== undefined) changes.volumeMl = req.body.volumeMl;
      if (req.body.collectionDate !== undefined) changes.collectionDate = req.body.collectionDate;
      if (req.body.medicalNotes !== undefined) changes.medicalNotes = req.body.medicalNotes;

      const result = await donationService.correctDonation({
        actorUserId: req.session.user.userId,
        donationId: req.params.donationId,
        changes,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleDonationError(err, req, res, next);
    }
  }
);

module.exports = router;