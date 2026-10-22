import React, { useState, useEffect, useRef } from 'react';
import { validateBloodRequestField } from '../../utils/validation';

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
    const error = validateBloodRequestField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const err = validateBloodRequestField(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Blood requisition submitted successfully with status Pending.' });
        // Only redirect on SUCCESS!
        timerRef.current = setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        // SAD 4.4 error contract: { error: { code, message, fields[] } }
        const errorObj = data.error || {};
        const errorMsg = errorObj.message || `Request rejected by server (HTTP ${res.status})`;

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
      // Offline / standalone preview mode notice
      setStatusMessage({
        type: 'info',
        text: '[Preview Mode] Requisition validated successfully (TC-13). (Backend API offline)',
      });
      // Do NOT auto-redirect on API error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2 className="panel-title" style={{ fontSize: '1.4rem' }}>Submit Blood Requisition (TC-13)</h2>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
          Hospital and patient blood request. Requisitions are queued and allocated via FEFO rules.
        </p>
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
              placeholder="Full name of patient"
              aria-invalid={Boolean(errors.patientName)}
              aria-describedby={errors.patientName ? 'patientName-error' : undefined}
            />
            {errors.patientName && (
              <div id="patientName-error" className="inline-error" role="alert">
                {errors.patientName}
              </div>
            )}
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

          {/* Units Requested with inline integer validation (1 to 10) */}
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
              step="1"
              className={`form-input ${errors.units ? 'has-error' : ''}`}
              value={formData.units}
              onChange={handleChange}
              aria-invalid={Boolean(errors.units)}
              aria-describedby={errors.units ? 'units-error' : undefined}
            />
            {errors.units && (
              <div id="units-error" className="inline-error" role="alert">
                {errors.units}
              </div>
            )}
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
              aria-invalid={Boolean(errors.hospitalName)}
              aria-describedby={errors.hospitalName ? 'hospitalName-error' : undefined}
            />
            {errors.hospitalName && (
              <div id="hospitalName-error" className="inline-error" role="alert">
                {errors.hospitalName}
              </div>
            )}
          </div>

          {/* Required-by Date with past date rejection (TC-13) */}
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
              aria-invalid={Boolean(errors.requiredByDate)}
              aria-describedby={errors.requiredByDate ? 'requiredByDate-error' : undefined}
            />
            {errors.requiredByDate && (
              <div id="requiredByDate-error" className="inline-error" role="alert">
                {errors.requiredByDate}
              </div>
            )}
          </div>

          {/* Urgency Priority */}
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
              <option value="Urgent">Urgent (Priority Allocation)</option>
            </select>
          </div>

          {/* Emergency Contact Number */}
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
              aria-invalid={Boolean(errors.contactNumber)}
              aria-describedby={errors.contactNumber ? 'contactNumber-error' : undefined}
            />
            {errors.contactNumber && (
              <div id="contactNumber-error" className="inline-error" role="alert">
                {errors.contactNumber}
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
            {isSubmitting ? 'Submitting...' : 'Submit Requisition'}
          </button>
        </div>
      </form>
    </div>
  );
}
