const cron = require('node-cron');
const app = require('./app');
const { port, env } = require('./config');
const { runRetention } = require('./modules/audit/audit.retention');
const scheduler = require('./scheduler');

app
  .listen(port, () => console.log(`API listening on port ${port}`))
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the other process or set PORT.`);
      process.exit(1);
    }
    throw err;
  });

// NFR-SEC-06: run the audit retention job daily at 02:00 local time.
// Guarded by NODE_ENV !== 'test' so Jest does not spawn the scheduler.
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 2 * * *', () => {
    runRetention().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[audit-retention] job failed:', err.message);
    });
  });
  console.log('[audit-retention] scheduled daily at 02:00');
}

// FR-STK-03 (midnight expiry job) and NFR-SAF-03 (nightly backup), SAD C15.
if (env !== 'test') {
  scheduler.start();
}