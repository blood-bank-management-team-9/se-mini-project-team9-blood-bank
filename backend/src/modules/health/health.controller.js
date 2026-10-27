const { pool } = require('../../database/db');

// NFR-QUAL-02 & SAD 4.4: Availability & Health monitoring (app + database)
exports.health = async (req, res) => {
  let dbStatus = 'unavailable';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'unavailable';
  }

  const isHealthy = dbStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'blood-bank-api',
    database: dbStatus,
    uptime: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  });
};