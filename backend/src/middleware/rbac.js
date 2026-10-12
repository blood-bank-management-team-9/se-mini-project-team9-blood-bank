const AppError = require('./AppError');

exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.'));
  if (!roles.includes(req.user.role)) {
    console.warn(`[security] 403 role=${req.user.role} user=${req.user.userId} ${req.method} ${req.originalUrl}`);
    return next(new AppError(403, 'ACCESS_DENIED', 'access denied'));
  }
  return next();
};
