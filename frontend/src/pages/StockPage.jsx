import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '../services/api';

const DISCARD_REASONS = ['Expired', 'Contaminated', 'Damaged', 'Other'];

export default function StockPage() {
  const [summary, setSummary] = useState(null);
  const [units, setUnits] = useState([]);
  const [filterBloodGroup, setFilterBloodGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [discardState, setDiscardState] = useState({}); // { [unitId]: { open, reason, loading, error } }

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const UNIT_STATUSES = ['Available', 'Reserved', 'Issued', 'Expired', 'Discarded'];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sumData, unitsData] = await Promise.all([
        apiGet('/api/stock/summary'),
        apiGet(`/api/stock/units${buildQuery()}`),
      ]);
      setSummary(sumData);
      setUnits(unitsData.units ?? unitsData);
    } catch (err) {
      setError(err.message || 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [filterBloodGroup, filterStatus]); // eslint-disable-line

  function buildQuery() {
    const params = new URLSearchParams();
    if (filterBloodGroup) params.append('bloodGroup', filterBloodGroup);
    if (filterStatus) params.append('status', filterStatus);
    const q = params.toString();
    return q ? `?${q}` : '';
  }

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDiscard = async (unitId) => {
    const ds = discardState[unitId] || {};
    if (!ds.reason) {
      setDiscardState((prev) => ({ ...prev, [unitId]: { ...ds, error: 'Select a reason' } }));
      return;
    }
    setDiscardState((prev) => ({ ...prev, [unitId]: { ...ds, loading: true, error: '' } }));
    try {
      await apiPatch(`/api/stock/units/${unitId}/discard`, { reason: ds.reason });
      setDiscardState((prev) => ({ ...prev, [unitId]: { open: false, loading: false } }));
      fetchData();
    } catch (err) {
      setDiscardState((prev) => ({ ...prev, [unitId]: { ...ds, loading: false, error: err.message || 'Discard failed' } }));
    }
  };

  if (loading) return <div className="panel" style={{ padding: '2rem' }}>Loading stock...</div>;

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Blood Inventory</h1>
        <p className="dashboard-subtitle">Full stock audit — available, reserved, issued, expired, discarded units.</p>
      </div>

      {error && <div className="alert-banner danger" role="alert">{error}</div>}

      {/* --- NEW CORRECT SUMMARY SECTION --- */}
      {summary && (
        <>
          {/* Low-stock alert banners */}
          {summary.lowStockAlerts && summary.lowStockAlerts.length > 0 && (
            <div className="alerts-container" style={{ marginBottom: '1.25rem' }}>
              <div className="alert-banner danger" role="alert">
                <span className="alert-badge-label">CRITICAL</span>
                <span>
                  <strong>Low Stock Alert:</strong>{' '}
                  {summary.lowStockAlerts.map((a) => `${a.bloodGroup} (${a.available} units, threshold ${a.threshold})`).join(' · ')}
                </span>
              </div>
            </div>
          )}

          {/* KPI cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Available Units</span>
              <span className="stat-value">
                {summary.groups?.reduce((sum, g) => sum + (g.available || 0), 0) ?? 0}
              </span>
              <span className="stat-desc">Across all groups</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Reserved Units</span>
              <span className="stat-value">
                {summary.groups?.reduce((sum, g) => sum + (g.reserved || 0), 0) ?? 0}
              </span>
              <span className="stat-desc">Held for approved requests</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Low Stock Groups</span>
              <span className="stat-value" style={{ color: 'var(--danger)' }}>
                {summary.lowStockAlerts?.length ?? 0}
              </span>
              <span className="stat-desc">Below threshold of {summary.lowStockThreshold ?? 5}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Expiring Soon</span>
              <span className="stat-value" style={{ color: 'var(--warning)' }}>
                {summary.groups?.reduce((sum, g) => sum + (g.expiringSoon || 0), 0) ?? 0}
              </span>
              <span className="stat-desc">Within {summary.expiringSoonDays ?? 7} days</span>
            </div>
          </div>

          {/* Per-group summary table */}
          <div className="panel" style={{ marginBottom: '1.25rem' }}>
            <div className="panel-header">
              <h2 className="panel-title">Stock Summary by Blood Group</h2>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Blood Group</th>
                    <th>Available</th>
                    <th>Reserved</th>
                    <th>Issued</th>
                    <th>Expired</th>
                    <th>Discarded</th>
                    <th>Expiring Soon</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.groups || []).map((g) => (
                    <tr key={g.bloodGroup}>
                      <td><strong>{g.bloodGroup}</strong></td>
                      <td>{g.available}</td>
                      <td>{g.reserved}</td>
                      <td>{g.issued}</td>
                      <td>{g.expired}</td>
                      <td>{g.discarded}</td>
                      <td>{g.expiringSoon}</td>
                      <td>
                        {g.lowStock ? (
                          <span className="badge badge-rejected">Low Stock ({g.available})</span>
                        ) : (
                          <span className="badge badge-issued">Healthy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {/* --- END OF NEW SUMMARY SECTION --- */}

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Blood Units</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-select" value={filterBloodGroup}
              onChange={(e) => setFilterBloodGroup(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
              <option value="">All Groups</option>
              {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className="form-select" value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
              <option value="">All Statuses</option>
              {UNIT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" className="btn-secondary" onClick={fetchData}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
              Apply
            </button>
          </div>
        </div>

        {units.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)' }}>No units found for selected filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit ID</th>
                  <th>Blood Group</th>
                  <th>Status</th>
                  <th>Expiry Date</th>
                  <th>Donation ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const ds = discardState[u.unitId] || {};
                  return (
                    <React.Fragment key={u.unitId}>
                      <tr>
                        <td><code>{u.unitId}</code></td>
                        <td><strong>{u.bloodGroup}</strong></td>
                        <td><span className={`badge badge-${u.status?.toLowerCase()}`}>{u.status}</span></td>
                        <td>{u.expiryDate ?? u.expiry_date ?? '—'}</td>
                        <td><code>{u.donationId ?? u.donation_id ?? '—'}</code></td>
                        <td>
                          {u.status === 'Available' ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: '#fca5a5', color: '#b91c1c' }}
                              onClick={() =>
                                setDiscardState((prev) => ({
                                  ...prev,
                                  [u.unitId]: { open: !ds.open, reason: '', error: '' },
                                }))
                              }
                            >
                              Discard
                            </button>
                          ) : (
                            <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                      {ds.open && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0.75rem 1rem', background: 'var(--slate-50)' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <select
                                className={`form-select ${ds.error ? 'has-error' : ''}`}
                                value={ds.reason || ''}
                                onChange={(e) =>
                                  setDiscardState((prev) => ({
                                    ...prev,
                                    [u.unitId]: { ...ds, reason: e.target.value, error: ''},
                                  }))
                                }
                                style={{ flex: 1 }}
                              >
                                <option value="">— select reason —</option>
                                {DISCARD_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', background: '#b91c1c', border: 'none' }}
                                disabled={ds.loading}
                                onClick={() => handleDiscard(u.unitId)}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setDiscardState((prev) => ({ ...prev, [u.unitId]: { open: false } }))}
                              >
                                Cancel
                              </button>
                            </div>
                            {ds.error && <div className="inline-error">{ds.error}</div>}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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