// SAD 4.4: single error shape { error: { code, message, fields?, requestId } }.
// Exports two middlewares: notFound (404 fall-through) and errorHandler (4-arg error).

function notFound(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
      requestId: req.id,
    },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const requestId = req.id;
  // eslint-disable-next-line no-console
  console.error(`[${requestId}]`, err.stack || err.message);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.publicMessage || 'Internal server error',
      requestId,
    },
  });
}

module.exports = { notFound, errorHandler };