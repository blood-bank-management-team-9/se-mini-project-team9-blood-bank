import React from 'react';

export default function StaffDashboard({ onNavigate }) {
  // Stock data reflecting seed counts & thresholds (< 5 is Low Stock)
  const stockData = [
    { group: 'A+', available: 8, reserved: 1, expiringSoon: 1, status: 'Normal' },
    { group: 'A-', available: 3, reserved: 0, expiringSoon: 0, status: 'Low Stock' },
    { group: 'B+', available: 12, reserved: 2, expiringSoon: 1, status: 'Normal' },
    { group: 'B-', available: 4, reserved: 0, expiringSoon: 0, status: 'Low Stock' },
    { group: 'AB+', available: 6, reserved: 1, expiringSoon: 0, status: 'Normal' },
    { group: 'AB-', available: 2, reserved: 0, expiringSoon: 0, status: 'Low Stock' },
    { group: 'O+', available: 15, reserved: 3, expiringSoon: 1, status: 'Normal' },
    { group: 'O-', available: 2, reserved: 1, expiringSoon: 0, status: 'Low Stock' },
  ];

  const lowStockGroups = stockData.filter((s) => s.available < 5);
  const totalExpiringSoon = stockData.reduce((acc, curr) => acc + curr.expiringSoon, 0);

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Staff Operations Dashboard</h1>
        <p className="dashboard-subtitle">Real-time blood inventory, FEFO allocation queue, and operational alerts.</p>
      </div>

      {/* Visual Alerts with text and distinct color as required by SAD 4.5 & TC-07, TC-28 */}
      <div className="alerts-container">
        {lowStockGroups.length > 0 && (
          <div className="alert-banner danger" role="alert">
            <span className="alert-badge-label">CRITICAL</span>
            <span>
              <strong>Low Stock Alert:</strong> The following blood groups have dropped below the minimum 5-unit threshold:{' '}
              <strong>{lowStockGroups.map((g) => `${g.group} (${g.available} units)`).join(', ')}</strong>.
            </span>
          </div>
        )}

        {totalExpiringSoon > 0 && (
          <div className="alert-banner warning" role="alert">
            <span className="alert-badge-label">EXPIRING SOON</span>
            <span>
              <strong>Shelf Life Alert:</strong> {totalExpiringSoon} blood unit(s) are expiring within 7 days. Prioritize these units for issue under FEFO rules.
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
          <span className="stat-desc">Below safety threshold of 5 units</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Expiring ≤ 7 Days</span>
          <span className="stat-value" style={{ color: 'var(--warning)' }}>{totalExpiringSoon}</span>
          <span className="stat-desc">Earliest expiry first</span>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Quick Operations</h2>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => onNavigate('register-donor')}>
            + Register New Donor
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('record-donation')}>
            + Record Donation
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('requests')}>
            Review Pending Requests
          </button>
          <button className="btn-secondary" onClick={() => onNavigate('stock')}>
            Full Stock Audit
          </button>
        </div>
      </div>

      {/* Stock Summary Table */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Current Inventory by Blood Group</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Blood Group</th>
                <th>Available Units</th>
                <th>Reserved Units</th>
                <th>Expiring ≤ 7 Days</th>
                <th>Inventory Status</th>
              </tr>
            </thead>
            <tbody>
              {stockData.map((item) => (
                <tr key={item.group}>
                  <td><strong>{item.group}</strong></td>
                  <td>{item.available} units</td>
                  <td>{item.reserved} units</td>
                  <td>{item.expiringSoon > 0 ? `${item.expiringSoon} units` : '—'}</td>
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
