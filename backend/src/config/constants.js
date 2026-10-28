// System-wide domain constants (SAD 3.6, SRS Appendix B)

const VALID_BLOOD_GROUPS = Object.freeze([
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
]);

const STOCK_STATUSES = Object.freeze([
  'Available',
  'Reserved',
  'Issued',
  'Expired',
  'Discarded',
]);

const REQUEST_STATUSES = Object.freeze([
  'Pending',
  'Approved',
  'Rejected',
  'Issued',
  'Cancelled',
]);

const DONATION_SCREENING_STATUSES = Object.freeze([
  'Passed',
  'Failed',
]);

module.exports = {
  VALID_BLOOD_GROUPS,
  STOCK_STATUSES,
  REQUEST_STATUSES,
  DONATION_SCREENING_STATUSES,
};
