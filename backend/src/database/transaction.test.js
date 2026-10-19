// NFR-QUAL-03, TC-33: transaction rollback on mid-transaction failure.
// Requires a live PostgreSQL configured via backend/.env.
// CI runners do not provision PostgreSQL, so the suite is skipped when
// DATABASE_URL is not set (documented as deviation #7 in the PR).

const db = require('./db');
const { withTransaction } = require('./transaction');

const pool = db.pool;

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDatabase = hasDatabase ? describe : describe.skip;

describeIfDatabase('withTransaction (NFR-QUAL-03, TC-33)', () => {
  // Intentionally NOT closing the shared pool here — other suites reuse it.

  it('commits both inserts on success', async () => {
    const tag = `tx-ok-${Date.now()}`;
    await withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO system_config (key, value) VALUES ($1, $2)`,
        [`t_${tag}_a`, '1']
      );
      await tx.query(
        `INSERT INTO system_config (key, value) VALUES ($1, $2)`,
        [`t_${tag}_b`, '2']
      );
    });
    const { rows } = await pool.query(
      `SELECT key FROM system_config WHERE key LIKE $1 ORDER BY key`,
      [`t_${tag}_%`]
    );
    expect(rows.map((r) => r.key)).toEqual([`t_${tag}_a`, `t_${tag}_b`]);
    await pool.query(`DELETE FROM system_config WHERE key LIKE $1`, [`t_${tag}_%`]);
  });

  it('rolls back the first insert when the second fails', async () => {
    const tag = `tx-fail-${Date.now()}`;
    await expect(
      withTransaction(async (tx) => {
        await tx.query(
          `INSERT INTO system_config (key, value) VALUES ($1, $2)`,
          [`t_${tag}_a`, '1']
        );
        await tx.query(
          `INSERT INTO system_config (key, value) VALUES ($1, $2)`,
          [`t_${tag}_a`, '2']
        );
      })
    ).rejects.toBeTruthy();

    const { rows } = await pool.query(
      `SELECT key FROM system_config WHERE key LIKE $1`,
      [`t_${tag}_%`]
    );
    expect(rows).toHaveLength(0);
  });
});