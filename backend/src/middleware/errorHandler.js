exports.notFound = (req, res) =>
  res.status(404).json({ error: 'Not found', path: req.originalUrl });

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
};
