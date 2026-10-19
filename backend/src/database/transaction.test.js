// NFR-QUAL-03, TC-33: transaction rollback on mid-transaction failure.
// Requires a live PostgreSQL configured via backend/.env.

const db = require('./db');
const { withTransaction } = require('./transaction');

const pool = db.pool;

describe('withTransaction (NFR-QUAL-03, TC-33)', () => {
  // Intentionally NOT calling pool.end() here.
  // Other suites (e.g. database.test.js) share this pool; closing it here
  // would break them mid-run when Jest runs suites in order.

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
        // Force a failure: duplicate PK on second insert
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