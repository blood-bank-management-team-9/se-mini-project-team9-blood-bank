const router = require('express').Router();
const { health } = require('./health.controller');

router.get('/', health);

module.exports = router;