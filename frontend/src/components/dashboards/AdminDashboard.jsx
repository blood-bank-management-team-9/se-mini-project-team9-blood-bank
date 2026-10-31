import React, { useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../../services/api';
import { getRoleBadgeClass } from '../../utils/navigation';

export default function AdminDashboard({ onNavigate }) {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState({});

  useEffect(() => {
    Promise.all([
      apiGet('/api/admin/users'),
      apiGet('/api/admin/audit-logs?limit=5'),
    ])
      .then(([usersData, logsData]) => {
        setUsers(usersData.users ?? usersData ?? []);
        setAuditLogs(logsData.logs ?? []);
      })
      .catch((err) => setError(err.message || 'Failed to load admin data'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setActionState((prev) => ({ ...prev, [userId]: { loading: true } }));
    try {
      await apiPatch(`/api/admin/users/${userId}/status`, { status: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.userId === userId || u.user_id === userId ? { ...u, status: newStatus } : u))
      );
    } catch (err) {
      setActionState((prev) => ({ ...prev, [userId]: { loading: false, error: err.message } }));
    } finally {
      setActionState((prev) => ({ ...prev, [userId]: { ...prev[userId], loading: false } }));
    }
  };

  if (loading) {
    return <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>Loading admin dashboard…</div>;
  }

  const activeStaff = users.filter((u) => u.role === 'Staff' && u.status === 'Active').length;

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">System Administration Dashboard</h1>
        <p className="dashboard-subtitle">Platform overview, user access control, and compliance audit trail.</p>
      </div>

      {error && <div className="alert-banner danger" role="alert">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Accounts</span>
          <span className="stat-value">{users.length}</span>
          <span className="stat-desc">All verified accounts</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Staff</span>
          <span className="stat-value">{activeStaff}</span>
          <span className="stat-desc">Operational personnel</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Audit Events</span>
          <span className="stat-value">{auditLogs.length > 0 ? `${auditLogs.length}+` : '—'}</span>
          <span className="stat-desc">Append-only audit trail</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Availability SLA</span>
          <span className="stat-value" style={{ color: 'var(--success)' }}>≥ 99%</span>
          <span className="stat-desc">Target uptime per NFR-QUAL-02</span>
        </div>
      </div>

      {/* User Management Section */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">User Accounts &amp; Roles (RBAC)</h2>
          <button type="button" className="btn-primary" onClick={() => onNavigate('users')}>
            Manage All Users
          </button>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const uid = u.userId ?? u.user_id;
                const as_ = actionState[uid] || {};
                return (
                  <tr key={uid}>
                    <td><code>{uid}</code></td>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`role-badge ${getRoleBadgeClass(u.role)}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'Active' ? 'badge-issued' : 'badge-rejected'}`}>{u.status}</span>
                      {as_.error && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', display: 'block' }}>{as_.error}</span>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        disabled={as_.loading}
                        onClick={() => handleToggleStatus(uid, u.status)}
                      >
                        {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Overview */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Recent System Audit Events</h2>
          <button type="button" className="btn-secondary" onClick={() => onNavigate('audit')}>
            View Full Audit Log
          </button>
        </div>
        {auditLogs.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--slate-500)' }}>No audit events yet.</div>
        ) : (
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
                {auditLogs.map((log, i) => (
                  <tr key={log.id ?? log.log_id ?? i}>
                    <td style={{ fontSize: '0.8rem' }}>{log.createdAt ?? log.created_at ?? log.timestamp ?? '—'}</td>
                    <td><code style={{ fontSize: '0.8rem' }}>{log.action ?? log.event_type ?? '—'}</code></td>
                    <td style={{ fontSize: '0.85rem' }}>{log.actorUserId ?? log.actor_user_id ?? '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{log.targetId ?? log.target_id ?? '—'}</td>
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
