import React, { useState } from 'react';
import { apiPost } from '../services/api';

export default function RegisterPage({ onNavigate }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'Donor',
  });
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
    setSuccess('');
    try {
      await apiPost('/api/auth/register', form);
      setSuccess('Registration successful! You can now sign in.');
      setTimeout(() => onNavigate('login'), 2000);
    } catch (err) {
      if (err.type === 'validation') {
        const fieldMap = {};
        (err.fields || []).forEach((f) => { fieldMap[f.field] = f.message; });
        setErrors(fieldMap);
        setGlobalError(err.message);
      } else if (err.type === 'network') {
        setGlobalError('Cannot reach the server.');
      } else {
        setGlobalError(err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container" style={{ maxWidth: '520px', margin: '3rem auto' }}>
      <div className="form-header">
        <h2 className="panel-title" style={{ fontSize: '1.5rem' }}>Create Account</h2>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
          Register as a Blood Donor or Hospital/Patient.
        </p>
      </div>

      {globalError && (
        <div className="alert-banner danger" role="alert" style={{ marginBottom: '1rem' }}>
          {globalError}
        </div>
      )}
      {success && (
        <div className="alert-banner info" role="status" style={{ marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label" htmlFor="name">Full Name <span className="req">*</span></label>
            <input
              id="name" name="name" type="text" autoComplete="name"
              className={`form-input ${errors.name ? 'has-error' : ''}`}
              value={form.name} onChange={handleChange}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <div className="inline-error" role="alert">{errors.name}</div>}
          </div>

          <div className="form-group full-width">
            <label className="form-label" htmlFor="reg-email">Email <span className="req">*</span></label>
            <input
              id="reg-email" name="email" type="email" autoComplete="email"
              className={`form-input ${errors.email ? 'has-error' : ''}`}
              value={form.email} onChange={handleChange}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <div className="inline-error" role="alert">{errors.email}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-phone">Phone (10 digits) <span className="req">*</span></label>
            <input
              id="reg-phone" name="phone" type="tel" maxLength="10"
              className={`form-input ${errors.phone ? 'has-error' : ''}`}
              value={form.phone} onChange={handleChange}
              aria-invalid={Boolean(errors.phone)}
            />
            {errors.phone && <div className="inline-error" role="alert">{errors.phone}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-role">Role <span className="req">*</span></label>
            <select
              id="reg-role" name="role"
              className="form-select"
              value={form.role} onChange={handleChange}
            >
              <option value="Donor">Donor</option>
              <option value="Hospital/Patient">Hospital / Patient</option>
            </select>
          </div>

          <div className="form-group full-width">
            <label className="form-label" htmlFor="reg-password">
              Password <span className="req">*</span>
              <span style={{ fontWeight: 400, color: 'var(--slate-500)', marginLeft: '0.4rem', fontSize: '0.8rem' }}>
                (min 8 chars, 1 upper, 1 lower, 1 digit)
              </span>
            </label>
            <input
              id="reg-password" name="password" type="password" autoComplete="new-password"
              className={`form-input ${errors.password ? 'has-error' : ''}`}
              value={form.password} onChange={handleChange}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password && <div className="inline-error" role="alert">{errors.password}</div>}
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1.25rem' }} disabled={loading}>
          {loading ? 'Registering…' : 'Create Account'}
        </button>
      </form>

      <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--slate-500)' }}>
        Already have an account?{' '}
        <button
          type="button"
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => onNavigate('login')}
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
