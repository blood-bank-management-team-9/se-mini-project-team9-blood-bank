const jobStatus = require('../../scheduler/jobStatus');

// Health check (SAD 4.4). Also reports the last run of the scheduled jobs.
exports.health = (req, res) =>
  res.json({
    status: 'ok',
    service: 'blood-bank-api',
    time: new Date().toISOString(),
    jobs: jobStatus.snapshot(),
  });