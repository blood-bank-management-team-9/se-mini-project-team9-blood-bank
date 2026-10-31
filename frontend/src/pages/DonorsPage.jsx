import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '../services/api';

export default function DonorsPage({ onNavigate }) {
  const [donors, setDonors] = useState([]);
  const [filters, setFilters] = useState({ status: '', bloodGroup: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggleState, setToggleState] = useState({});

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const fetchDonors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.bloodGroup) params.append('bloodGroup', filters.bloodGroup);
      if (filters.q) params.append('q', filters.q);
      const data = await apiGet(`/api/donors?${params.toString()}`);
      setDonors(data.donors ?? data);
    } catch (err) {
      setError(err.message || 'Failed to load donors');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchDonors(); }, [fetchDonors]);

  const handleToggleStatus = async (donorId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setToggleState((prev) => ({ ...prev, [donorId]: { loading: true } }));
    try {
      await apiPatch(`/api/donors/${donorId}/status`, { status: newStatus });
      setDonors((prev) =>
        prev.map((d) => (d.donorId === donorId ? { ...d, status: newStatus } : d))
      );
    } catch (err) {
      setToggleState((prev) => ({ ...prev, [donorId]: { loading: false, error: err.message } }));
    } finally {
      setToggleState((prev) => ({ ...prev, [donorId]: { loading: false } }));
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Donor Registry</h1>
        <p className="dashboard-subtitle">Search, view, and manage registered blood donors.</p>
      </div>

      {error && <div className="alert-banner danger" role="alert">{error}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Donors</h2>
          {onNavigate && (
            <button type="button" className="btn-primary" onClick={() => onNavigate('register-donor')}>
              + Register New Donor
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.75rem 1rem', background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)' }}>
          <input
            type="text"
            className="form-input"
            style={{ flex: 2, minWidth: '160px' }}
            placeholder="Search name, email, phone…"
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          />
          <select className="form-select" style={{ flex: 1, minWidth: '120px' }} value={filters.bloodGroup}
            onChange={(e) => setFilters((prev) => ({ ...prev, bloodGroup: e.target.value }))}>
            <option value="">All Groups</option>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="form-select" style={{ flex: 1, minWidth: '120px' }} value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button type="button" className="btn-secondary" onClick={fetchDonors}
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}>
            {loading ? 'Loading…' : 'Search'}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
        ) : donors.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)' }}>No donors found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Donor ID</th>
                  <th>Full Name</th>
                  <th>Blood Group</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((d) => {
                  const ts = toggleState[d.donorId] || {};
                  return (
                    <tr key={d.donorId}>
                      <td><code>{d.donorId}</code></td>
                      <td><strong>{d.fullName ?? d.name}</strong></td>
                      <td><span className="badge badge-issued">{d.bloodGroup}</span></td>
                      <td>{d.phone}</td>
                      <td>{d.city ?? '—'}</td>
                      <td>
                        <span className={`badge ${d.status === 'Active' ? 'badge-available' : 'badge-expired'}`}>
                          {d.status}
                        </span>
                        {ts.error && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', display: 'block' }}>{ts.error}</span>}
                      </td>
                      <td style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          disabled={ts.loading}
                          onClick={() => handleToggleStatus(d.donorId, d.status)}
                        >
                          {d.status === 'Active' ? 'Deactivate' : 'Reactivate'}
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
