// C11 Report Service — Business Logic (SAD 3.4, 4.3, SRS 5.8)

const reportsRepo = require('./reports.repository');

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VALID_STOCK_STATUSES = ['Available', 'Reserved', 'Issued', 'Expired', 'Discarded'];
const VALID_DONATION_STATUSES = ['Recorded', 'Failed Screening'];
const VALID_REQUEST_STATUSES = ['Pending', 'Approved', 'Rejected', 'Issued', 'Cancelled'];

class ReportError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ReportError';
    this.code = code;
    this.publicMessage = message;
    this.status = status;
  }
}

function validateFilters({ from, to, bloodGroup, status }, validStatuses) {
  if (bloodGroup && !VALID_BLOOD_GROUPS.includes(bloodGroup)) {
    throw new ReportError('INVALID_BLOOD_GROUP', 'Invalid blood group filter', 400);
  }
  if (status && validStatuses && !validStatuses.includes(status)) {
    throw new ReportError('INVALID_STATUS', `Invalid status filter (allowed: ${validStatuses.join(', ')})`, 400);
  }
  if (from && isNaN(Date.parse(from))) {
    throw new ReportError('INVALID_DATE', 'Invalid "from" date format (YYYY-MM-DD expected)', 400);
  }
  if (to && isNaN(Date.parse(to))) {
    throw new ReportError('INVALID_DATE', 'Invalid "to" date format (YYYY-MM-DD expected)', 400);
  }
  if (from && to && new Date(from) > new Date(to)) {
    throw new ReportError('INVALID_DATE_RANGE', '"from" date must be earlier than or equal to "to" date', 400);
  }
}

// FR-RPT-01: Stock Report
async function generateStockReport(filters = {}) {
  validateFilters(filters, VALID_STOCK_STATUSES);

  const data = await reportsRepo.getStockReport(filters);

  const criteria = {};
  if (filters.from) criteria.from = filters.from;
  if (filters.to) criteria.to = filters.to;
  if (filters.bloodGroup) criteria.bloodGroup = filters.bloodGroup;
  if (filters.status) criteria.status = filters.status;

  const response = {
    reportType: 'stock',
    generatedAt: new Date().toISOString(),
    criteria,
    aggregates: data.aggregates,
    records: data.records,
    totalRecords: data.totalUnits,
  };

  // FR-RPT-06: Showing "No records found" when a search returns no data
  if (data.totalUnits === 0) {
    response.message = 'No records found';
  }

  return response;
}

// FR-RPT-02: Donation Report
async function generateDonationReport(filters = {}) {
  validateFilters(filters, VALID_DONATION_STATUSES);

  const data = await reportsRepo.getDonationReport(filters);

  const criteria = {};
  if (filters.from) criteria.from = filters.from;
  if (filters.to) criteria.to = filters.to;
  if (filters.bloodGroup) criteria.bloodGroup = filters.bloodGroup;
  if (filters.status) criteria.status = filters.status;

  const response = {
    reportType: 'donation',
    generatedAt: new Date().toISOString(),
    criteria,
    summary: {
      totalDonations: data.totalDonations,
      totalVolumeMl: data.totalVolumeMl,
    },
    records: data.records,
    totalRecords: data.totalDonations,
  };

  if (data.totalDonations === 0) {
    response.message = 'No records found';
  }

  return response;
}

// FR-RPT-03: Request Report
async function generateRequestReport(filters = {}) {
  validateFilters(filters, VALID_REQUEST_STATUSES);

  const data = await reportsRepo.getRequestReport(filters);

  const criteria = {};
  if (filters.from) criteria.from = filters.from;
  if (filters.to) criteria.to = filters.to;
  if (filters.bloodGroup) criteria.bloodGroup = filters.bloodGroup;
  if (filters.status) criteria.status = filters.status;

  const response = {
    reportType: 'request',
    generatedAt: new Date().toISOString(),
    criteria,
    summary: {
      totalRequests: data.totalRequests,
      totalUnitsRequested: data.totalUnitsRequested,
    },
    records: data.records,
    totalRecords: data.totalRequests,
  };

  if (data.totalRequests === 0) {
    response.message = 'No records found';
  }

  return response;
}

module.exports = {
  generateStockReport,
  generateDonationReport,
  generateRequestReport,
  ReportError,
  VALID_BLOOD_GROUPS,
};
