const DISCARD_REASONS = ['Expired', 'Hemolyzed', 'Contaminated', 'Leakage', 'Test Positive'];

// FR-STK-06: a reason from the list is mandatory.
exports.validateDiscard = (body) => {
  const reason = body && typeof body === 'object' ? body.reason : undefined;
  if (reason === undefined || reason === null || reason === '') {
    return { fields: [{ field: 'reason', message: 'Select a reason for discarding the unit.' }] };
  }
  if (!DISCARD_REASONS.includes(reason)) {
    return { fields: [{ field: 'reason', message: `Reason must be one of: ${DISCARD_REASONS.join(', ')}.` }] };
  }
  return { value: { reason }, fields: [] };
};

// Unit IDs look like UNT-XXXXX (SAD 4.1).
exports.validUnitId = (id) => /^UNT-[A-Za-z0-9]{5}$/.test(id);
exports.DISCARD_REASONS = DISCARD_REASONS;
