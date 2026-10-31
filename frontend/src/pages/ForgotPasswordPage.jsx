import React, { useState } from 'react';
import { apiPost } from '../services/api';

export default function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Email is required'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/auth/forgot-password', { email });
      setResult(data);
    } catch (err) {
      if (err.type === 'network') {
        setError('Cannot reach the server.');
      } else {
        setError(err.message || 'Request failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container" style={{ maxWidth: '440px', margin: '4rem auto' }}>
      <div className="form-header">
        <h2 className="panel-title" style={{ fontSize: '1.5rem' }}>Forgot Password</h2>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
          Enter your registered email. In dev mode, the reset token is returned directly.
        </p>
      </div>

      {error && <div className="alert-banner danger" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

      {result ? (
        <div>
          <div className="alert-banner info" role="status" style={{ marginBottom: '1rem' }}>
            Password reset token generated.{' '}
            {result.resetToken && (
              <span>
                <strong>Dev token:</strong>{' '}
                <code style={{ wordBreak: 'break-all' }}>{result.resetToken}</code>
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={() => onNavigate('reset-password', { token: result.resetToken })}
          >
            Continue to Reset Password
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="fp-email">Email address</label>
            <input
              id="fp-email" type="email" autoComplete="email"
              className={`form-input ${error ? 'has-error' : ''}`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Sending…' : 'Request Reset Token'}
          </button>
          <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
              onClick={() => onNavigate('login')}
            >
              Back to Sign In
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
