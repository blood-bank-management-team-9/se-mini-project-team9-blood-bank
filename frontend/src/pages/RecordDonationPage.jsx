import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiPost, apiGet } from '../services/api';

export default function RecordDonationPage({ onNavigate }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    donorId: '',
    collectionDate: new Date().toISOString().split('T')[0],
    volumeMl: 450,
    screeningStatus: 'Passed',
    medicalNotes: '',
  });

  const [eligibility, setEligibility] = useState(null);
  const [eligLoading, setEligLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Watch the donorId and fetch eligibility when it looks valid
  useEffect(() => {
    const { donorId } = formData;
    if (!/^DNR-\d{5}$/.test(donorId)) {
      setEligibility(null);
      return;
    }

    let cancelled = false;
    setEligLoading(true);
    setEligibility(null);

    apiGet(`/api/donors/${donorId}/eligibility`)
      .then((data) => {
        if (!cancelled) setEligibility(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setEligibility({ error: err.message || 'Donor not found' });
        }
      })
      .finally(() => {
        if (!cancelled) setEligLoading(false);
      });

    return () => { cancelled = true; };
  }, [formData.donorId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setStatusMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!formData.donorId) {
      setErrors({ donorId: 'Donor ID is required.' });
      return;
    }
    if (!/^DNR-\d{5}$/.test(formData.donorId)) {
      setErrors({ donorId: 'Donor ID must use the DNR-00000 format.' });
      return;
    }
    if (eligibility && eligibility.eligible === false) {
      setStatusMessage({ type: 'error', text: 'Cannot record: donor is currently not eligible.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        donorId: formData.donorId,
        collectionDate: formData.collectionDate,
        volumeMl: parseInt(formData.volumeMl, 10),
        screeningStatus: formData.screeningStatus,
        medicalNotes: formData.medicalNotes || undefined,
      };
      const result = await apiPost('/api/donations', payload);
      setStatusMessage({
        type: 'success',
        text: `Donation recorded. Unit ID: ${result.unitId} (Expires: ${result.expiryDate})`,
      });
      setFormData({
        donorId: '',
        collectionDate: new Date().toISOString().split('T')[0],
        volumeMl: 450,
        screeningStatus: 'Passed',
        medicalNotes: '',
      });
      setEligibility(null);
    } catch (err) {
      if (err.type === 'validation') {
        const serverFields = {};
        (err.fields || []).forEach((f) => { serverFields[f.field] = f.message; });
        setErrors(serverFields);
        setStatusMessage({ type: 'error', text: err.message });
      } else if (err.code === 'NOT_ELIGIBLE') {
        setStatusMessage({ type: 'error', text: `Donor is not eligible: ${err.message}` });
      } else {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to record donation' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEligibilityBanner = () => {
    if (eligLoading) {
      return <div className="alert-banner info">Checking donor eligibility…</div>;
    }
    if (!eligibility) return null;

    if (eligibility.error) {
      return (
        <div className="alert-banner danger" role="alert">
          <span className="alert-badge-label">ERROR</span>
          <span>{eligibility.error}</span>
        </div>
      );
    }

    if (eligibility.eligible) {
      return (
        <div className="alert-banner" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid #86efac' }} role="status">
          <span className="alert-badge-label">ELIGIBLE</span>
          <span>This donor is eligible to donate today.</span>
        </div>
      );
    }

    return (
      <div className="alert-banner danger" role="alert">
        <span className="alert-badge-label">NOT ELIGIBLE</span>
        <span>
          {eligibility.ineligibilityReasons?.map((r) => r.message).join(' · ') || 'Donor is not eligible.'}
          {eligibility.nextEligibleDate && (
            <> · Next eligible date: <strong>{eligibility.nextEligibleDate}</strong></>
          )}
        </span>
      </div>
    );
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2 className="panel-title" style={{ fontSize: '1.4rem' }}>Record Donation</h2>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
          Staff only — log a blood donation and create the resulting blood unit.
        </p>
      </div>

      {statusMessage && (
        <div className={`alert-banner ${statusMessage.type === 'success' ? 'info' : 'danger'}`} role="status" style={{ marginBottom: '1.25rem' }}>
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label" htmlFor="donorId">
              Donor ID (DNR-00000) <span className="req">*</span>
            </label>
            <input
              id="donorId" name="donorId" type="text"
              className={`form-input ${errors.donorId ? 'has-error' : ''}`}
              placeholder="e.g. DNR-00001"
              value={formData.donorId}
              onChange={handleChange}
            />
            {errors.donorId && <div className="inline-error" role="alert">{errors.donorId}</div>}
          </div>

          {/* Eligibility banner appears here when a valid donorId is typed */}
          <div className="form-group full-width">
            {renderEligibilityBanner()}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="collectionDate">
              Collection Date <span className="req">*</span>
            </label>
            <input
              id="collectionDate" name="collectionDate" type="date"
              className="form-input"
              value={formData.collectionDate}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="volumeMl">
              Volume (ml) <span className="req">*</span>
            </label>
            <select id="volumeMl" name="volumeMl" className="form-select" value={formData.volumeMl} onChange={handleChange}>
              <option value="350">350 ml</option>
              <option value="450">450 ml</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="screeningStatus">
              Screening Status <span className="req">*</span>
            </label>
            <select id="screeningStatus" name="screeningStatus" className="form-select" value={formData.screeningStatus} onChange={handleChange}>
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <div className="form-group full-width">
            <label className="form-label" htmlFor="medicalNotes">Medical Notes (optional)</label>
            <textarea
              id="medicalNotes" name="medicalNotes" className="form-input" rows="3"
              value={formData.medicalNotes} onChange={handleChange}
            />
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => onNavigate && onNavigate('dashboard')} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || (eligibility && eligibility.eligible === false)}
          >
            {isSubmitting ? 'Recording…' : 'Record Donation'}
          </button>
        </div>
      </form>
    </div>
  );
}