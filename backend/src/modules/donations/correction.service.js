const AppError = require('../../middleware/AppError');
const defaultRepo = require('./correction.repository');
const defaultAudit = require('../../audit/audit.service');
const { withTransaction } = require('../../database/transaction');
const { EDIT_WINDOW_HOURS, SHELF_LIFE_DAYS } = require('./constants');
const { addDays, toDateStr } = require('./dates');

const HOUR_MS = 60 * 60 * 1000;

// FR-DNR-06: Staff correct a donation entry within 24 hours. The change, its stock effect
// and its audit entry are one transaction (SAD 4.1, NFR-QUAL-03).
exports.correctDonation = async (
  { donationId, changes, staffId, now = new Date() },
  { repo = defaultRepo, audit = defaultAudit, tx = withTransaction } = {}
) =>
  tx(async (db) => {
    const donation = await repo.findDonationForUpdate(db, donationId);
    if (!donation) throw new AppError(404, 'NOT_FOUND', 'Donation not found.');

    // Refused only when MORE than 24 hours have passed since creation.
    if (now.getTime() - new Date(donation.created_at).getTime() > EDIT_WINDOW_HOURS * HOUR_MS) {
      throw new AppError(409, 'EDIT_WINDOW_EXPIRED', 'This donation can no longer be corrected (more than 24 hours old).');
    }

    const current = {
      collectionDate: toDateStr(donation.collection_date),
      volumeMl: donation.volume_ml,
      screeningStatus: donation.screening_status,
      medicalNotes: donation.medical_notes ?? '',
    };
    const diff = {};
    for (const key of Object.keys(changes)) {
      if (changes[key] !== current[key]) diff[key] = changes[key];
    }
    if (Object.keys(diff).length === 0) return { donationId, updated: {} };

    const unit = await repo.findUnitForUpdate(db, donationId);
    const unitAffected = diff.volumeMl !== undefined || diff.collectionDate !== undefined || diff.screeningStatus !== undefined;
    if (unit && unitAffected && unit.status !== 'Available') {
      throw new AppError(409, 'INVALID_STATE', `The blood unit is already ${unit.status}, so this donation can no longer be corrected.`);
    }

    const donationChanges = { ...diff };
    const originalValue = {};
    for (const key of Object.keys(diff)) originalValue[key] = current[key];

    if (diff.screeningStatus === 'Passed') {
      // A failed screening must not be turned into a pass by correction (safety).
      throw new AppError(409, 'INVALID_STATE', 'A Failed Screening donation cannot be changed to Passed. Record a new donation instead.');
    }
    if (diff.screeningStatus === 'Failed') {
      donationChanges.donationStatus = 'Failed Screening';
      originalValue.donationStatus = donation.donation_status;
      if (unit) {
        await repo.updateUnit(db, unit.unit_id, { status: 'Discarded', discardReason: 'Failed screening (donation corrected)' });
        originalValue.unitStatus = unit.status;
      }
    } else if (unit && (diff.volumeMl !== undefined || diff.collectionDate !== undefined)) {
      const unitChanges = {};
      if (diff.volumeMl !== undefined) unitChanges.volumeMl = diff.volumeMl;
      if (diff.collectionDate !== undefined) {
        unitChanges.collectionDate = diff.collectionDate;
        unitChanges.expiryDate = addDays(diff.collectionDate, SHELF_LIFE_DAYS);
        originalValue.expiryDate = toDateStr(unit.expiry_date);
      }
      await repo.updateUnit(db, unit.unit_id, unitChanges);
    }

    await repo.updateDonation(db, donationId, donationChanges);

    const newValue = { ...diff };
    if (donationChanges.donationStatus) newValue.donationStatus = donationChanges.donationStatus;
    if (diff.screeningStatus === 'Failed' && unit) newValue.unitStatus = 'Discarded';
    if (diff.collectionDate !== undefined && unit) newValue.expiryDate = addDays(diff.collectionDate, SHELF_LIFE_DAYS);

    await audit.logChange(db, {
      userId: staffId,
      action: 'DONATION_CORRECTED',
      entity: `donation:${donationId}`,
      originalValue,
      newValue,
    });

    return { donationId, updated: newValue };
  });
