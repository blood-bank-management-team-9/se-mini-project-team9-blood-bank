const router = require('express').Router();

router.use('/health', require('./modules/health/health.routes'));
// Mount each feature module here as it is built, e.g.
// router.use('/auth', require('./modules/auth/auth.routes'));
router.use('/donations', require('./modules/donations/correction.routes')());
module.exports = router;