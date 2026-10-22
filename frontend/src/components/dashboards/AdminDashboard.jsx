import React from 'react';

export default function AdminDashboard() {
  const usersList = [
    { id: 'USR-ADM01', name: 'System Administrator', email: 'admin@bloodbank.org', role: 'Admin', status: 'Active' },
    { id: 'USR-STF01', name: 'Nurse Joy', email: 'staff@bloodbank.org', role: 'Staff', status: 'Active' },
    { id: 'USR-DNR01', name: 'John Doe', email: 'john.doe@example.com', role: 'Donor', status: 'Active' },
    { id: 'USR-HSP01', name: 'City General Hospital', email: 'hospital@citygen.org', role: 'Hospital/Patient', status: 'Active' },
  ];

  const auditEvents = [
    { id: 1, action: 'USER_LOGIN', user: 'admin@bloodbank.org', target: 'SESSION', timestamp: 'Today, 10:30 AM' },
    { id: 2, action: 'SYSTEM_CONFIG_UPDATE', user: 'admin@bloodbank.org', target: 'shelf_life_days', timestamp: 'Yesterday, 04:15 PM' },
    { id: 3, action: 'DONATION_RECORDED', user: 'staff@bloodbank.org', target: 'DON-00000003', timestamp: 'Yesterday, 02:00 PM' },
  ];

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">System Administration Dashboard</h1>
        <p className="dashboard-subtitle">Platform overview, user access control, and compliance audit trail.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Accounts</span>
          <span className="stat-value">4</span>
          <span className="stat-desc">All verified accounts</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Staff</span>
          <span className="stat-value">1</span>
          <span className="stat-desc">Operational personnel</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">System Audits</span>
          <span className="stat-value">28</span>
          <span className="stat-desc">Append-only audit trail</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">System Health</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>99.9%</span>
          <span className="stat-desc">Uptime meets SLA (TC-37)</span>
        </div>
      </div>

      {/* User Management Section */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">User Accounts & Roles (RBAC)</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Account Status</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((u) => (
                <tr key={u.id}>
                  <td><code>{u.id}</code></td>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role-badge ${u.role.toLowerCase().replace('/', '')}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-issued">{u.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Overview */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Recent System Audit Events (C12)</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor User</th>
                <th>Target Entity</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((evt) => (
                <tr key={evt.id}>
                  <td>{evt.timestamp}</td>
                  <td><code>{evt.action}</code></td>
                  <td>{evt.user}</td>
                  <td>{evt.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
