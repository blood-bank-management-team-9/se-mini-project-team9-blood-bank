const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { stamp } = require('./dates');

// Nightly pg_dump (NFR-SAF-03). Arguments go in an array, never through a shell.
exports.runBackup = ({ dbUri, dir, now = new Date(), spawnFn = spawn }) =>
  new Promise((resolve, reject) => {
    if (!dbUri) return reject(new Error('DB_URI is not set'));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `bbms-${stamp(now)}.dump`);
    const child = spawnFn('pg_dump', ['--format=custom', `--file=${file}`, `--dbname=${dbUri}`]);
    let stderr = '';
    if (child.stderr) child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve({ file }) : reject(new Error(`pg_dump exited with code ${code}`))
    );
  });

// Deletes backups older than the retention period (30 days, NFR-SAF-03).
exports.pruneBackups = ({ dir, retentionDays, now = new Date() }) => {
  if (!fs.existsSync(dir)) return [];
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const name of fs.readdirSync(dir)) {
    if (!/^bbms-.*\.dump$/.test(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).mtimeMs < cutoff) { fs.unlinkSync(full); removed.push(name); }
  }
  return removed;
};
