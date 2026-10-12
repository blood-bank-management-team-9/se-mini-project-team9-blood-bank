const { timeZone } = require('../config');

// "Today" as YYYY-MM-DD in Asia/Kolkata (SAD 4.1), whatever the server's own zone is.
exports.todayInTz = (now = new Date(), tz = timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

// Filename-safe timestamp, e.g. 20261012-020000
exports.stamp = (now = new Date()) =>
  now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
