const app = require('./app');
const { port } = require('./config');

app
  .listen(port, () => console.log(`API listening on port ${port}`))
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the other process or set PORT.`);
      process.exit(1);
    }
    throw err;
  });