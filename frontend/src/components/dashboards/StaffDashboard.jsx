import React from 'react';

export default function StaffDashboard({ onNavigate }) {
  // Complete stock inventory per TC-28 (Available, Reserved, Issued, Expired, Discarded)
  const stockData = [
    { group: 'A+', available: 8, reserved: 1, issued: 12, expired: 0, discarded: 0, expiringSoon: 1 },
    { group: 'A-', available: 3, reserved: 0, issued: 4, expired: 0, discarded: 0, expiringSoon: 0 },
    { group: 'B+', available: 12, reserved: 2, issued: 15, expired: 1, discarded: 0, expiringSoon: 1 },
    { group: 'B-', available: 4, reserved: 0, issued: 2, expired: 0, discarded: 0, expiringSoon: 0 },
    { group: 'AB+', available: 6, reserved: 1, issued: 5, expired: 0, discarded: 0, expiringSoon: 0 },
    { group: 'AB-', available: 2, reserved: 0, issued: 1, expired: 0, discarded: 0, expiringSoon: 0 },
    { group: 'O+', available: 15, reserved: 3, issued: 20, expired: 0, discarded: 0, expiringSoon: 1 },
    { group: 'O-', available: 2, reserved: 1, issued: 6, expired: 0, discarded: 1, expiringSoon: 0 },
  ];

  const lowStockGroups = stockData.filter((s) => s.available < 5);
  const totalExpiringSoon = stockData.reduce((acc, curr) => acc + curr.expiringSoon, 0);

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Staff Operations Dashboard</h1>
        <p className="dashboard-subtitle">Real-time blood inventory, FEFO allocation queue, and operational alerts.</p>
      </div>

      {/* Visual Alerts per TC-07 and TC-28 */}
      <div className="alerts-container">
        {lowStockGroups.map((g) => (
          <div key={g.group} className="alert-banner danger" role="alert">
            <span className="alert-badge-label">CRITICAL</span>
            {/* Specific TC-07 requirement: text must read "Low Stock Alert: <group>" */}
            <span>
              <strong>Low Stock Alert: {g.group}</strong> ({g.available} units available, below 5-unit safety threshold).
            </span>
          </div>
        ))}

        {totalExpiringSoon > 0 && (
          <div className="alert-banner warning" role="alert">
            <span className="alert-badge-label">EXPIRING SOON</span>
            <span>
              <strong>Shelf Life Alert (TC-28):</strong> {totalExpiringSoon} unit(s) expiring within 7 days. Prioritize these units for issue under FEFO rules.
            </span>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Available Units</span>
          <span className="stat-value">{stockData.reduce((a, b) => a + b.available, 0)}</span>
          <span className="stat-desc">Safe inventory across 8 groups</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Reserved Units</span>
          <span className="stat-value">{stockData.reduce((a, b) => a + b.reserved, 0)}</span>
          <span className="stat-desc">Held for approved hospital requests</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Low Stock Groups</span>
          <span className="stat-value" style={{ color: 'var(--danger)' }}>{lowStockGroups.length}</span>
          <span className="stat-desc">Groups below 5 units</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Expiring ≤ 7 Days</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>{totalExpiringSoon}</span>
          <span className="stat-desc">First Expiry, First Out priority</span>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Quick Operations</h2>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => onNavigate('register-donor')}>
            + Register New Donor
          </button>
          <button type="button" className="btn-secondary" onClick={() => onNavigate('record-donation')}>
            + Record Donation
          </button>
          <button type="button" className="btn-secondary" onClick={() => onNavigate('requests')}>
            Process Requests Queue
          </button>
          <button type="button" className="btn-secondary" onClick={() => onNavigate('stock')}>
            Full Stock Audit
          </button>
        </div>
      </div>

      {/* Stock Summary Table - Full lifecycle per TC-28 */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Blood Inventory Status (TC-28)</h2>
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
              {stockData.map((item) => (
                <tr key={item.group}>
                  <td><strong>{item.group}</strong></td>
                  <td>{item.available}</td>
                  <td>{item.reserved}</td>
                  <td>{item.issued}</td>
                  <td>{item.expired}</td>
                  <td>{item.discarded}</td>
                  <td>
                    {item.expiringSoon > 0 ? (
                      <span className="badge" style={{ background: 'var(--warning-bg)', color: '#92400e', fontWeight: '700' }}>
                        {item.expiringSoon} unit(s)
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {item.available < 5 ? (
                      <span className="badge badge-rejected">Low Stock ({item.available})</span>
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
    </div>
  );
}
