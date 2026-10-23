const CONFIG_KEYS = {
  minAge: 'eligibility_min_age',
  maxAge: 'eligibility_max_age',
  minWeightKg: 'eligibility_min_weight_kg',
  maleGapDays: 'eligibility_gap_days_male',
  otherGapDays: 'eligibility_gap_days_other',
};

function readConfigValue(config, key, { minimum = 0, allowDecimal = false } = {}) {
  const rawValue = config[key];
  const value = Number(rawValue);
  if (
    rawValue === undefined ||
    rawValue === null ||
    rawValue === '' ||
    !Number.isFinite(value) ||
    value < minimum ||
    (!allowDecimal && !Number.isInteger(value))
  ) {
    throw new Error(`Invalid or missing donor eligibility configuration: ${key}`);
  }
  return value;
}

function dateOnly(value, fieldName) {
  const date = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid ${fieldName} for donor eligibility`);

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    throw new Error(`Invalid ${fieldName} for donor eligibility`);
  }
  return date;
}

function ageOnDate(dateOfBirth, today) {
  const birthParts = dateOfBirth.split('-').map(Number);
  const todayParts = today.split('-').map(Number);
  let age = todayParts[0] - birthParts[0];
  if (
    todayParts[1] < birthParts[1] ||
    (todayParts[1] === birthParts[1] && todayParts[2] < birthParts[2])
  ) {
    age--;
  }
  return age;
}

function addDays(date, days) {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  return new Date(timestamp + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function evaluateEligibility(donor, config, today = new Date()) {
  const minAge = readConfigValue(config, CONFIG_KEYS.minAge);
  const maxAge = readConfigValue(config, CONFIG_KEYS.maxAge);
  const minWeightKg = readConfigValue(config, CONFIG_KEYS.minWeightKg, {
    minimum: Number.MIN_VALUE,
    allowDecimal: true,
  });
  const maleGapDays = readConfigValue(config, CONFIG_KEYS.maleGapDays);
  const otherGapDays = readConfigValue(config, CONFIG_KEYS.otherGapDays);
  if (maxAge < minAge) {
    throw new Error('Invalid donor eligibility configuration: maximum age is below minimum age');
  }

  const evaluatedAt = dateOnly(today, 'evaluation date');
  const dateOfBirth = dateOnly(donor.date_of_birth, 'date of birth');
  const age = ageOnDate(dateOfBirth, evaluatedAt);
  const weightKg = Number(donor.weight_kg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('Invalid donor weight for eligibility evaluation');
  }

  const ineligibilityReasons = [];
  if (age < minAge) {
    ineligibilityReasons.push({
      code: 'AGE_BELOW_MINIMUM',
      message: `Donor must be at least ${minAge} years old; current age is ${age}.`,
    });
  } else if (age > maxAge) {
    ineligibilityReasons.push({
      code: 'AGE_ABOVE_MAXIMUM',
      message: `Donor must be no older than ${maxAge} years; current age is ${age}.`,
    });
  }
  if (weightKg < minWeightKg) {
    ineligibilityReasons.push({
      code: 'WEIGHT_BELOW_MINIMUM',
      message: `Donor must weigh at least ${minWeightKg} kg; current weight is ${weightKg} kg.`,
    });
  }

  let nextEligibleDate = null;
  if (donor.last_donation_date) {
    const lastDonationDate = dateOnly(donor.last_donation_date, 'last donation date');
    const gapDays = donor.gender === 'Male' ? maleGapDays : otherGapDays;
    nextEligibleDate = addDays(lastDonationDate, gapDays);
    if (evaluatedAt < nextEligibleDate) {
      ineligibilityReasons.push({
        code: 'DONATION_GAP_NOT_MET',
        message: `Donor may donate again on ${nextEligibleDate}; the minimum interval is ${gapDays} days.`,
      });
    } else {
      nextEligibleDate = null;
    }
  }

  return {
    donorId: donor.donor_id,
    eligible: ineligibilityReasons.length === 0,
    evaluatedAt,
    nextEligibleDate,
    ineligibilityReasons,
  };
}

module.exports = { evaluateEligibility };
