// C12 Audit & Logging (NFR-SEC-02, NFR-SEC-06, NFR-SEC-07).
// Ensures sensitive personal data (passwords, phone numbers, emails, addresses)
// is redacted before writing to audit_log.
const { query } = require('../../database/db');
const { redact } = require('../../middleware/redaction');

async function logAudit(
  { userId = null, action, entity, entityId = null, originalValue = null, newValue = null },
  tx = null
) {
  const runner = tx ? tx.query.bind(tx) : query;
  await runner(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, original_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      action,
      entity,
      entityId,
      originalValue ? redact(originalValue) : null,
      newValue ? redact(newValue) : null,
    ]
  );
}

module.exports = { logAudit };