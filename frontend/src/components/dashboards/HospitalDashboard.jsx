import React, { useState } from 'react';

export default function HospitalDashboard({ onNavigate }) {
  // Comprehensive request state covering all statuses (Pending, Approved, Issued, Rejected, Cancelled)
  const [requests, setRequests] = useState([
    {
      id: 'REQ-00000001',
      patient: 'Ramesh Rao',
      group: 'O+',
      units: 1,
      requiredBy: '2026-10-25',
      priority: 'Urgent',
      status: 'Pending',
      rejectionReason: null,
    },
    {
      id: 'REQ-00000002',
      patient: 'Sumanth K',
      group: 'B+',
      units: 2,
      requiredBy: '2026-10-28',
      priority: 'Normal',
      status: 'Approved',
      rejectionReason: null,
    },
    {
      id: 'REQ-00000003',
      patient: 'Kavitha P',
      group: 'A+',
      units: 1,
      requiredBy: '2026-10-20',
      priority: 'Normal',
      status: 'Issued',
      rejectionReason: null,
    },
    {
      id: 'REQ-00000004',
      patient: 'Manjunath N',
      group: 'AB-',
      units: 3,
      requiredBy: '2026-10-18',
      priority: 'Normal',
      status: 'Rejected',
      rejectionReason: 'Cross-matching showed incompatible antibodies (TC-31)',
    },
    {
      id: 'REQ-00000005',
      patient: 'Pooja Hegde',
      group: 'O-',
      units: 1,
      requiredBy: '2026-10-19',
      priority: 'Normal',
      status: 'Cancelled',
      rejectionReason: null,
    },
  ]);

  // Derived KPI counts
  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;
  const issuedCount = requests.filter((r) => r.status === 'Issued').length;
  const totalUnits = requests.reduce((acc, curr) => acc + curr.units, 0);

  // FR-REQ-08: Requester can cancel a request while still Pending
  const handleCancel = (requestId) => {
    if (window.confirm(`Are you sure you want to cancel request ${requestId}?`)) {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'Cancelled' } : r))
      );
    }
  };

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Hospital & Patient Portal</h1>
        <p className="dashboard-subtitle">Submit blood requisitions, track real-time fulfillment, and view allocations.</p>
      </div>

      {/* Dynamically derived KPI stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Pending Requests</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>{pendingCount}</span>
          <span className="stat-desc">In staff processing queue</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Approved & Reserved</span>
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
          <span className="stat-desc">Cumulative demand across requisitions</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Track Blood Requests (FR-REQ-08, TC-31)</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => onNavigate('search-stock')}>
              Search Available Stock
            </button>
            <button type="button" className="btn-primary" onClick={() => onNavigate('request-blood')}>
              + New Blood Request
            </button>
          </div>
        </div>
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
                <th>Details / Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td><code>{r.id}</code></td>
                  <td><strong>{r.patient}</strong></td>
                  <td><span className="badge badge-approved">{r.group}</span></td>
                  <td>{r.units}</td>
                  <td>{r.requiredBy}</td>
                  <td>
                    {r.priority === 'Urgent' ? (
                      <span className="badge badge-urgent">URGENT</span>
                    ) : (
                      <span className="badge" style={{ background: 'var(--slate-100)' }}>Normal</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span>
                  </td>
                  <td>
                    {r.rejectionReason ? (
                      <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>
                        {r.rejectionReason}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {/* FR-REQ-08: If still Pending, requester can cancel */}
                    {r.status === 'Pending' ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: '#fca5a5', color: '#b91c1c' }}
                        onClick={() => handleCancel(r.id)}
                        title="Cancel this pending requisition"
                      >
                        Cancel
                      </button>
                    ) : (
                      <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem' }}>Locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
