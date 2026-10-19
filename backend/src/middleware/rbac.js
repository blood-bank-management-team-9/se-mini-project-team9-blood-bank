// NFR-SEC-02: deny-by-default RBAC. Unauthorised -> 403 ACCESS_DENIED + audit row.
const { logAudit } = require('../modules/audit/audit.repository');

function requireRole(...allowedRoles) {
  return async function rbac(req, res, next) {
    const user = req.session && req.session.user;
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
          requestId: req.id,
        },
      });
    }
    if (!allowedRoles.includes(user.role)) {
      // NFR-SEC-02: log the attempt (audit_log table, C12)
      try {
        await logAudit({
          userId: user.userId,
          action: 'ACCESS_DENIED',
          entity: 'api_route',
          entityId: `${req.method} ${req.originalUrl}`,
          newValue: { role: user.role, path: req.originalUrl },
        });
      } catch (auditErr) {
        // Never let audit failure change the 403 response.
        // eslint-disable-next-line no-console
        console.error('Audit write failed for ACCESS_DENIED', auditErr.message);
      }
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'access denied',
          requestId: req.id,
        },
      });
    }
    return next();
  };
}

module.exports = { requireRole };