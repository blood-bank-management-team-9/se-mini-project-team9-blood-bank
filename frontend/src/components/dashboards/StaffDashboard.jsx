import React, { useEffect, useState } from 'react';
import { apiGet } from '../../services/api';

export default function StaffDashboard({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiGet('/api/stock/summary'),
      apiGet('/api/stock/units'),
    ])
      .then(([sum, unitsData]) => {
        setSummary(sum);
        // Build per-group aggregates from the units list
        const units = unitsData.units ?? unitsData ?? [];
        const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        const now = new Date();
        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const grouped = GROUPS.map((group) => {
          const groupUnits = units.filter((u) => u.bloodGroup === group);
          const available = groupUnits.filter((u) => u.status === 'Available').length;
          const reserved  = groupUnits.filter((u) => u.status === 'Reserved').length;
          const issued    = groupUnits.filter((u) => u.status === 'Issued').length;
          const expired   = groupUnits.filter((u) => u.status === 'Expired').length;
          const discarded = groupUnits.filter((u) => u.status === 'Discarded').length;
          const expiringSoon = groupUnits.filter((u) => {
            if (u.status !== 'Available') return false;
            const exp = new Date(u.expiryDate ?? u.expiry_date);
            return exp <= sevenDays && exp >= now;
          }).length;
          return { group, available, reserved, issued, expired, discarded, expiringSoon };
        });
        setStockData(grouped);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load stock data');
      })
      .finally(() => setLoading(false));
  }, []);

  const lowStockGroups = stockData.filter((s) => s.available < 5);
  const totalExpiringSoon = stockData.reduce((acc, curr) => acc + curr.expiringSoon, 0);

  if (loading) {
    return (
      <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
        Loading staff dashboard…
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Staff Operations Dashboard</h1>
        <p className="dashboard-subtitle">Real-time blood inventory, FEFO allocation queue, and operational alerts.</p>
      </div>

      {error && <div className="alert-banner danger" role="alert">{error}</div>}

      {/* Visual Alerts */}
      <div className="alerts-container">
        {lowStockGroups.map((g) => (
          <div key={g.group} className="alert-banner danger" role="alert">
            <span className="alert-badge-label">CRITICAL</span>
            <span>
              <strong>Low Stock Alert: {g.group}</strong> ({g.available} units available, below 5-unit safety threshold).
            </span>
          </div>
        ))}
        {totalExpiringSoon > 0 && (
          <div className="alert-banner warning" role="alert">
            <span className="alert-badge-label">EXPIRING SOON</span>
            <span>
              <strong>Shelf Life Alert:</strong> {totalExpiringSoon} unit(s) expiring within 7 days. Prioritize these units under FEFO rules.
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

      {/* Quick Actions */}
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

      {/* Stock Summary Table */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Blood Inventory Status</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>Live data from backend</span>
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
                    ) : '—'}
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
