const { evaluateEligibility } = require('./donorEligibility');

const DEFAULT_CONFIG = {
  eligibility_min_age: '18',
  eligibility_max_age: '65',
  eligibility_min_weight_kg: '45',
  eligibility_gap_days_male: '90',
  eligibility_gap_days_other: '120',
};

function donor(overrides = {}) {
  return {
    donor_id: 'DNR-00001',
    date_of_birth: '1990-04-12',
    gender: 'Male',
    weight_kg: '58.00',
    last_donation_date: null,
    ...overrides,
  };
}

describe('Donor eligibility engine', () => {
  it('marks a donor eligible when every configured rule is met', () => {
    const result = evaluateEligibility(donor(), DEFAULT_CONFIG, '2026-10-23');

    expect(result).toMatchObject({
      donorId: 'DNR-00001',
      eligible: true,
      evaluatedAt: '2026-10-23',
      nextEligibleDate: null,
      ineligibilityReasons: [],
    });
  });

  it('reports configured age and weight violations together', () => {
    const result = evaluateEligibility(donor({
      date_of_birth: '2008-10-24',
      weight_kg: '44.99',
    }), DEFAULT_CONFIG, '2026-10-23');

    expect(result.ineligibilityReasons).toEqual([
      {
        code: 'AGE_BELOW_MINIMUM',
        message: 'Donor must be at least 18 years old; current age is 17.',
      },
      {
        code: 'WEIGHT_BELOW_MINIMUM',
        message: 'Donor must weigh at least 45 kg; current weight is 44.99 kg.',
      },
    ]);
  });

  it('uses the configured maximum age and accepts the exact boundary', () => {
    const eligibleAtMaximum = evaluateEligibility(
      donor({ date_of_birth: '1961-10-23' }),
      DEFAULT_CONFIG,
      '2026-10-23'
    );
    const tooOld = evaluateEligibility(
      donor({ date_of_birth: '1960-10-23' }),
      DEFAULT_CONFIG,
      '2026-10-23'
    );

    expect(eligibleAtMaximum.eligible).toBe(true);
    expect(tooOld.ineligibilityReasons[0].code).toBe('AGE_ABOVE_MAXIMUM');
  });

  it('reports the date a male donor completes the configured donation gap', () => {
    const result = evaluateEligibility(donor({
      last_donation_date: '2026-07-26',
    }), DEFAULT_CONFIG, '2026-10-23');

    expect(result).toMatchObject({
      eligible: false,
      nextEligibleDate: '2026-10-24',
      ineligibilityReasons: [{
        code: 'DONATION_GAP_NOT_MET',
        message: 'Donor may donate again on 2026-10-24; the minimum interval is 90 days.',
      }],
    });
  });

  it('uses the female/other donation-gap setting and allows donation on its boundary', () => {
    const result = evaluateEligibility(donor({
      gender: 'Other',
      last_donation_date: '2026-06-25',
    }), DEFAULT_CONFIG, '2026-10-23');

    expect(result.eligible).toBe(true);
    expect(result.nextEligibleDate).toBeNull();
  });

  it('responds to changed configuration values instead of fixed thresholds', () => {
    const result = evaluateEligibility(donor({
      date_of_birth: '2005-10-23',
      weight_kg: '50',
    }), {
      ...DEFAULT_CONFIG,
      eligibility_min_age: '22',
      eligibility_min_weight_kg: '55',
    }, '2026-10-23');

    expect(result.ineligibilityReasons.map(({ code }) => code)).toEqual([
      'AGE_BELOW_MINIMUM',
      'WEIGHT_BELOW_MINIMUM',
    ]);
  });

  it('fails explicitly when a required configuration value is missing or invalid', () => {
    expect(() => evaluateEligibility(donor(), {
      ...DEFAULT_CONFIG,
      eligibility_gap_days_male: undefined,
    }, '2026-10-23')).toThrow('Invalid or missing donor eligibility configuration');

    expect(() => evaluateEligibility(donor(), {
      ...DEFAULT_CONFIG,
      eligibility_min_age: 'not-a-number',
    }, '2026-10-23')).toThrow('Invalid or missing donor eligibility configuration');
  });
});
