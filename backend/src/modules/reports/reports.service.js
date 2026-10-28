// C11 Report Service — Business Logic (SAD 3.4, 4.3, SRS 5.8)

const reportsRepo = require('./reports.repository');
const { logAudit } = require('../audit/audit.repository');
const {
  VALID_BLOOD_GROUPS,
  STOCK_STATUSES,
  REQUEST_STATUSES,
  DONATION_SCREENING_STATUSES,
} = require('../../config/constants');

class ReportError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ReportError';
    this.code = code;
    this.publicMessage = message;
    this.status = status;
  }
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(str) {
  if (!DATE_REGEX.test(str)) return false;
  const [year, month, day] = str.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateFilters({ from, to, bloodGroup, status }, validStatuses) {
  if (bloodGroup && !VALID_BLOOD_GROUPS.includes(bloodGroup)) {
    throw new ReportError('INVALID_BLOOD_GROUP', 'Invalid blood group filter', 400);
  }
  if (status && validStatuses && !validStatuses.includes(status)) {
    throw new ReportError('INVALID_STATUS', `Invalid status filter (allowed: ${validStatuses.join(', ')})`, 400);
  }
  if (from && !isValidDateString(from)) {
    throw new ReportError('INVALID_DATE', 'Invalid "from" date format (YYYY-MM-DD expected)', 400);
  }
  if (to && !isValidDateString(to)) {
    throw new ReportError('INVALID_DATE', 'Invalid "to" date format (YYYY-MM-DD expected)', 400);
  }
  if (from && to && from > to) {
    throw new ReportError('INVALID_DATE_RANGE', '"from" date must be earlier than or equal to "to" date', 400);
  }
}

async function recordReportAudit(actorUserId, reportType, criteria) {
  if (!actorUserId) return;
  try {
    await logAudit({
      userId: actorUserId,
      action: 'REPORT_GENERATED',
      entity: 'reports',
      entityId: reportType,
      newValue: { criteria },
    });
  } catch (err) {
    // Non-fatal if audit repository is unpersisted in test
  }
}

// FR-RPT-01: Stock Report
async function generateStockReport(filters = {}, actorUserId = null) {
  validateFilters(filters, STOCK_STATUSES);

  const data = await reportsRepo.getStockReport(filters);

  const criteria = {};
  if (filters.from) criteria.from = filters.from;
  if (filters.to) criteria.to = filters.to;
  if (filters.bloodGroup) criteria.bloodGroup = filters.bloodGroup;
  if (filters.status) criteria.status = filters.status;

  await recordReportAudit(actorUserId, 'stock', criteria);

  const response = {
    reportType: 'stock',
    generatedAt: new Date().toISOString(),
    criteria,
    aggregates: data.aggregates,
    records: data.records,
    totalRecords: data.totalUnits,
  };

  if (data.totalUnits === 0) {
    response.message = 'No records found';
  }

  return response;
}

// FR-RPT-02: Donation Report
async function generateDonationReport(filters = {}, actorUserId = null) {
  validateFilters(filters, DONATION_SCREENING_STATUSES);

  const data = await reportsRepo.getDonationReport(filters);

  const criteria = {};
  if (filters.from) criteria.from = filters.from;
  if (filters.to) criteria.to = filters.to;
  if (filters.bloodGroup) criteria.bloodGroup = filters.bloodGroup;
  if (filters.status) criteria.status = filters.status;

  await recordReportAudit(actorUserId, 'donation', criteria);

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
async function generateRequestReport(filters = {}, actorUserId = null) {
  validateFilters(filters, REQUEST_STATUSES);

  const data = await reportsRepo.getRequestReport(filters);

  const criteria = {};
  if (filters.from) criteria.from = filters.from;
  if (filters.to) criteria.to = filters.to;
  if (filters.bloodGroup) criteria.bloodGroup = filters.bloodGroup;
  if (filters.status) criteria.status = filters.status;

  await recordReportAudit(actorUserId, 'request', criteria);

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
  validateFilters,
  ReportError,
  VALID_BLOOD_GROUPS,
  STOCK_STATUSES,
  REQUEST_STATUSES,
  DONATION_SCREENING_STATUSES,
};
