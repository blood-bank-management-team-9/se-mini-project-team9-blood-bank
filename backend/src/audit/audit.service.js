exports.logChange = (tx, { userId, action, entity, originalValue, newValue }) =>
  tx.query(
    `INSERT INTO audit_log (user_id, action, entity, original_value, new_value, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId, action, entity, JSON.stringify(originalValue), JSON.stringify(newValue)]
  );
