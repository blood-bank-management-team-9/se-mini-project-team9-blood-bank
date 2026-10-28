// C8 Donation Service: record a donation (SAD 4.2 SD-2, FR-DNR-01 to 05, BR-03).
const { withTransaction } = require('../../database/transaction');
const { logAudit } = require('../audit/audit.repository');
const { evaluateEligibility } = require('../donors/donorEligibility');
const { DonationError } = require('./donations.service');
const { syncLastDonationDate } = require('./donations.repository');
const repo = require('./donations.record.repository');

const DEFAULT_SHELF_LIFE_DAYS = 35;

function shelfLifeFrom(config) {
  const days = Number(config.shelf_life_days);
  return Number.isInteger(days) && days > 0 ? days : DEFAULT_SHELF_LIFE_DAYS;
}

function cleanNotes(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

async function recordDonation({ actorUserId, input }) {
  const { donorId, collectionDate, volumeMl, screeningStatus } = input;
  const medicalNotes = cleanNotes(input.medicalNotes);
  const passed = screeningStatus === 'Passed';

  // FR-DNR-04: the failure reason must be recorded.
  if (!passed && !medicalNotes) {
    throw new DonationError(
      'VALIDATION_ERROR',
      'A reason is required in medicalNotes when screening fails',
      400
    );
  }

  return withTransaction(async (tx) => {
    const donor = await repo.findDonorForUpdate(tx, donorId);
    if (!donor) throw new DonationError('NOT_FOUND', 'Donor not found', 404);

    const today = await repo.getToday(tx);
    if (collectionDate > today) {
      throw new DonationError('VALIDATION_ERROR', 'Collection date cannot be in the future', 400);
    }

    // FR-DNR-02, BR-03: block ineligible donors, evaluated on the collection date.
    const config = await repo.getConfig(tx);
    const reasons = [];
    if (donor.status !== 'Active') {
      reasons.push({ code: 'DONOR_INACTIVE', message: 'Donor is inactive and cannot donate.' });
    }
    reasons.push(...evaluateEligibility(donor, config, collectionDate).ineligibilityReasons);
    if (reasons.length > 0) {
      const err = new DonationError('NOT_ELIGIBLE', 'Donor is not eligible to donate', 422);
      err.reasons = reasons;
      throw err;
    }

    const donationId = await repo.nextDonationId(tx);
    const donationStatus = passed ? 'Recorded' : 'Failed Screening';
    await repo.insertDonation(tx, {
      donationId,
      donorId,
      collectionDate,
      volumeMl,
      bloodGroup: donor.blood_group,
      screeningStatus,
      donationStatus,
      recordedBy: actorUserId,
      medicalNotes,
    });

    let unit = null;
    if (passed) {
      const unitId = await repo.nextUnitId(tx);
      unit = await repo.insertUnit(tx, {
        unitId,
        donationId,
        bloodGroup: donor.blood_group,
        volumeMl,
        collectionDate,
        shelfLifeDays: shelfLifeFrom(config),
      });
      // FR-DNR-05: only a successful donation updates the last donation date.
      await syncLastDonationDate(tx, donorId);
    }

    await logAudit({
      userId: actorUserId,
      action: passed ? 'DONATION_RECORDED' : 'SCREENING_FAILED',
      entity: 'donations',
      entityId: donationId,
      newValue: {
        donorId,
        collectionDate,
        volumeMl,
        screeningStatus,
        donationStatus,
        unitId: unit ? unit.unit_id : null,
        staffId: actorUserId,
      },
    }, tx);

    return {
      donationId,
      donationStatus,
      unitId: unit ? unit.unit_id : null,
      expiryDate: unit ? unit.expiry_date : null,
    };
  });
}

module.exports = { recordDonation };