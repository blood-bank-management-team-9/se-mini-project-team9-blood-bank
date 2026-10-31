import React, { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPatch } from '../../services/api';

export default function HospitalDashboard({ onNavigate }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelState, setCancelState] = useState({});

  const fetchRequests = useCallback(() => {
    setLoading(true);
    setError('');
    apiGet('/api/requests/mine')
      .then((data) => setRequests(data.requests ?? data ?? []))
      .catch((err) => setError(err.message || 'Failed to load requests'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleCancel = async (requestId) => {
    if (!window.confirm(`Cancel request ${requestId}?`)) return;
    setCancelState((prev) => ({ ...prev, [requestId]: { loading: true } }));
    try {
      await apiPatch(`/api/requests/${requestId}/cancel`);
      setRequests((prev) =>
        prev.map((r) => (r.requestId === requestId ? { ...r, status: 'Cancelled' } : r))
      );
    } catch (err) {
      setCancelState((prev) => ({ ...prev, [requestId]: { loading: false, error: err.message } }));
    } finally {
      setCancelState((prev) => ({ ...prev, [requestId]: { loading: false } }));
    }
  };

  const pendingCount  = requests.filter((r) => r.status === 'Pending').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;
  const issuedCount   = requests.filter((r) => r.status === 'Issued').length;
  const totalUnits    = requests.reduce((acc, r) => acc + (r.units ?? 0), 0);

  if (loading) {
    return <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>Loading hospital portal…</div>;
  }

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Hospital &amp; Patient Portal</h1>
        <p className="dashboard-subtitle">Submit blood requisitions, track real-time fulfillment, and view allocations.</p>
      </div>

      {error && <div className="alert-banner danger" role="alert">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Pending Requests</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>{pendingCount}</span>
          <span className="stat-desc">In staff processing queue</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Approved &amp; Reserved</span>
          <span className="stat-value" style={{ color: 'var(--info)' }}>{approvedCount}</span>
          <span className="stat-desc">FEFO allocation completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Issued Units</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>{issuedCount}</span>
          <span className="stat-desc">Completed transfusions</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Units Requested</span>
          <span className="stat-value">{totalUnits}</span>
          <span className="stat-desc">Cumulative demand</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">My Blood Requests</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => onNavigate('search-stock')}>
              Search Stock
            </button>
            <button type="button" className="btn-primary" onClick={() => onNavigate('request-blood')}>
              + New Blood Request
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            No requests yet. Submit a new blood request above.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Patient Name</th>
                  <th>Group</th>
                  <th>Units</th>
                  <th>Required Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const cs = cancelState[r.requestId] || {};
                  return (
                    <tr key={r.requestId}>
                      <td><code>{r.requestId}</code></td>
                      <td><strong>{r.patientName}</strong></td>
                      <td><span className="badge badge-approved">{r.bloodGroup}</span></td>
                      <td>{r.units}</td>
                      <td>{r.requiredByDate}</td>
                      <td>
                        {r.priority === 'Urgent'
                          ? <span className="badge badge-urgent">URGENT</span>
                          : <span className="badge" style={{ background: 'var(--slate-100)' }}>Normal</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${r.status?.toLowerCase()}`}>{r.status}</span>
                      </td>
                      <td>
                        {r.rejectionReason
                          ? <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{r.rejectionReason}</span>
                          : '—'}
                        {cs.error && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', display: 'block' }}>{cs.error}</span>}
                      </td>
                      <td>
                        {r.status === 'Pending' ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: '#fca5a5', color: '#b91c1c' }}
                            disabled={cs.loading}
                            onClick={() => handleCancel(r.requestId)}
                          >
                            Cancel
                          </button>
                        ) : (
                          <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem' }}>Locked</span>
                        )}
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
