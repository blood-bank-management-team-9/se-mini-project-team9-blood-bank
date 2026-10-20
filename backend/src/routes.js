const router = require('express').Router();

router.use('/health', require('./modules/health/health.routes'));
router.use('/auth', require('./modules/auth/auth.routes'));
router.use('/admin', require('./modules/admin/admin.routes'));

module.exports = router;