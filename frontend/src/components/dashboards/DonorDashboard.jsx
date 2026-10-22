import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { calculateEligibility } from '../../utils/validation';

export default function DonorDashboard({ initialDonations }) {
  const { user } = useAuth();

  // John Doe's last donation date from seeds was 2026-10-01
  const donorGender = user?.gender || 'Male';
  const lastDonationDate = user?.lastDonationDate || '2026-10-01';
  const eligibility = calculateEligibility(donorGender, lastDonationDate);

  // Sample donation history (or passed prop for testing)
  const defaultHistory = [
    {
      id: 'DON-00000001',
      date: '2026-10-01',
      volume: '450 ml',
      bloodGroup: 'O+',
      status: 'Recorded',
      screening: 'Passed',
    },
  ];

  const history = initialDonations !== undefined ? initialDonations : defaultHistory;

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
          {/* Correction: O+ is compatible with all Rh-positive groups (O- is universal red cell donor) */}
          <span className="stat-desc">Compatible with O+, A+, B+, AB+</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Eligibility Status</span>
          <span
            className="stat-value"
            style={{
              color: eligibility.eligible ? 'var(--success)' : 'var(--danger)',
              fontSize: '1.25rem',
            }}
          >
            {eligibility.eligible ? 'Eligible' : 'Ineligible'}
          </span>
          <span className="stat-desc">
            {eligibility.eligible
              ? 'Ready for voluntary donation'
              : `${eligibility.daysRemaining} days remaining for 90-day gap`}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Donations</span>
          <span className="stat-value">{history.length}</span>
          <span className="stat-desc">Lifetime units contributed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Last Donated</span>
          <span className="stat-value" style={{ fontSize: '1.2rem' }}>{lastDonationDate}</span>
          <span className="stat-desc">Next eligible: {eligibility.nextDate || 'Available today'}</span>
        </div>
      </div>

      {/* Eligibility Guidelines Box with dynamic message */}
      <div
        className={`alert-banner ${eligibility.eligible ? 'info' : 'warning'}`}
        style={{ marginBottom: '1.5rem' }}
        role="region"
        aria-label="Eligibility Notice"
      >
        <span className="alert-badge-label">ELIGIBILITY NOTICE (BR-03)</span>
        <span>
          <strong>Status: </strong> {eligibility.message}. Voluntary donation requires a mandatory 90-day rest period for male donors (120 days for female).
        </span>
      </div>

      {/* Donation History Table */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">My Donation History (TC-24)</h2>
        </div>

        {history.length === 0 ? (
          /* Mandatory SAD 4.5 requirement: shows "No donations recorded yet" when empty */
          <div className="empty-state">
            <p><strong>No donations recorded yet</strong></p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Your future donations at any certified camp or center will appear here.
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
