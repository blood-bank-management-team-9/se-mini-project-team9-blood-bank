import { describe, it, expect } from 'vitest';
import {
  validateDonorField,
  validateBloodRequestField,
  calculateEligibility,
} from '../utils/validation';

describe('Donor Validation Rules (TC-22, FR-DON-04, SAD 4.5)', () => {
  it('rejects weight below 45 kg', () => {
    expect(validateDonorField('weightKg', 44)).toMatch(/at least 45 kg/i);
    expect(validateDonorField('weightKg', 40)).toMatch(/at least 45 kg/i);
    expect(validateDonorField('weightKg', '')).toMatch(/mandatory/i);
  });

  it('accepts weight 45 kg or above', () => {
    expect(validateDonorField('weightKg', 45)).toBe('');
    expect(validateDonorField('weightKg', 70.5)).toBe('');
  });

  it('validates 10-digit phone number', () => {
    expect(validateDonorField('phone', '12345')).toMatch(/exactly 10 digits/i);
    expect(validateDonorField('phone', '98765432101')).toMatch(/exactly 10 digits/i);
    expect(validateDonorField('phone', 'abcdefghij')).toMatch(/exactly 10 digits/i);
    expect(validateDonorField('phone', '9876543210')).toBe('');
  });

  it('validates 6-digit postal PIN code', () => {
    expect(validateDonorField('pinCode', '5600')).toMatch(/exactly 6 digits/i);
    expect(validateDonorField('pinCode', '5600012')).toMatch(/exactly 6 digits/i);
    expect(validateDonorField('pinCode', '560001')).toBe('');
  });

  it('validates donor age between 18 and 65 years', () => {
    // Under 18
    const underAge = new Date();
    underAge.setFullYear(underAge.getFullYear() - 17);
    expect(validateDonorField('dob', underAge.toISOString().split('T')[0])).toMatch(/between 18 and 65/i);

    // Over 65
    const overAge = new Date();
    overAge.setFullYear(overAge.getFullYear() - 66);
    expect(validateDonorField('dob', overAge.toISOString().split('T')[0])).toMatch(/between 18 and 65/i);

    // Eligible 25 years old
    const validAge = new Date();
    validAge.setFullYear(validAge.getFullYear() - 25);
    expect(validateDonorField('dob', validAge.toISOString().split('T')[0])).toBe('');
  });

  it('validates email format if entered', () => {
    expect(validateDonorField('email', 'bademail')).toMatch(/valid email/i);
    expect(validateDonorField('email', 'donor@example.com')).toBe('');
    expect(validateDonorField('email', '')).toBe(''); // Optional
  });
});

describe('Blood Request Validation Rules (TC-13, SRS B.5, SAD 4.5)', () => {
  it('enforces units requested as integer between 1 and 10', () => {
    expect(validateBloodRequestField('units', 0)).toMatch(/between 1 and 10/i);
    expect(validateBloodRequestField('units', 11)).toMatch(/between 1 and 10/i);
    expect(validateBloodRequestField('units', 1.5)).toMatch(/integer between 1 and 10/i);
    expect(validateBloodRequestField('units', 1)).toBe('');
    expect(validateBloodRequestField('units', 10)).toBe('');
  });

  it('rejects requiredByDate in the past (TC-13 / SAD 4.3)', () => {
    expect(validateBloodRequestField('requiredByDate', '2020-01-01')).toMatch(/cannot be in the past/i);

    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(validateBloodRequestField('requiredByDate', future.toISOString().split('T')[0])).toBe('');
  });

  it('validates contact number format', () => {
    expect(validateBloodRequestField('contactNumber', '98765')).toMatch(/exactly 10 digits/i);
    expect(validateBloodRequestField('contactNumber', '9876543210')).toBe('');
  });
});

describe('Donation Eligibility Engine (BR-03, FR-DON-04)', () => {
  it('correctly flags donor as ineligible if 90 days have not passed for male', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 21); // 21 days ago
    const result = calculateEligibility('Male', recentDate.toISOString().split('T')[0]);
    expect(result.eligible).toBe(false);
    expect(result.daysRemaining).toBeGreaterThanOrEqual(69);
    expect(result.message).toMatch(/Ineligible/);
  });

  it('flags donor as eligible when donation was more than 90 days ago', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 95);
    const result = calculateEligibility('Male', pastDate.toISOString().split('T')[0]);
    expect(result.eligible).toBe(true);
    expect(result.message).toBe('Eligible to donate today');
  });

  it('flags first-time donor with no prior donations as eligible', () => {
    const result = calculateEligibility('Male', null);
    expect(result.eligible).toBe(true);
  });
});
