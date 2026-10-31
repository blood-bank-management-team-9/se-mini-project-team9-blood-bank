import React, { useState } from 'react';
import { apiPost } from '../services/api';

export default function ResetPasswordPage({ token: initialToken, onNavigate }) {
  const [form, setForm] = useState({ token: initialToken || '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setGlobalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setGlobalError('');
    try {
      await apiPost('/api/auth/reset-password', form);
      setSuccess('Password reset successfully. Redirecting to sign in…');
      setTimeout(() => onNavigate('login'), 2000);
    } catch (err) {
      if (err.type === 'validation') {
        const fieldMap = {};
        (err.fields || []).forEach((f) => { fieldMap[f.field] = f.message; });
        setErrors(fieldMap);
      } else if (err.type === 'network') {
        setGlobalError('Cannot reach the server.');
      } else {
        setGlobalError(err.message || 'Reset failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container" style={{ maxWidth: '440px', margin: '4rem auto' }}>
      <div className="form-header">
        <h2 className="panel-title" style={{ fontSize: '1.5rem' }}>Reset Password</h2>
      </div>

      {globalError && <div className="alert-banner danger" role="alert" style={{ marginBottom: '1rem' }}>{globalError}</div>}
      {success && <div className="alert-banner info" role="status" style={{ marginBottom: '1rem' }}>{success}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="rp-token">Reset Token <span className="req">*</span></label>
          <input
            id="rp-token" name="token" type="text"
            className={`form-input ${errors.token ? 'has-error' : ''}`}
            value={form.token} onChange={handleChange}
          />
          {errors.token && <div className="inline-error" role="alert">{errors.token}</div>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="rp-pw">New Password <span className="req">*</span></label>
          <input
            id="rp-pw" name="newPassword" type="password" autoComplete="new-password"
            className={`form-input ${errors.newPassword ? 'has-error' : ''}`}
            value={form.newPassword} onChange={handleChange}
          />
          {errors.newPassword && <div className="inline-error" role="alert">{errors.newPassword}</div>}
        </div>

        <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}
