const router = require('express').Router();

router.use('/health', require('./modules/health/health.routes'));
router.use('/auth', require('./modules/auth/auth.routes'));
router.use('/admin', require('./modules/admin/admin.routes'));
router.use('/donors', require('./modules/donors/donors.routes'));
router.use('/requests', require('./modules/requests/requests.routes'));
router.use('/stock', require('./modules/stock/stock.routes'));
router.use('/search', require('./modules/search/search.routes'));
router.use('/reports', require('./modules/reports/reports.routes'));

router.use('/donations', require('./modules/donations/donations.routes'));

module.exports = router;