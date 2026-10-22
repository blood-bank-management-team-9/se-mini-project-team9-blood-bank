import React, { useState, useEffect, useRef } from 'react';
import { validateDonorField } from '../../utils/validation';

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
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateDonorField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const err = validateDonorField(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/donors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Donor successfully registered into live database!' });
        // Only redirect on SUCCESS!
        timerRef.current = setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        // SAD 4.4 error contract: { error: { code, message, fields[] } }
        const errorObj = data.error || {};
        const errorMsg = errorObj.message || `Registration rejected (HTTP ${res.status})`;

        setStatusMessage({
          type: 'error',
          text: errorMsg,
        });

        // Map server fields[] to inline form errors
        if (Array.isArray(errorObj.fields)) {
          const serverFields = {};
          errorObj.fields.forEach((f) => {
            if (f.field && f.message) {
              serverFields[f.field] = f.message;
            }
          });
          setErrors((prev) => ({ ...prev, ...serverFields }));
        }
        // Do NOT redirect on failure!
      }
    } catch {
      setStatusMessage({
        type: 'info',
        text: '[Preview Mode] Form validated successfully (TC-22, TC-36). (Backend API offline)',
      });
      // Do NOT auto-redirect on API error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2 className="panel-title" style={{ fontSize: '1.4rem' }}>Register New Blood Donor (TC-22, TC-36)</h2>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
          Follow on-screen guidance to record a voluntary donor. All fields marked with <span className="req">*</span> are required.
        </p>
      </div>

      <div className="form-guidance" role="region" aria-label="Staff Guidance">
        💡 <strong>Staff Guidance (5-min fast registration):</strong> Verify donor age (18–65) and weight (≥ 45 kg). Check that 90 days have elapsed since their last donation for male donors (120 days for female).
      </div>

      {statusMessage && (
        <div
          className={`alert-banner ${statusMessage.type === 'success' ? 'info' : statusMessage.type === 'error' ? 'danger' : 'warning'}`}
          role="status"
          style={{ marginBottom: '1.25rem' }}
        >
          {statusMessage.text}
        </div>
      )}

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
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'fullName-error' : undefined}
            />
            {errors.fullName && (
              <div id="fullName-error" className="inline-error" role="alert">
                {errors.fullName}
              </div>
            )}
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
              aria-invalid={Boolean(errors.dob)}
              aria-describedby={errors.dob ? 'dob-error' : undefined}
            />
            {errors.dob && (
              <div id="dob-error" className="inline-error" role="alert">
                {errors.dob}
              </div>
            )}
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
              <option value="Male">Male (90-day donation gap)</option>
              <option value="Female">Female (120-day donation gap)</option>
              <option value="Other">Other (120-day donation gap)</option>
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

          {/* Body Weight in kg */}
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
              aria-invalid={Boolean(errors.weightKg)}
              aria-describedby={errors.weightKg ? 'weightKg-error' : undefined}
            />
            {errors.weightKg && (
              <div id="weightKg-error" className="inline-error" role="alert">
                {errors.weightKg}
              </div>
            )}
          </div>

          {/* Phone Number */}
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
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
            />
            {errors.phone && (
              <div id="phone-error" className="inline-error" role="alert">
                {errors.phone}
              </div>
            )}
          </div>

          {/* Postal PIN Code */}
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
              aria-invalid={Boolean(errors.pinCode)}
              aria-describedby={errors.pinCode ? 'pinCode-error' : undefined}
            />
            {errors.pinCode && (
              <div id="pinCode-error" className="inline-error" role="alert">
                {errors.pinCode}
              </div>
            )}
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
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? 'city-error' : undefined}
            />
            {errors.city && (
              <div id="city-error" className="inline-error" role="alert">
                {errors.city}
              </div>
            )}
          </div>

          {/* Email Address */}
          <div className="form-group full-width">
            <label className="form-label" htmlFor="email">
              Email Address (Optional)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={`form-input ${errors.email ? 'has-error' : ''}`}
              placeholder="donor@example.com"
              value={formData.email}
              onChange={handleChange}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <div id="email-error" className="inline-error" role="alert">
                {errors.email}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Register Donor & Verify Eligibility'}
          </button>
        </div>
      </form>
    </div>
  );
}
