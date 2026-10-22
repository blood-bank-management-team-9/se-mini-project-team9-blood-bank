import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function DonorDashboard() {
  const { user } = useAuth();
  const [showEmptyState, setShowEmptyState] = useState(false);

  // Sample donation history for John Doe
  const initialHistory = [
    {
      id: 'DON-00000001',
      date: '2026-10-01',
      volume: '450 ml',
      bloodGroup: 'O+',
      status: 'Recorded',
      screening: 'Passed',
    },
  ];

  const history = showEmptyState ? [] : initialHistory;

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Donor Portal</h1>
        <p className="dashboard-subtitle">Track your donation journey, eligibility dates, and personal contribution.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Blood Group</span>
          <span className="stat-value" style={{ color: 'var(--primary)' }}>O+</span>
          <span className="stat-desc">Universal red cell donor</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Eligibility Status</span>
          <span className="stat-value" style={{ color: 'var(--success)', fontSize: '1.4rem' }}>
            Eligible
          </span>
          <span className="stat-desc">Next donation window is open</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Donations</span>
          <span className="stat-value">{history.length}</span>
          <span className="stat-desc">Lifetime units contributed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Lives Impacted</span>
          <span className="stat-value">{history.length * 3}</span>
          <span className="stat-desc">Estimated patient support</span>
        </div>
      </div>

      {/* Eligibility Guidelines Box */}
      <div className="alert-banner info" style={{ marginBottom: '1.5rem' }}>
        <span className="alert-badge-label">DONATION GUIDELINES</span>
        <span>
          Male donors can donate every 90 days; female donors every 120 days. Ensure you weigh at least 45 kg and are well hydrated.
        </span>
      </div>

      {/* Donation History Table */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">My Donation History</h2>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
            onClick={() => setShowEmptyState(!showEmptyState)}
            title="Toggle between sample history and empty state"
          >
            {showEmptyState ? 'Show Sample History' : 'Simulate Empty History'}
          </button>
        </div>

        {history.length === 0 ? (
          /* Explicit SAD 4.5 requirement: shows "No donations recorded yet" when empty */
          <div className="empty-state">
            <p><strong>No donations recorded yet</strong></p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Your future donations at any certified camp or center will show up here.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Donation ID</th>
                  <th>Date</th>
                  <th>Blood Group</th>
                  <th>Volume</th>
                  <th>Screening Result</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td><code>{h.id}</code></td>
                    <td>{h.date}</td>
                    <td><strong>{h.bloodGroup}</strong></td>
                    <td>{h.volume}</td>
                    <td>
                      <span className="badge badge-issued">{h.screening}</span>
                    </td>
                    <td>
                      <span className="badge badge-approved">{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
