exports.health = (req, res) =>
  res.json({ status: 'ok', service: 'blood-bank-api', time: new Date().toISOString() });
