const router = require('express').Router();
const { health } = require('../controllers/healthController');

router.get('/health', health);
// Feature routers get mounted here, e.g. router.use('/donors', require('./donors'));

module.exports = router;
