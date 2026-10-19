// NFR-SEC-02 / SAD 4.4: every request gets a requestId that appears in logs and error bodies.
const { randomUUID } = require('crypto');

function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = requestId;