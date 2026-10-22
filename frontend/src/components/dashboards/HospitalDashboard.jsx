import React from 'react';

export default function HospitalDashboard({ onNavigate }) {
  const requests = [
    {
      id: 'REQ-00000001',
      patient: 'Ramesh Rao',
      group: 'O+',
      units: 1,
      requiredBy: '2026-10-15',
      priority: 'Urgent',
      status: 'Pending',
    },
    {
      id: 'REQ-00000002',
      patient: 'Sumanth K',
      group: 'B+',
      units: 2,
      requiredBy: '2026-10-18',
      priority: 'Normal',
      status: 'Approved',
    },
    {
      id: 'REQ-00000003',
      patient: 'Kavitha P',
      group: 'A+',
      units: 1,
      requiredBy: '2026-10-12',
      priority: 'Normal',
      status: 'Issued',
    },
  ];

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Hospital & Patient Portal</h1>
        <p className="dashboard-subtitle">Submit blood requisitions, track real-time fulfillment, and view allocations.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Pending Requests</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>1</span>
          <span className="stat-desc">Awaiting blood bank staff review</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Approved & Reserved</span>
          <span className="stat-value" style={{ color: 'var(--info)' }}>1</span>
          <span className="stat-desc">FEFO units held for dispatch</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Issued Units</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>1</span>
          <span className="stat-desc">Completed requisitions</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Emergency Line</span>
          <span className="stat-value" style={{ fontSize: '1.25rem' }}>080-2449</span>
          <span className="stat-desc">24x7 blood bank helpline</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Track Submitted Blood Requests</h2>
          <button className="btn-primary" onClick={() => onNavigate('request-blood')}>
            + New Blood Request
          </button>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
