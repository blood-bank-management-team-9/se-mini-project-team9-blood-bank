import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '../services/api';

export default function RequestsQueuePage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');
  const [actionState, setActionState] = useState({}); // { [reqId]: { loading, error } }
  const [rejectForms, setRejectForms] = useState({}); // { [reqId]: { open, reason, error } }
  const [issueForms, setIssueForms] = useState({});  // { [reqId]: { open, recipientBloodGroup, error } }

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setGlobalError('');
    try {
      const data = await apiGet('/api/requests/pending');
      setRequests(data.requests ?? data);
    } catch (err) {
      setGlobalError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const setAction = (reqId, patch) =>
    setActionState((prev) => ({ ...prev, [reqId]: { ...(prev[reqId] || {}), ...patch } }));

  const handleApprove = async (requestId) => {
    setAction(requestId, { loading: true, error: '' });
    try {
      const data = await apiPatch(`/api/requests/${requestId}/approve`);
      setRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId
            ? { ...r, status: 'Approved', reservedUnitIds: data.reservedUnitIds }
            : r
        )
      );
      setAction(requestId, { loading: false, reservedUnitIds: data.reservedUnitIds });
    } catch (err) {
      setAction(requestId, { loading: false, error: err.message || 'Approval failed' });
    }
  };

  const handleReject = async (requestId) => {
    const rf = rejectForms[requestId] || {};
    if (!rf.reason?.trim()) {
      setRejectForms((prev) => ({ ...prev, [requestId]: { ...rf, error: 'Reason is required' } }));
      return;
    }
    setAction(requestId, { loading: true, error: '' });
    try {
      await apiPatch(`/api/requests/${requestId}/reject`, { reason: rf.reason });
      setRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId ? { ...r, status: 'Rejected' } : r
        )
      );
      setRejectForms((prev) => ({ ...prev, [requestId]: { open: false, reason: '' } }));
      setAction(requestId, { loading: false });
    } catch (err) {
      if (err.type === 'validation') {
        const reasonErr = (err.fields || []).find((f) => f.field === 'reason');
        setRejectForms((prev) => ({ ...prev, [requestId]: { ...rf, error: reasonErr?.message || err.message } }));
      } else {
        setAction(requestId, { loading: false, error: err.message || 'Rejection failed' });
      }
    }
  };

  const handleIssue = async (requestId) => {
    const isf = issueForms[requestId] || {};
    if (!isf.recipientBloodGroup) {
      setIssueForms((prev) => ({ ...prev, [requestId]: { ...isf, error: 'Recipient blood group is required' } }));
      return;
    }
    setAction(requestId, { loading: true, error: '' });
    try {
      await apiPatch(`/api/requests/${requestId}/issue`, {
        recipientBloodGroup: isf.recipientBloodGroup,
        confirmMatch: true,
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId ? { ...r, status: 'Issued' } : r
        )
      );
      setIssueForms((prev) => ({ ...prev, [requestId]: { open: false } }));
      setAction(requestId, { loading: false });
    } catch (err) {
      setAction(requestId, { loading: false, error: err.message || 'Issue failed' });
    }
  };

  if (loading) return <div className="panel" style={{ padding: '2rem' }}>Loading requests…</div>;

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Pending Requests Queue</h1>
        <p className="dashboard-subtitle">Approve, reject, or issue blood units for hospital requests.</p>
      </div>

      {globalError && <div className="alert-banner danger" role="alert">{globalError}</div>}

      {requests.length === 0 ? (
        <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No pending requests at this time.</p>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Requests ({requests.length})</h2>
            <button type="button" className="btn-secondary" onClick={fetchPending}>↻ Refresh</button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Patient</th>
                  <th>Group</th>
                  <th>Units</th>
                  <th>Required By</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const act = actionState[r.requestId] || {};
                  const rf = rejectForms[r.requestId] || {};
                  const isf = issueForms[r.requestId] || {};
                  const isPending = r.status === 'Pending';
                  const isApproved = r.status === 'Approved';

                  return (
                    <React.Fragment key={r.requestId}>
                      <tr>
                        <td><code>{r.requestId}</code></td>
                        <td>{r.patientName}</td>
                        <td><strong>{r.bloodGroup}</strong></td>
                        <td>{r.units}</td>
                        <td>{r.requiredByDate}</td>
                        <td>
                          {r.priority === 'Urgent'
                            ? <span className="badge badge-rejected">URGENT</span>
                            : <span className="badge">Normal</span>}
                        </td>
                        <td><span className={`badge badge-${r.status?.toLowerCase()}`}>{r.status}</span></td>
                        <td style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                                disabled={act.loading}
                                onClick={() => handleApprove(r.requestId)}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', borderColor: '#fca5a5', color: '#b91c1c' }}
                                disabled={act.loading}
                                onClick={() =>
                                  setRejectForms((prev) => ({
                                    ...prev,
                                    [r.requestId]: { open: !rf.open, reason: rf.reason || '', error: '' },
                                  }))
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {isApproved && (
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                              disabled={act.loading}
                              onClick={() =>
                                setIssueForms((prev) => ({
                                  ...prev,
                                  [r.requestId]: { open: !isf.open, recipientBloodGroup: r.bloodGroup, error: '' },
                                }))
                              }
                            >
                              Issue
                            </button>
                          )}
                          {!isPending && !isApproved && (
                            <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem' }}>Locked</span>
                          )}
                        </td>
                      </tr>

                      {/* Approve success — show reserved unit IDs */}
                      {act.reservedUnitIds && act.reservedUnitIds.length > 0 && (
                        <tr>
                          <td colSpan={8} style={{ background: 'var(--success-bg)', padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                            Reserved unit(s): {act.reservedUnitIds.join(', ')}
                          </td>
                        </tr>
                      )}

                      {/* Error row */}
                      {act.error && (
                        <tr>
                          <td colSpan={8} style={{ background: '#fef2f2', padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--danger)' }}>
                            {act.error}
                          </td>
                        </tr>
                      )}

                      {/* Reject form row */}
                      {rf.open && (
                        <tr>
                          <td colSpan={8} style={{ padding: '0.75rem 1rem', background: 'var(--slate-50)' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="text"
                                  className={`form-input ${rf.error ? 'has-error' : ''}`}
                                  style={{ marginBottom: 0 }}
                                  placeholder="Reason for rejection (required)"
                                  maxLength={100}
                                  value={rf.reason || ''}
                                  onChange={(e) =>
                                    setRejectForms((prev) => ({
                                      ...prev,
                                      [r.requestId]: { ...rf, reason: e.target.value, error: '' },
                                    }))
                                  }
                                />
                                {rf.error && <div className="inline-error">{rf.error}</div>}
                              </div>
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', background: '#b91c1c', border: 'none' }}
                                disabled={act.loading}
                                onClick={() => handleReject(r.requestId)}
                              >
                                Confirm Reject
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                                onClick={() => setRejectForms((prev) => ({ ...prev, [r.requestId]: { open: false } }))}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Issue form row */}
                      {isf.open && (
                        <tr>
                          <td colSpan={8} style={{ padding: '0.75rem 1rem', background: 'var(--slate-50)' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                                  Confirm Recipient Blood Group
                                </label>
                                <select
                                  className={`form-select ${isf.error ? 'has-error' : ''}`}
                                  value={isf.recipientBloodGroup || ''}
                                  onChange={(e) =>
                                    setIssueForms((prev) => ({
                                      ...prev,
                                      [r.requestId]: { ...isf, recipientBloodGroup: e.target.value, error: '' },
                                    }))
                                  }
                                >
                                  <option value="">— select —</option>
                                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                                </select>
                                {isf.error && <div className="inline-error">{isf.error}</div>}
                              </div>
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', marginTop: '1.4rem' }}
                                disabled={act.loading}
                                onClick={() => handleIssue(r.requestId)}
                              >
                                Confirm Issue
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', marginTop: '1.4rem' }}
                                onClick={() => setIssueForms((prev) => ({ ...prev, [r.requestId]: { open: false } }))}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
