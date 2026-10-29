// C10 Request API (SAD 4.3 /api/requests, FR-REQ-01/02/03/08, BR-02).
const router = require('express').Router();
const { body, param } = require('express-validator');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const requestService = require('./requests.service');

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const REQUESTER_ROLE = 'Hospital/Patient';
const STAFF_ROLE = 'Staff';
const requestIdParam = param('requestId')
  .matches(/^REQ-\d{8}$/)
  .withMessage('Request ID must use the REQ-00000000 format');

function handleRequestError(err, req, res, next) {
  if (err instanceof requestService.RequestError) {
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

function requestFields() {
  return [
    body().custom((value) => {
      if (typeof value === 'object' && value !== null) {
        const allowed = [
          'patientName',
          'bloodGroup',
          'units',
          'requiredByDate',
          'hospitalName',
          'contactNumber',
          'priority',
        ];
        const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
        if (unknown.length) throw new Error(`Unknown field(s): ${unknown.join(', ')}`);
      }
      return true;
    }),
    body('patientName')
      .isString().withMessage('Patient name is required')
      .trim().notEmpty().withMessage('Patient name is required')
      .isLength({ max: 60 }).withMessage('Patient name cannot exceed 60 characters'),
    body('bloodGroup').isIn(VALID_BLOOD_GROUPS).withMessage('Invalid blood group'),
    body('units')
      .isInt({ min: 1, max: 10 }).withMessage('Units must be an integer between 1 and 10')
      .toInt(),
    body('requiredByDate')
      .matches(/^\d{4}-\d{2}-\d{2}$/).bail()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage('Required-by date must be a valid YYYY-MM-DD date'),
    body('hospitalName')
      .isString().withMessage('Hospital name is required')
      .trim().notEmpty().withMessage('Hospital name is required')
      .isLength({ max: 80 }).withMessage('Hospital name cannot exceed 80 characters'),
    body('contactNumber')
      .matches(/^\d{10}$/).withMessage('Contact number must be exactly 10 digits'),
    body('priority').isIn(['Normal', 'Urgent']).withMessage('Priority must be Normal or Urgent'),
  ];
}

function allowOnlyBodyFields(allowedFields) {
  return body().custom((value) => {
    if (typeof value === 'object' && value !== null) {
      const unknown = Object.keys(value).filter((key) => !allowedFields.includes(key));
      if (unknown.length) throw new Error(`Unknown field(s): ${unknown.join(', ')}`);
    }
    return true;
  });
}

router.get(
  '/pending',
  requireRole(STAFF_ROLE),
  async (req, res, next) => {
    try {
      const result = await requestService.listPendingRequests({ role: req.session.user.role });
      return res.status(200).json(result);
    } catch (err) {
      return handleRequestError(err, req, res, next);
    }
  }
);

router.patch(
  '/:requestId/approve',
  requireRole(STAFF_ROLE),
  validate([requestIdParam]),
  async (req, res, next) => {
    try {
      const result = await requestService.approveRequest({
        staffId: req.session.user.userId,
        role: req.session.user.role,
        requestId: req.params.requestId,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleRequestError(err, req, res, next);
    }
  }
);

router.patch(
  '/:requestId/reject',
  requireRole(STAFF_ROLE),
  validate([
    requestIdParam,
    allowOnlyBodyFields(['reason']),
    body('reason')
      .isString().withMessage('A rejection reason is required')
      .trim().notEmpty().withMessage('A rejection reason is required')
      .isLength({ max: 100 }).withMessage('Rejection reason cannot exceed 100 characters'),
  ]),
  async (req, res, next) => {
    try {
      const result = await requestService.rejectRequest({
        staffId: req.session.user.userId,
        role: req.session.user.role,
        requestId: req.params.requestId,
        reason: req.body.reason,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleRequestError(err, req, res, next);
    }
  }
);

router.patch(
  '/:requestId/issue',
  requireRole(STAFF_ROLE),
  validate([
    requestIdParam,
    allowOnlyBodyFields(['recipientBloodGroup', 'confirmMatch']),
    body('recipientBloodGroup').isIn(VALID_BLOOD_GROUPS)
      .withMessage('A valid recipient blood group is required'),
    body('confirmMatch')
      .custom((value) => value === true)
      .withMessage('Recipient blood group match must be confirmed'),
  ]),
  async (req, res, next) => {
    try {
      const result = await requestService.issueRequest({
        staffId: req.session.user.userId,
        role: req.session.user.role,
        requestId: req.params.requestId,
        recipientBloodGroup: req.body.recipientBloodGroup,
        confirmMatch: req.body.confirmMatch,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleRequestError(err, req, res, next);
    }
  }
);

router.post(
  '/',
  requireRole(REQUESTER_ROLE),
  validate(requestFields()),
  async (req, res, next) => {
    try {
      const created = await requestService.createRequest({
        requesterId: req.session.user.userId,
        role: req.session.user.role,
        request: req.body,
      });
      return res.status(201).json(created);
    } catch (err) {
      return handleRequestError(err, req, res, next);
    }
  }
);

router.get(
  '/mine',
  requireRole(REQUESTER_ROLE),
  async (req, res, next) => {
    try {
      const result = await requestService.listMyRequests({
        requesterId: req.session.user.userId,
        role: req.session.user.role,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleRequestError(err, req, res, next);
    }
  }
);

router.patch(
  '/:requestId/cancel',
  requireRole(REQUESTER_ROLE),
  validate([requestIdParam]),
  async (req, res, next) => {
    try {
      const result = await requestService.cancelMyRequest({
        requesterId: req.session.user.userId,
        role: req.session.user.role,
        requestId: req.params.requestId,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleRequestError(err, req, res, next);
    }
  }
);

module.exports = router;
