const router = require('express').Router();

router.use('/health', require('./modules/health/health.routes'));
router.use('/auth', require('./modules/auth/auth.routes'));

module.exports = router;