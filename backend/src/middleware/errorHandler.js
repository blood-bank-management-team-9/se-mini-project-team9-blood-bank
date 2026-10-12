const AppError = require('./AppError');

exports.notFound = (req, res) =>
  res.status(404).json({ error: 'Not found', path: req.originalUrl });

// SAD 4.4: every error is {error: {code, message, fields[], requestId}}.
// Unexpected faults return a generic 500; the real message stays in the server log only.
// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  const requestId = req.id || null;
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, fields: err.fields, requestId },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON', fields: [], requestId },
    });
  }
  console.error(`[error] ${err.message}`);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', fields: [], requestId },
  });
};
