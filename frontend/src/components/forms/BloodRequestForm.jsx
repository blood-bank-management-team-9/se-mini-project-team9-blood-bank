import React, { useState } from 'react';

export default function BloodRequestForm({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    patientName: '',
    bloodGroup: 'O+',
    units: 1,
    requiredByDate: '',
    hospitalName: 'City General Hospital',
    contactNumber: '',
    priority: 'Normal',
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const validateField = (name, value) => {
    let error = '';
    switch (name) {
      case 'patientName':
        if (!value.trim()) error = 'Patient name is mandatory.';
        break;
      case 'units': {
        const u = parseInt(value, 10);
        /* Specific SAD 4.5 & SRS B.5 requirement: request units validation (1 to 10) */
        if (isNaN(u) || u < 1 || u > 10) {
          error = 'Units requested must be between 1 and 10.';
        }
        break;
      }
      case 'requiredByDate':
        if (!value) error = 'Required-by date is mandatory.';
        break;
      case 'hospitalName':
        if (!value.trim()) error = 'Hospital or care center name is mandatory.';
        break;
      case 'contactNumber':
        if (!value) {
          error = 'Emergency contact number is mandatory.';
        } else if (!/^\d{10}$/.test(value.trim())) {
          error = 'Contact number must be exactly 10 digits.';
        }
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
        <h2 className="panel-title" style={{ fontSize: '1.4rem' }}>Submit Blood Requisition</h2>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
          Hospital and patient blood request. Requisitions are processed via FEFO allocation rules.
        </p>
      </div>

      {submitted ? (
        <div className="alert-banner" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid #86efac' }}>
          ✓ Blood request submitted successfully with status <strong>Pending</strong>. Staff will review immediately!
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {/* Patient Name */}
            <div className="form-group full-width">
              <label className="form-label" htmlFor="patientName">
                Patient Full Name <span className="req">*</span>
              </label>
              <input
                id="patientName"
                name="patientName"
                type="text"
                className={`form-input ${errors.patientName ? 'has-error' : ''}`}
                value={formData.patientName}
                onChange={handleChange}
                placeholder="Patient requiring transfusion"
              />
              {errors.patientName && <div className="inline-error" role="alert">{errors.patientName}</div>}
            </div>

            {/* Blood Group */}
            <div className="form-group">
              <label className="form-label" htmlFor="bloodGroup">
                Requested Blood Group <span className="req">*</span>
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

            {/* Units Requested with inline validation (1 to 10) */}
            <div className="form-group">
              <label className="form-label" htmlFor="units">
                Units Requested (1–10) <span className="req">*</span>
              </label>
              <input
                id="units"
                name="units"
                type="number"
                min="1"
                max="10"
                className={`form-input ${errors.units ? 'has-error' : ''}`}
                value={formData.units}
                onChange={handleChange}
              />
              {errors.units && <div className="inline-error" role="alert">{errors.units}</div>}
            </div>

            {/* Hospital Name */}
            <div className="form-group full-width">
              <label className="form-label" htmlFor="hospitalName">
                Hospital / Clinic Name <span className="req">*</span>
              </label>
              <input
                id="hospitalName"
                name="hospitalName"
                type="text"
                className={`form-input ${errors.hospitalName ? 'has-error' : ''}`}
                value={formData.hospitalName}
                onChange={handleChange}
              />
              {errors.hospitalName && <div className="inline-error" role="alert">{errors.hospitalName}</div>}
            </div>

            {/* Required-by Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="requiredByDate">
                Required By Date <span className="req">*</span>
              </label>
              <input
                id="requiredByDate"
                name="requiredByDate"
                type="date"
                className={`form-input ${errors.requiredByDate ? 'has-error' : ''}`}
                value={formData.requiredByDate}
                onChange={handleChange}
              />
              {errors.requiredByDate && <div className="inline-error" role="alert">{errors.requiredByDate}</div>}
            </div>

            {/* Priority */}
            <div className="form-group">
              <label className="form-label" htmlFor="priority">
                Urgency Priority <span className="req">*</span>
              </label>
              <select
                id="priority"
                name="priority"
                className="form-select"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent (Emergency Transfusion)</option>
              </select>
            </div>

            {/* Contact Number */}
            <div className="form-group full-width">
              <label className="form-label" htmlFor="contactNumber">
                Emergency Contact Number (10 digits) <span className="req">*</span>
              </label>
              <input
                id="contactNumber"
                name="contactNumber"
                type="tel"
                maxLength="10"
                className={`form-input ${errors.contactNumber ? 'has-error' : ''}`}
                placeholder="9876543210"
                value={formData.contactNumber}
                onChange={handleChange}
              />
              {errors.contactNumber && <div className="inline-error" role="alert">{errors.contactNumber}</div>}
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {onCancel && (
              <button type="button" className="btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn-primary">
              Submit Requisition
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
