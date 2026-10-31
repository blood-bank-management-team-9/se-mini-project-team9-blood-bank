import React, { useState, useEffect } from 'react';
import { apiGet } from '../services/api';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/api/admin/audit-logs')
      .then((data) => setLogs(data.logs ?? []))
      .catch((err) => setError(err.message || 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="panel" style={{ padding: '2rem' }}>Loading audit logs…</div>;

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">System Audit Log</h1>
        <p className="dashboard-subtitle">Append-only record of all security-sensitive operations.</p>
      </div>

      {error && <div className="alert-banner danger" role="alert">{error}</div>}

      {logs.length === 0 ? (
        <div className="panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)' }}>
          No audit events found.
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id ?? log.log_id ?? i}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {log.createdAt ?? log.created_at ?? log.timestamp ?? '—'}
                    </td>
                    <td><code style={{ fontSize: '0.8rem' }}>{log.action ?? log.event_type ?? '—'}</code></td>
                    <td style={{ fontSize: '0.85rem' }}>{log.actorUserId ?? log.actor_user_id ?? '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{log.targetId ?? log.target_id ?? '—'}</td>
                    <td style={{ fontSize: '0.8rem', maxWidth: '300px', wordBreak: 'break-word' }}>
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
