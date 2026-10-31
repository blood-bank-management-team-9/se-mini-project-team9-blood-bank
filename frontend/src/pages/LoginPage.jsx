import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setGlobalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.email) newErrors.email = 'Email is required';
    if (!form.password) newErrors.password = 'Password is required';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setLoading(true);
    setGlobalError('');
    try {
      await login({ email: form.email, password: form.password });
      // AuthProvider sets user; Home will render the right dashboard
    } catch (err) {
      if (err.type === 'validation') {
        const fieldMap = {};
        (err.fields || []).forEach((f) => { fieldMap[f.field] = f.message; });
        setErrors(fieldMap);
      } else if (err.type === 'conflict' && err.minutesLeft != null) {
        setGlobalError(`Account locked. Try again in ${err.minutesLeft} minute(s).`);
      } else if (err.type === 'network') {
        setGlobalError('Cannot reach the server. Is the backend running?');
      } else {
        setGlobalError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container" style={{ maxWidth: '440px', margin: '4rem auto' }}>
      <div className="form-header">
        <h2 className="panel-title" style={{ fontSize: '1.5rem' }}>Sign In</h2>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
          Use your BBMS credentials to access the system.
        </p>
      </div>

      {globalError && (
        <div className="alert-banner danger" role="alert" style={{ marginBottom: '1rem' }}>
          {globalError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className={`form-input ${errors.email ? 'has-error' : ''}`}
            value={form.email}
            onChange={handleChange}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && <div id="email-error" className="inline-error" role="alert">{errors.email}</div>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className={`form-input ${errors.password ? 'has-error' : ''}`}
            value={form.password}
            onChange={handleChange}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          {errors.password && <div id="password-error" className="inline-error" role="alert">{errors.password}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn-link"
            onClick={() => onNavigate('forgot-password')}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--slate-500)' }}>
        New patient or blood donor?{' '}
        <button
          type="button"
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => onNavigate('register')}
        >
          Register here
        </button>
      </p>
    </div>
  );
}
