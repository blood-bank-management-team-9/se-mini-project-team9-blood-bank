const app = require('./app');
const { port, env, dbUri } = require('./config');
const scheduler = require('./scheduler');

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
  if (env !== 'test' && dbUri) scheduler.start();
  else console.log('[scheduler] not started (no DB_URI set)');
});
