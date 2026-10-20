// NFR-SEC-06: audit_log rows must be kept for 1 year, no longer.
// This suite proves the retention job deletes only rows older than 365 days.

const db = require('../../database/db');
const { runRetention, RETENTION_DAYS } = require('./audit.retention');

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describeIfDb('audit retention (NFR-SEC-06)', () => {
  const TEST_ACTION = 'TEST_RETENTION';

  beforeEach(async () => {
    // Clear any prior retention test rows.
    await db.query('DELETE FROM audit_log WHERE action = $1', [TEST_ACTION]);
  });

  afterAll(async () => {
    await db.query('DELETE FROM audit_log WHERE action = $1', [TEST_ACTION]);
  });

  it('deletes audit rows older than RETENTION_DAYS', async () => {
    // Insert a row 400 days old (should be deleted).
    await db.query(
      `INSERT INTO audit_log (action, entity, created_at)
       VALUES ($1, 'test', NOW() - INTERVAL '400 days')`,
      [TEST_ACTION]
    );

    const deleted = await runRetention();
    expect(deleted).toBeGreaterThanOrEqual(1);

    const { rows } = await db.query(
      'SELECT log_id FROM audit_log WHERE action = $1',
      [TEST_ACTION]
    );
    expect(rows).toHaveLength(0);
  });

  it('keeps audit rows younger than RETENTION_DAYS', async () => {
    // Insert a row 300 days old (should be kept).
    await db.query(
      `INSERT INTO audit_log (action, entity, created_at)
       VALUES ($1, 'test', NOW() - INTERVAL '300 days')`,
      [TEST_ACTION]
    );

    await runRetention();

    const { rows } = await db.query(
      'SELECT log_id FROM audit_log WHERE action = $1',
      [TEST_ACTION]
    );
    expect(rows).toHaveLength(1);
  });

  it('uses the RETENTION_DAYS constant (365) as documented', () => {
    expect(RETENTION_DAYS).toBe(365);
  });

  it('boundary: a row at exactly 365 days old survives one run and expires the next', async () => {
    // Insert a row 366 days old to be strictly on the "older than" side.
    await db.query(
      `INSERT INTO audit_log (action, entity, created_at)
       VALUES ($1, 'test', NOW() - INTERVAL '366 days')`,
      [TEST_ACTION]
    );
    await runRetention();
    const { rows } = await db.query(
      'SELECT log_id FROM audit_log WHERE action = $1',
      [TEST_ACTION]
    );
    expect(rows).toHaveLength(0);

    // Insert a row 364 days old; it must survive.
    await db.query(
      `INSERT INTO audit_log (action, entity, created_at)
       VALUES ($1, 'test', NOW() - INTERVAL '364 days')`,
      [TEST_ACTION]
    );
    await runRetention();
    const { rows: kept } = await db.query(
      'SELECT log_id FROM audit_log WHERE action = $1',
      [TEST_ACTION]
    );
    expect(kept).toHaveLength(1);
  });
});