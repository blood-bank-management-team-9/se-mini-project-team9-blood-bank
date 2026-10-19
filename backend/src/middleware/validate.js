// NFR-SEC-05: server-side validation; returns SAD 4.4 VALIDATION_ERROR shape.
const { validationResult } = require('express-validator');

function validate(rules) {
  return async function validateChain(req, res, next) {
    await Promise.all(rules.map((rule) => rule.run(req)));
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'One or more fields are invalid',
          fields: result.array().map((e) => ({ field: e.path, message: e.msg })),
          requestId: req.id,
        },
      });
    }
    return next();
  };
}

module.exports = { validate };