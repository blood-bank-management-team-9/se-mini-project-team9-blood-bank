import React, { useState } from 'react';

export default function DonorRegistrationForm({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    gender: 'Male',
    bloodGroup: 'O+',
    weightKg: '',
    phone: '',
    email: '',
    city: 'Bangalore',
    pinCode: '',
    address: '',
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const validateField = (name, value) => {
    let error = '';
    switch (name) {
      case 'fullName':
        if (!value.trim()) error = 'Full name is mandatory.';
        break;
      case 'dob': {
        if (!value) {
          error = 'Date of birth is required.';
        } else {
          const birthDate = new Date(value);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
          if (age < 18 || age > 65) {
            error = `Donor must be between 18 and 65 years old (current: ${age < 0 ? 0 : age}).`;
          }
        }
        break;
      }
      case 'weightKg':
        if (!value) {
          error = 'Weight is mandatory.';
        } else if (parseFloat(value) < 45) {
          /* Specific SAD 4.5 requirement: donor weight error message */
          error = 'Weight must be at least 45 kg to donate blood safely (FR-DON-04).';
        }
        break;
      case 'phone':
        /* Specific SAD 4.5 requirement: phone number validation */
        if (!value) {
          error = 'Contact phone number is mandatory.';
        } else if (!/^\d{10}$/.test(value.trim())) {
          error = 'Phone number must be exactly 10 digits.';
        }
        break;
      case 'pinCode':
        /* Specific SAD 4.5 requirement: PIN code validation */
        if (!value) {
          error = 'Postal PIN code is mandatory.';
        } else if (!/^\d{6}$/.test(value.trim())) {
          error = 'PIN code must be exactly 6 digits.';
        }
        break;
      case 'city':
        if (!value.trim()) error = 'City is mandatory.';
        break;
      default:
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const err = validateField(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setSubmitted(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2000);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2 className="panel-title" style={{ fontSize: '1.4rem' }}>Register New Blood Donor</h2>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
          Follow on-screen guidance to record a voluntary donor. All fields marked with <span className="req">*</span> are required.
        </p>
      </div>

      {/* On-screen guidance as required by NFR-QUAL-01 / TC-36 */}
      <div className="form-guidance" role="region" aria-label="Staff Guidance">
        💡 <strong>Staff Guidance (5-min fast registration):</strong> Ensure the donor has rested, had water, and meets the age (18–65) and weight (≥ 45 kg) guidelines.
      </div>

      {submitted ? (
        <div className="alert-banner" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid #86efac' }}>
          ✓ Donor successfully registered! Profile and eligibility records have been saved.
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {/* Full Name */}
            <div className="form-group full-width">
              <label className="form-label" htmlFor="fullName">
                Full Name <span className="req">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className={`form-input ${errors.fullName ? 'has-error' : ''}`}
                placeholder="e.g. Ramesh Kumar"
                value={formData.fullName}
                onChange={handleChange}
              />
              {errors.fullName && <div className="inline-error" role="alert">{errors.fullName}</div>}
            </div>

            {/* Date of Birth */}
            <div className="form-group">
              <label className="form-label" htmlFor="dob">
                Date of Birth <span className="req">*</span>
              </label>
              <input
                id="dob"
                name="dob"
                type="date"
                className={`form-input ${errors.dob ? 'has-error' : ''}`}
                value={formData.dob}
                onChange={handleChange}
              />
              {errors.dob && <div className="inline-error" role="alert">{errors.dob}</div>}
            </div>

            {/* Gender */}
            <div className="form-group">
              <label className="form-label" htmlFor="gender">
                Gender <span className="req">*</span>
              </label>
              <select
                id="gender"
                name="gender"
                className="form-select"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="Male">Male (90-day gap)</option>
                <option value="Female">Female (120-day gap)</option>
                <option value="Other">Other (120-day gap)</option>
              </select>
            </div>

            {/* Blood Group */}
            <div className="form-group">
              <label className="form-label" htmlFor="bloodGroup">
                Blood Group <span className="req">*</span>
              </label>
              <select
                id="bloodGroup"
                name="bloodGroup"
                className="form-select"
                value={formData.bloodGroup}
                onChange={handleChange}
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            {/* Weight (kg) with inline validation */}
            <div className="form-group">
              <label className="form-label" htmlFor="weightKg">
                Body Weight (kg) <span className="req">*</span>
              </label>
              <input
                id="weightKg"
                name="weightKg"
                type="number"
                step="0.5"
                className={`form-input ${errors.weightKg ? 'has-error' : ''}`}
                placeholder="Minimum 45 kg"
                value={formData.weightKg}
                onChange={handleChange}
              />
              {errors.weightKg && <div className="inline-error" role="alert">{errors.weightKg}</div>}
            </div>

            {/* Phone Number with inline validation */}
            <div className="form-group">
              <label className="form-label" htmlFor="phone">
                Phone Number (10 digits) <span className="req">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                maxLength="10"
                className={`form-input ${errors.phone ? 'has-error' : ''}`}
                placeholder="9876543210"
                value={formData.phone}
                onChange={handleChange}
              />
              {errors.phone && <div className="inline-error" role="alert">{errors.phone}</div>}
            </div>

            {/* Postal PIN Code with inline validation */}
            <div className="form-group">
              <label className="form-label" htmlFor="pinCode">
                Postal PIN Code (6 digits) <span className="req">*</span>
              </label>
              <input
                id="pinCode"
                name="pinCode"
                type="text"
                maxLength="6"
                className={`form-input ${errors.pinCode ? 'has-error' : ''}`}
                placeholder="560001"
                value={formData.pinCode}
                onChange={handleChange}
              />
              {errors.pinCode && <div className="inline-error" role="alert">{errors.pinCode}</div>}
            </div>

            {/* City */}
            <div className="form-group">
              <label className="form-label" htmlFor="city">
                City <span className="req">*</span>
              </label>
              <input
                id="city"
                name="city"
                type="text"
                className={`form-input ${errors.city ? 'has-error' : ''}`}
                value={formData.city}
                onChange={handleChange}
              />
              {errors.city && <div className="inline-error" role="alert">{errors.city}</div>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address (Optional)</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="donor@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {onCancel && (
              <button type="button" className="btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn-primary">
              Register Donor & Verify Eligibility
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
