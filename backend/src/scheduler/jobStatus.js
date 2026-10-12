// Last run result of each job, for monitoring (SAD 4.4, SAD C15).
const status = { expiry: null, backup: null };

exports.record = (job, result) => {
  status[job] = { ...result, lastRun: new Date().toISOString() };
};
exports.snapshot = () => ({ expiry: status.expiry, backup: status.backup });
exports.reset = () => { status.expiry = null; status.backup = null; };
