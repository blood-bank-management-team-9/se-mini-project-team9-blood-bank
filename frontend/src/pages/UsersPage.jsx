import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch, apiPost } from '../services/api';
import { getRoleBadgeClass } from '../utils/navigation';

const VALID_ROLES = ['Donor', 'Hospital/Patient', 'Staff', 'Admin'];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ role: '', status: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', temporaryPassword: '' });
  const [createErrors, setCreateErrors] = useState({});
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status', filters.status);
      if (filters.q) params.append('q', filters.q);
      const data = await apiGet(`/api/admin/users?${params.toString()}`);
      setUsers(data.users ?? data);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setActionState((prev) => ({ ...prev, [userId]: { loading: true } }));
    try {
      await apiPatch(`/api/admin/users/${userId}/status`, { status: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.userId === userId || u.user_id === userId ? { ...u, status: newStatus } : u))
      );
    } catch (err) {
      setActionState((prev) => ({ ...prev, [userId]: { loading: false, error: err.message } }));
    } finally {
      setActionState((prev) => ({ ...prev, [userId]: { ...prev[userId], loading: false } }));
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    setCreateErrors({});
    try {
      await apiPost('/api/admin/users', createForm);
      setCreateSuccess('Staff account created successfully.');
      setCreateForm({ name: '', email: '', phone: '', temporaryPassword: '' });
      fetchUsers();
      setTimeout(() => setShowCreateForm(false), 1500);
    } catch (err) {
      if (err.type === 'validation') {
        const fieldMap = {};
        (err.fields || []).forEach((f) => { fieldMap[f.field] = f.message; });
        setCreateErrors(fieldMap);
        setCreateError(err.message);
      } else {
        setCreateError(err.message || 'Creation failed');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">User Management</h1>
        <p className="dashboard-subtitle">Manage all system accounts, roles, and access status.</p>
      </div>

      {error && <div className="alert-banner danger" role="alert">{error}</div>}

      {/* Create Staff form */}
      <div className="panel" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header">
          <h2 className="panel-title">Staff Accounts</h2>
          <button type="button" className="btn-primary" onClick={() => setShowCreateForm((v) => !v)}>
            {showCreateForm ? '✕ Close' : '+ Create Staff Account'}
          </button>
        </div>
        {showCreateForm && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--slate-200)' }}>
            {createError && <div className="alert-banner danger" style={{ marginBottom: '0.75rem' }}>{createError}</div>}
            {createSuccess && <div className="alert-banner info" style={{ marginBottom: '0.75rem' }}>{createSuccess}</div>}
            <form onSubmit={handleCreateStaff} noValidate>
              <div className="form-grid">
                {[['name', 'Full Name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone (10 digits)', 'tel']].map(([key, label, type]) => (
                  <div className="form-group" key={key}>
                    <label className="form-label" htmlFor={`cs-${key}`}>{label} <span className="req">*</span></label>
                    <input
                      id={`cs-${key}`} name={key} type={type} maxLength={key === 'phone' ? 10 : undefined}
                      className={`form-input ${createErrors[key] ? 'has-error' : ''}`}
                      value={createForm[key]}
                      onChange={(e) => {
                        setCreateForm((prev) => ({ ...prev, [key]: e.target.value }));
                        setCreateErrors((prev) => ({ ...prev, [key]: '' }));
                      }}
                    />
                    {createErrors[key] && <div className="inline-error">{createErrors[key]}</div>}
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label" htmlFor="cs-pw">Temporary Password <span className="req">*</span></label>
                  <input
                    id="cs-pw" name="temporaryPassword" type="password"
                    className={`form-input ${createErrors.temporaryPassword ? 'has-error' : ''}`}
                    value={createForm.temporaryPassword}
                    onChange={(e) => {
                      setCreateForm((prev) => ({ ...prev, temporaryPassword: e.target.value }));
                      setCreateErrors((prev) => ({ ...prev, temporaryPassword: '' }));
                    }}
                  />
                  {createErrors.temporaryPassword && <div className="inline-error">{createErrors.temporaryPassword}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Staff'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">All Users</h2>
        </div>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.75rem 1rem', background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)' }}>
          <input
            type="text"
            className="form-input"
            style={{ flex: 2, minWidth: '160px' }}
            placeholder="Search name or email…"
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          />
          <select className="form-select" style={{ flex: 1, minWidth: '140px' }} value={filters.role}
            onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
            <option value="">All Roles</option>
            {VALID_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="form-select" style={{ flex: 1, minWidth: '120px' }} value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button type="button" className="btn-secondary" onClick={fetchUsers}
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}>
            {loading ? 'Loading…' : 'Search'}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)' }}>No users found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const uid = u.userId ?? u.user_id;
                  const as_ = actionState[uid] || {};
                  return (
                    <tr key={uid}>
                      <td><code>{uid}</code></td>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td><span className={`role-badge ${getRoleBadgeClass(u.role)}`}>{u.role}</span></td>
                      <td>
                        <span className={`badge ${u.status === 'Active' ? 'badge-available' : 'badge-expired'}`}>
                          {u.status}
                        </span>
                        {as_.error && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', display: 'block' }}>{as_.error}</span>}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          disabled={as_.loading}
                          onClick={() => handleToggleStatus(uid, u.status)}
                        >
                          {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
