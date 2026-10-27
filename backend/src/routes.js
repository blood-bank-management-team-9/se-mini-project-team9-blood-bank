const router = require('express').Router();

router.use('/health', require('./modules/health/health.routes'));
router.use('/auth', require('./modules/auth/auth.routes'));
router.use('/admin', require('./modules/admin/admin.routes'));
router.use('/search', require('./modules/search/search.routes'));

module.exports = router;