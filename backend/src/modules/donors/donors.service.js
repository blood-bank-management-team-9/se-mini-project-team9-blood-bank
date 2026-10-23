// C6 Donor Management business logic (SAD 3.4); HTTP mapping lives in routes.
const { withTransaction } = require('../../database/transaction');
const { logAudit } = require('../audit/audit.repository');
const repo = require('./donors.repository');
const { evaluateEligibility } = require('./donorEligibility');

const VALID_STATUSES = ['Active', 'Inactive'];

class DonorError extends Error {
  constructor(code, publicMessage, status = 400) {
    super(publicMessage);
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

function toDonorDto(row) {
  if (!row) return null;
  return {
    donorId: row.donor_id,
    fullName: row.full_name,
    dob: row.date_of_birth,
    gender: row.gender,
    bloodGroup: row.blood_group,
    weightKg: Number(row.weight_kg),
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    pinCode: row.pin_code,
    lastDonationDate: row.last_donation_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapDatabaseError(err) {
  if (err.code === '23505' && err.constraint === 'donors_phone_key') {
    return new DonorError('ACCOUNT_EXISTS', 'A donor with this phone number already exists', 409);
  }
  return err;
}

async function listDonors(filters) {
  const rows = await repo.listDonors(filters);
  return { donors: rows.map(toDonorDto), total: rows.length };
}

async function getDonor(donorId) {
  const row = await repo.findDonorById(donorId);
  if (!row) throw new DonorError('NOT_FOUND', 'Donor not found', 404);
  return toDonorDto(row);
}

async function getDonorEligibility(donorId) {
  const donor = await repo.findDonorById(donorId);
  if (!donor) throw new DonorError('NOT_FOUND', 'Donor not found', 404);
  const config = await repo.getEligibilityConfig();
  return evaluateEligibility(donor, config);
}

async function createDonor({ actorUserId, donor }) {
  try {
    return await withTransaction(async (tx) => {
      const donorId = await repo.nextDonorId(tx);
      const created = await repo.createDonor(tx, donorId, donor);
      await logAudit({
        userId: actorUserId,
        action: 'DONOR_CREATED',
        entity: 'donors',
        entityId: donorId,
        newValue: { status: created.status },
      }, tx);
      return toDonorDto(created);
    });
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

async function updateDonor({ actorUserId, donorId, donor }) {
  try {
    return await withTransaction(async (tx) => {
      const existing = await repo.findDonorById(donorId, tx);
      if (!existing) throw new DonorError('NOT_FOUND', 'Donor not found', 404);

      const updated = await repo.updateDonor(tx, donorId, donor);
      await logAudit({
        userId: actorUserId,
        action: 'DONOR_UPDATED',
        entity: 'donors',
        entityId: donorId,
        newValue: { submittedFields: Object.keys(donor) },
      }, tx);
      return toDonorDto(updated);
    });
  } catch (err) {
    throw mapDatabaseError(err);
  }
}

async function setDonorStatus({ actorUserId, donorId, status }) {
  if (!VALID_STATUSES.includes(status)) {
    throw new DonorError('VALIDATION_ERROR', 'Status must be Active or Inactive');
  }

  return withTransaction(async (tx) => {
    const existing = await repo.findDonorById(donorId, tx);
    if (!existing) throw new DonorError('NOT_FOUND', 'Donor not found', 404);

    const updated = await repo.updateDonorStatus(tx, donorId, status);
    if (existing.status !== status) {
      await logAudit({
        userId: actorUserId,
        action: status === 'Active' ? 'DONOR_REACTIVATED' : 'DONOR_DEACTIVATED',
        entity: 'donors',
        entityId: donorId,
        originalValue: { status: existing.status },
        newValue: { status },
      }, tx);
    }
    return toDonorDto(updated);
  });
}

module.exports = {
  listDonors,
  getDonor,
  getDonorEligibility,
  createDonor,
  updateDonor,
  setDonorStatus,
  DonorError,
};
