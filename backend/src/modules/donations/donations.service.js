// C8 Donation Service business logic (SAD 3.4, SRS 5.5); HTTP mapping lives in routes.
const { withTransaction } = require('../../database/transaction');
const { logAudit } = require('../audit/audit.repository');
const repo = require('./donations.repository');

const VOLUMES_ML = [350, 450];
const NOTES_MAX_LENGTH = 200;

class DonationError extends Error {
  constructor(code, publicMessage, status = 400) {
    super(publicMessage);
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

function normalise(changes) {
  const out = {};
  if (changes.volumeMl !== undefined) out.volumeMl = changes.volumeMl;
  if (changes.collectionDate !== undefined) out.collectionDate = changes.collectionDate;
  if (changes.medicalNotes !== undefined) {
    const notes = typeof changes.medicalNotes === 'string'
      ? changes.medicalNotes.trim() : changes.medicalNotes;
    out.medicalNotes = notes === '' ? null : notes;
  }
  return out;
}

// FR-DNR-06: edit within 24 h of creation; audited with staff, original and new value.
async function correctDonation({ actorUserId, donationId, changes }) {
  const requested = normalise(changes || {});
  if (Object.keys(requested).length === 0) {
    throw new DonationError('VALIDATION_ERROR', 'Provide at least one field to correct', 400);
  }
  return withTransaction(async (tx) => {
    const row = await repo.findDonationForUpdate(tx, donationId);
    if (!row) throw new DonationError('NOT_FOUND', 'Donation not found', 404);
    if (!row.within_window) {
      throw new DonationError(
        'EDIT_WINDOW_EXPIRED',
        'A donation can only be corrected within 24 hours of creation',
        409
      );
    }
    if (requested.collectionDate && requested.collectionDate > row.today) {
      throw new DonationError('VALIDATION_ERROR', 'Collection date cannot be in the future', 400);
    }

    const current = {
      volumeMl: row.volume_ml,
      collectionDate: row.collection_date,
      medicalNotes: row.medical_notes,
    };
    const changed = Object.keys(requested).filter((key) => requested[key] !== current[key]);
    if (changed.length === 0) {
      throw new DonationError('VALIDATION_ERROR', 'No changes to apply', 400);
    }
    const next = {};
    const original = {};
    changed.forEach((key) => {
      next[key] = requested[key];
      original[key] = current[key];
    });

    const unit = await repo.findUnitForUpdate(tx, donationId);
    if (unit && unit.status !== 'Available') {
      throw new DonationError(
        'INVALID_STATE',
        `The blood unit is ${unit.status}; this donation can no longer be corrected`,
        409
      );
    }

    const updated = await repo.updateDonation(tx, donationId, next);
    if (unit && (next.volumeMl !== undefined || next.collectionDate !== undefined)) {
      await repo.updateUnit(tx, donationId, next);
    }
    if (next.collectionDate !== undefined && row.donation_status === 'Recorded') {
      await repo.syncLastDonationDate(tx, row.donor_id);
    }

    await logAudit({
      userId: actorUserId,
      action: 'DONATION_CORRECTED',
      entity: 'donations',
      entityId: donationId,
      originalValue: original,
      newValue: { ...next, staffId: actorUserId },
    }, tx);

    return {
      donationId: updated.donation_id,
      volumeMl: updated.volume_ml,
      collectionDate: updated.collection_date,
      medicalNotes: updated.medical_notes,
    };
  });
}

module.exports = { DonationError, VOLUMES_ML, NOTES_MAX_LENGTH, correctDonation };