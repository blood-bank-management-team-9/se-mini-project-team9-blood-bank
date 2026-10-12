const { TZ } = require('./constants');

exports.todayInTz = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

// 'YYYY-MM-DD' + n days, using UTC maths so the server time zone never matters.
exports.addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// pg returns DATE columns as Date objects (local midnight) or strings.
exports.toDateStr = (v) => {
  if (typeof v === 'string') return v.slice(0, 10);
  const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'), d = String(v.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

exports.isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
