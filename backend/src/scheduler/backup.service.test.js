const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { runBackup, pruneBackups } = require('./backup.service');

const fakeSpawn = (code) => () => {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => child.emit('close', code));
  return child;
};

describe('runBackup (NFR-SAF-03)', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbms-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('calls pg_dump with an argument array and returns the file path', async () => {
    const spawnFn = jest.fn(fakeSpawn(0));
    const { file } = await runBackup({ dbUri: 'postgres://u:p@h/db', dir, now: new Date('2026-10-12T02:00:00Z'), spawnFn });
    expect(spawnFn.mock.calls[0][0]).toBe('pg_dump');
    expect(Array.isArray(spawnFn.mock.calls[0][1])).toBe(true);
    expect(file).toBe(path.join(dir, 'bbms-20261012-020000.dump'));
  });

  it('rejects when pg_dump fails', async () => {
    await expect(runBackup({ dbUri: 'x', dir, spawnFn: fakeSpawn(1) })).rejects.toThrow('code 1');
  });

  it('rejects when DB_URI is missing', async () => {
    await expect(runBackup({ dir })).rejects.toThrow('DB_URI');
  });
});

describe('pruneBackups (30-day retention)', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbms-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('deletes only backups older than the retention period', () => {
    const now = new Date('2026-10-12T00:00:00Z');
    const mk = (name, daysOld) => {
      const f = path.join(dir, name);
      fs.writeFileSync(f, 'x');
      const t = new Date(now.getTime() - daysOld * 86400000);
      fs.utimesSync(f, t, t);
    };
    mk('bbms-old.dump', 31);
    mk('bbms-new.dump', 29);
    mk('notes.txt', 90); // not a backup file, must be left alone
    const removed = pruneBackups({ dir, retentionDays: 30, now });
    expect(removed).toEqual(['bbms-old.dump']);
    expect(fs.readdirSync(dir).sort()).toEqual(['bbms-new.dump', 'notes.txt']);
  });

  it('returns an empty list when the folder does not exist', () => {
    expect(pruneBackups({ dir: path.join(dir, 'missing'), retentionDays: 30 })).toEqual([]);
  });
});
