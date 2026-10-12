const { VOLUMES_ML, SCREENING_STATUSES } = require('./constants');
const { isRealDate, todayInTz } = require('./dates');

const ALLOWED = ['collectionDate', 'volumeMl', 'screeningStatus', 'medicalNotes'];

// Returns { value, fields }. fields[] names each bad field and why (SAD 4.4).
exports.validateCorrection = (body, now = new Date()) => {
  const fields = [];
  const value = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { value, fields: [{ field: 'body', message: 'Send a JSON object with the fields to correct.' }] };
  }
  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) fields.push({ field: key, message: 'This field cannot be corrected.' });
  }
  if (body.collectionDate !== undefined) {
    const s = body.collectionDate;
    if (typeof s !== 'string' || !isRealDate(s)) {
      fields.push({ field: 'collectionDate', message: 'Use a valid date in YYYY-MM-DD format.' });
    } else if (s > todayInTz(now)) {
      fields.push({ field: 'collectionDate', message: 'Collection date cannot be in the future.' });
    } else value.collectionDate = s;
  }
  if (body.volumeMl !== undefined) {
    if (!VOLUMES_ML.includes(body.volumeMl)) fields.push({ field: 'volumeMl', message: 'Volume must be 350 or 450 ml.' });
    else value.volumeMl = body.volumeMl;
  }
  if (body.screeningStatus !== undefined) {
    if (!SCREENING_STATUSES.includes(body.screeningStatus)) {
      fields.push({ field: 'screeningStatus', message: 'Screening status must be Passed or Failed.' });
    } else value.screeningStatus = body.screeningStatus;
  }
  if (body.medicalNotes !== undefined) {
    if (typeof body.medicalNotes !== 'string' || body.medicalNotes.length > 500) {
      fields.push({ field: 'medicalNotes', message: 'Notes must be text of at most 500 characters.' });
    } else value.medicalNotes = body.medicalNotes.trim();
  }
  if (fields.length === 0 && Object.keys(value).length === 0) {
    fields.push({ field: 'body', message: 'Provide at least one field to correct.' });
  }
  return { value, fields };
};

exports.validDonationId = (id) => /^[A-Za-z0-9_-]{1,40}$/.test(id);
