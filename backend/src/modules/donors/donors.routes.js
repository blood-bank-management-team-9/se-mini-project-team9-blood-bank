// C6 Donor Management API (SAD 4.3 /api/donors, FR-DON-01/02/03/07).
const router = require('express').Router();
const { body, param, query: queryValidator } = require('express-validator');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const donorService = require('./donors.service');

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VALID_GENDERS = ['Male', 'Female', 'Other'];
const DONOR_ROLES = ['Staff', 'Admin'];

function donorFields() {
  return [
    body('fullName')
      .isString().withMessage('Full name is required')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ max: 60 }).withMessage('Full name cannot exceed 60 characters'),
    body('dob')
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage('Date of birth must be a valid date')
      .bail()
      .custom((value) => {
        const birthDate = new Date(`${value}T00:00:00Z`);
        const now = new Date();
        let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
        const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
        if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
          age--;
        }
        if (birthDate > now || age < 18 || age > 65) {
          throw new Error('Donor must be between 18 and 65 years old');
        }
        return true;
      }),
    body('gender').isIn(VALID_GENDERS).withMessage('Gender must be Male, Female or Other'),
    body('bloodGroup').isIn(VALID_BLOOD_GROUPS).withMessage('Invalid blood group'),
    body('weightKg')
      .isFloat({ min: 45 }).withMessage('Weight must be at least 45 kg')
      .toFloat(),
    body('phone')
      .matches(/^\d{10}$/).withMessage('Phone number must be exactly 10 digits'),
    body('email')
      .optional({ checkFalsy: true })
      .isEmail().withMessage('Please enter a valid email address')
      .isLength({ max: 60 }).withMessage('Email cannot exceed 60 characters')
      .normalizeEmail(),
    body('address')
      .optional({ checkFalsy: true })
      .isString().withMessage('Address must be text')
      .trim()
      .isLength({ max: 120 }).withMessage('Address cannot exceed 120 characters'),
    body('city')
      .isString().withMessage('City is required')
      .trim()
      .notEmpty().withMessage('City is required')
      .isLength({ max: 40 }).withMessage('City cannot exceed 40 characters'),
    body('pinCode')
      .matches(/^\d{6}$/).withMessage('PIN code must be exactly 6 digits'),
  ];
}

const donorIdParam = param('id')
  .matches(/^DNR-\d{5}$/)
  .withMessage('Donor ID must use the DNR-00000 format');

function handleDonorError(err, req, res, next) {
  if (err instanceof donorService.DonorError) {
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

router.get(
  '/',
  requireRole(...DONOR_ROLES),
  validate([
    queryValidator('status').optional().isIn(['Active', 'Inactive'])
      .withMessage('Status must be Active or Inactive'),
    queryValidator('bloodGroup').optional().isIn(VALID_BLOOD_GROUPS)
      .withMessage('Invalid blood group'),
    queryValidator('q').optional().isString().isLength({ max: 100 })
      .withMessage('Search term cannot exceed 100 characters'),
  ]),
  async (req, res, next) => {
    try {
      const result = await donorService.listDonors({
        status: req.query.status,
        bloodGroup: req.query.bloodGroup,
        q: req.query.q,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleDonorError(err, req, res, next);
    }
  }
);

router.post(
  '/',
  requireRole(...DONOR_ROLES),
  validate(donorFields()),
  async (req, res, next) => {
    try {
      const donor = await donorService.createDonor({
        actorUserId: req.session.user.userId,
        donor: req.body,
      });
      return res.status(201).json(donor);
    } catch (err) {
      return handleDonorError(err, req, res, next);
    }
  }
);

router.get(
  '/:id',
  requireRole(...DONOR_ROLES),
  validate([donorIdParam]),
  async (req, res, next) => {
    try {
      const donor = await donorService.getDonor(req.params.id);
      return res.status(200).json(donor);
    } catch (err) {
      return handleDonorError(err, req, res, next);
    }
  }
);

router.put(
  '/:id',
  requireRole(...DONOR_ROLES),
  validate([donorIdParam, ...donorFields()]),
  async (req, res, next) => {
    try {
      const donor = await donorService.updateDonor({
        actorUserId: req.session.user.userId,
        donorId: req.params.id,
        donor: req.body,
      });
      return res.status(200).json(donor);
    } catch (err) {
      return handleDonorError(err, req, res, next);
    }
  }
);

router.patch(
  '/:id/status',
  requireRole(...DONOR_ROLES),
  validate([
    donorIdParam,
    body('status').isIn(['Active', 'Inactive'])
      .withMessage('Status must be Active or Inactive'),
  ]),
  async (req, res, next) => {
    try {
      const donor = await donorService.setDonorStatus({
        actorUserId: req.session.user.userId,
        donorId: req.params.id,
        status: req.body.status,
      });
      return res.status(200).json(donor);
    } catch (err) {
      return handleDonorError(err, req, res, next);
    }
  }
);

module.exports = router;
