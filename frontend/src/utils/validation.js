/**
 * Form validation utilities as mandated by SRS Appendix B and SAD 4.5
 * Supporting TC-07, TC-13, TC-22, TC-24, TC-28, TC-36
 */

export function calculateAge(dobString) {
  if (!dobString) return 0;
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function validateDonorField(name, value) {
  switch (name) {
    case 'fullName':
      if (!value || !value.trim()) return 'Full name is mandatory.';
      if (value.trim().length > 60) return 'Full name cannot exceed 60 characters.';
      return '';

    case 'dob': {
      if (!value) return 'Date of birth is required.';
      const age = calculateAge(value);
      if (age < 18 || age > 65) {
        return `Donor must be between 18 and 65 years old (current: ${age < 0 ? 0 : age}).`;
      }
      return '';
    }

    case 'weightKg': {
      if (value === '' || value === null || value === undefined) return 'Weight is mandatory.';
      const weight = parseFloat(value);
      if (isNaN(weight) || weight < 45) {
        return 'Weight must be at least 45 kg to donate blood safely (FR-DON-04).';
      }
      return '';
    }

    case 'phone':
      if (!value) return 'Contact phone number is mandatory.';
      if (!/^\d{10}$/.test(String(value).trim())) {
        return 'Phone number must be exactly 10 digits.';
      }
      return '';

    case 'pinCode':
      if (!value) return 'Postal PIN code is mandatory.';
      if (!/^\d{6}$/.test(String(value).trim())) {
        return 'PIN code must be exactly 6 digits.';
      }
      return '';

    case 'city':
      if (!value || !value.trim()) return 'City is mandatory.';
      return '';

    case 'email':
      if (value && value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) return 'Please enter a valid email address.';
      }
      return '';

    default:
      return '';
  }
}

export function validateBloodRequestField(name, value) {
  switch (name) {
    case 'patientName':
      if (!value || !value.trim()) return 'Patient name is mandatory.';
      if (value.trim().length > 60) return 'Patient name cannot exceed 60 characters.';
      return '';

    case 'units': {
      if (value === '' || value === null || value === undefined) return 'Units requested is mandatory.';
      const num = Number(value);
      if (!Number.isInteger(num) || num < 1 || num > 10) {
        return 'Units requested must be an integer between 1 and 10 (SRS B.5).';
      }
      return '';
    }

    case 'requiredByDate': {
      if (!value) return 'Required-by date is mandatory.';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const chosen = new Date(value);
      if (chosen < today) {
        return 'Required-by date cannot be in the past (TC-13).';
      }
      return '';
    }

    case 'hospitalName':
      if (!value || !value.trim()) return 'Hospital or clinic name is mandatory.';
      return '';

    case 'contactNumber':
      if (!value) return 'Emergency contact number is mandatory.';
      if (!/^\d{10}$/.test(String(value).trim())) {
        return 'Contact number must be exactly 10 digits.';
      }
      return '';

    default:
      return '';
  }
}

export function calculateEligibility(gender, lastDonationDate) {
  if (!lastDonationDate) {
    return { eligible: true, message: 'Eligible to donate today' };
  }

  const gapDays = gender === 'Male' ? 90 : 120; // BR-03
  const lastDate = new Date(lastDonationDate);
  const nextEligible = new Date(lastDate);
  nextEligible.setDate(nextEligible.getDate() + gapDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today >= nextEligible) {
    return { eligible: true, message: 'Eligible to donate today' };
  }

  const diffTime = nextEligible.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const dateFormatted = nextEligible.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return {
    eligible: false,
    nextDate: dateFormatted,
    daysRemaining: diffDays,
    message: `Ineligible (Next eligible date: ${dateFormatted} — ${diffDays} days remaining)`,
  };
}
