// C12 Audit & Logging (NFR-SEC-02, NFR-SEC-06). Works inside an existing tx or standalone.
const { query } = require('../../database/db');

async function logAudit(
  { userId = null, action, entity, entityId = null, originalValue = null, newValue = null },
  tx = null
) {
  const runner = tx ? tx.query.bind(tx) : query;
  await runner(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, original_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, action, entity, entityId, originalValue, newValue]
  );
}

module.exports = { logAudit };