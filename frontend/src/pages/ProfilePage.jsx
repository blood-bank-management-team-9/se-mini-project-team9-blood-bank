import React, { useState, useEffect } from 'react';
import { apiGet, apiPut } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Only Donor and Hospital/Patient can call /api/auth/me
    if (!user) { setLoading(false); return; }
    if (user.role === 'Staff' || user.role === 'Admin') {
      // Show read-only info from session
      setProfile(user);
      setForm({ name: user.name || '', phone: user.phone || '', address: user.address || '' });
      setLoading(false);
      return;
    }

    apiGet('/api/auth/me')
      .then((data) => {
        setProfile(data);
        setForm({ name: data.name || '', phone: data.phone || '', address: data.address || '' });
      })
      .catch((err) => {
        setGlobalError(err.message || 'Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setGlobalError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (user?.role === 'Staff' || user?.role === 'Admin') {
      setGlobalError('Profile editing is only available for Donor and Hospital/Patient accounts.');
      return;
    }
    setSaving(true);
    setGlobalError('');
    setSuccess('');
    try {
      const updated = await apiPut('/api/auth/me', form);
      setProfile(updated);
      setSuccess('Profile updated successfully.');
      if (refreshProfile) refreshProfile().catch(() => {});
    } catch (err) {
      if (err.type === 'validation') {
        const fieldMap = {};
        (err.fields || []).forEach((f) => { fieldMap[f.field] = f.message; });
        setErrors(fieldMap);
      } else {
        setGlobalError(err.message || 'Update failed');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="panel" style={{ padding: '2rem' }}>Loading profile…</div>;
  }

  const canEdit = user?.role !== 'Staff' && user?.role !== 'Admin';

  return (
    <div className="form-container" style={{ maxWidth: '560px', margin: '2rem auto' }}>
      <div className="form-header">
        <h2 className="panel-title" style={{ fontSize: '1.5rem' }}>My Profile</h2>
        {profile && (
          <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
            Role: <strong>{profile.role}</strong>
            {profile.userId && <> · ID: <code>{profile.userId}</code></>}
          </p>
        )}
      </div>

      {globalError && <div className="alert-banner danger" role="alert" style={{ marginBottom: '1rem' }}>{globalError}</div>}
      {success && <div className="alert-banner info" role="status" style={{ marginBottom: '1rem' }}>{success}</div>}

      {!canEdit && (
        <div className="alert-banner warning" style={{ marginBottom: '1rem' }}>
          Profile editing is not available for Staff and Admin accounts via this portal.
        </div>
      )}

      <form onSubmit={handleSave} noValidate>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email" className="form-input"
            value={profile?.email || user?.email || ''}
            readOnly
            style={{ background: 'var(--slate-100)', cursor: 'not-allowed' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="prof-name">Full Name {canEdit && <span className="req">*</span>}</label>
          <input
            id="prof-name" name="name" type="text"
            className={`form-input ${errors.name ? 'has-error' : ''}`}
            value={form.name} onChange={handleChange}
            readOnly={!canEdit}
            style={!canEdit ? { background: 'var(--slate-100)', cursor: 'not-allowed' } : {}}
          />
          {errors.name && <div className="inline-error" role="alert">{errors.name}</div>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="prof-phone">Phone {canEdit && <span className="req">*</span>}</label>
          <input
            id="prof-phone" name="phone" type="tel" maxLength="10"
            className={`form-input ${errors.phone ? 'has-error' : ''}`}
            value={form.phone} onChange={handleChange}
            readOnly={!canEdit}
            style={!canEdit ? { background: 'var(--slate-100)', cursor: 'not-allowed' } : {}}
          />
          {errors.phone && <div className="inline-error" role="alert">{errors.phone}</div>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="prof-address">Address</label>
          <input
            id="prof-address" name="address" type="text"
            className={`form-input ${errors.address ? 'has-error' : ''}`}
            value={form.address} onChange={handleChange}
            readOnly={!canEdit}
            style={!canEdit ? { background: 'var(--slate-100)', cursor: 'not-allowed' } : {}}
          />
          {errors.address && <div className="inline-error" role="alert">{errors.address}</div>}
        </div>

        {canEdit && (
          <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </form>
    </div>
  );
}
