// C7 Search Service — Business Logic (SAD 3.4, 4.3, SRS 5.4)

const searchRepo = require('./search.repository');
const { logAudit } = require('../audit/audit.repository');

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

class SearchError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'SearchError';
    this.code = code;
    this.publicMessage = message;
    this.status = status;
  }
}

// FR-SRCH-01, FR-SRCH-02, FR-SRCH-05: Stock search
async function searchStock(bloodGroup, userRole) {
  if (!bloodGroup || !VALID_BLOOD_GROUPS.includes(bloodGroup)) {
    throw new SearchError('INVALID_BLOOD_GROUP', 'Valid blood group is required (A+, A-, B+, B-, AB+, AB-, O+, O-)', 400);
  }

  const rows = await searchRepo.searchStockByGroup(bloodGroup);
  const availableUnits = rows.length;
  const earliestExpiry = availableUnits > 0 ? rows[0].expiry_date : null;

  const isStaffOrAdmin = ['Staff', 'Admin'].includes(userRole);

  const response = {
    bloodGroup,
    availableUnits,
    earliestExpiry,
    criteria: { bloodGroup },
  };

  // Staff and Admin see Unit IDs and expiry dates; requester/hospital sees count & earliest expiry only (FR-SRCH-02)
  if (isStaffOrAdmin) {
    response.units = rows.map((u) => ({
      unitId: u.unit_id,
      expiryDate: u.expiry_date,
    }));
  }

  // FR-SRCH-05: When a search returns no results, show "No matching results found" with criteria, no error
  if (availableUnits === 0) {
    response.message = 'No matching results found';
  }

  return response;
}

// FR-SRCH-03, FR-SRCH-05, FR-SRCH-06: Eligible donor search
async function searchDonors({ bloodGroup, city, pin, page = 1, limit = 20, actorUserId = null } = {}) {
  if (bloodGroup && !VALID_BLOOD_GROUPS.includes(bloodGroup)) {
    throw new SearchError('INVALID_BLOOD_GROUP', 'Valid blood group is required (A+, A-, B+, B-, AB+, AB-, O+, O-)', 400);
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  // FR-SRCH-06: 20 per page default (accepts up to 100 for backward compatibility with noted deviation)
  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

  const { donors, total } = await searchRepo.searchEligibleDonors({
    bloodGroup,
    city,
    pin,
    page: parsedPage,
    limit: parsedLimit,
  });

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  const criteria = {};
  if (bloodGroup) criteria.bloodGroup = bloodGroup;
  if (city) criteria.city = city;
  if (pin) criteria.pin = pin;

  // Log staff donor search in audit trail for privacy accountability
  if (actorUserId) {
    try {
      await logAudit({
        userId: actorUserId,
        action: 'DONOR_SEARCH_PERFORMED',
        entity: 'donors',
        entityId: null,
        newValue: { criteria, resultCount: donors.length },
      });
    } catch (auditErr) {
      // Don't fail the search response if audit logger is in non-persisted test mode
    }
  }

  const response = {
    donors,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages,
    criteria,
  };

  // FR-SRCH-05: No results message
  if (donors.length === 0) {
    response.message = 'No matching results found';
  }

  return response;
}

module.exports = {
  searchStock,
  searchDonors,
  SearchError,
  VALID_BLOOD_GROUPS,
};
