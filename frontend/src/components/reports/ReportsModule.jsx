import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiGetBlob } from '../../services/api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const STATUS_OPTIONS = {
  stock: ['Available', 'Reserved', 'Issued', 'Expired', 'Discarded'],
  donation: ['Passed', 'Failed'],
  request: ['Pending', 'Approved', 'Rejected', 'Issued', 'Cancelled'],
};

export default function ReportsModule({ initialReportType = 'stock' }) {
  const { user } = useAuth();
  const role = user?.role || '';
  const isStaffOrAdmin = role === 'Staff' || role === 'Admin';

  const [reportType, setReportType] = useState(initialReportType);
  const [filters, setFilters] = useState({ from: '', to: '', bloodGroup: '', status: '' });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchReport = async () => {
    if (!isStaffOrAdmin) return;
    setLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams();
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.bloodGroup) params.append('bloodGroup', filters.bloodGroup);
    if (filters.status) params.append('status', filters.status);

    try {
      const data = await apiGet(`/api/reports/${reportType}?${params.toString()}`);
      setReportData(data);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to generate report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isStaffOrAdmin) fetchReport();
  }, [reportType]); // eslint-disable-line

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchReport();
  };

  const handleResetFilters = () => {
    setFilters({ from: '', to: '', bloodGroup: '', status: '' });
  };

  // FR-RPT-05, TC-10: Export CSV or PDF
  const handleExport = async (format = 'csv') => {
    setExporting(true);
    const params = new URLSearchParams();
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.bloodGroup) params.append('bloodGroup', filters.bloodGroup);
    if (filters.status) params.append('status', filters.status);
    params.append('format', format);

    try {
      const blob = await apiGetBlob(`/api/reports/${reportType}/export?${params.toString()}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage(err.message || `Export failed`);
    } finally {
      setExporting(false);
    }
  };

  // RBAC guard
  if (!isStaffOrAdmin) {
    return (
      <div className="panel" style={{ maxWidth: '960px', margin: '2rem auto' }}>
        <div className="alert-banner danger" role="alert">
          <strong>Access Denied (HTTP 403):</strong> Report generation is restricted to Staff and Administrators only (FR-RPT-06, TC-09).
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: '1120px', margin: '0 auto' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="panel-title" style={{ fontSize: '1.5rem' }}>Management Reports &amp; Analytics (FR-RPT-01 to 05)</h1>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
            Inventory, donation, and requisition reports with CSV &amp; PDF export (TC-10).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {['stock', 'donation', 'request'].map((t) => (
            <button
              key={t}
              type="button"
              className={reportType === t ? 'btn-primary' : 'btn-secondary'}
              onClick={() => { setReportType(t); setFilters({ from: '', to: '', bloodGroup: '', status: '' }); }}
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
            >
              {t === 'stock' ? '📊 Stock' : t === 'donation' ? '🩸 Donations' : '📋 Requests'}
            </button>
          ))}
          <div style={{ borderLeft: '1px solid var(--slate-200)', height: '24px', margin: '0 0.25rem' }} />
          <button type="button" className="btn-secondary" onClick={() => handleExport('csv')} disabled={exporting}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem', fontWeight: 600 }}>
            📥 Export CSV
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleExport('pdf')} disabled={exporting}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem', fontWeight: 600 }}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form onSubmit={handleApplyFilters} className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'flex-end', marginTop: '1.25rem', padding: '1rem', background: 'var(--slate-100)', borderRadius: 'var(--radius-md)' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="filterFrom">From Date</label>
          <input id="filterFrom" type="date" className="form-input" value={filters.from}
            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="filterTo">To Date</label>
          <input id="filterTo" type="date" className="form-input" value={filters.to}
            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="filterBloodGroup">Blood Group</label>
          <select id="filterBloodGroup" className="form-select" value={filters.bloodGroup}
            onChange={(e) => setFilters((prev) => ({ ...prev, bloodGroup: e.target.value }))}>
            <option value="">All Groups</option>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="filterStatus">Status</label>
          <select id="filterStatus" className="form-select" value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS[reportType].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1, padding: '0.6rem 0.75rem' }}>
            {loading ? 'Filtering…' : 'Apply Filters'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleResetFilters} style={{ padding: '0.6rem 0.75rem' }}>
            Reset
          </button>
        </div>
      </form>

      {errorMessage && (
        <div className="alert-banner danger" role="alert" style={{ marginTop: '1.25rem' }}>
          {errorMessage}
        </div>
      )}

      {/* Reports Display */}
      <div style={{ marginTop: '2rem' }}>
        {loading && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-500)' }}>Loading report…</div>}

        {!loading && reportData && (
          <div>
            {/* STOCK REPORT */}
            {reportType === 'stock' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.15rem', color: 'var(--slate-800)' }}>Blood Stock Inventory Summary (TC-10)</h2>
                  <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                    Total Units Evaluated: <strong>{reportData.totalRecords ?? 0}</strong>
                  </span>
                </div>
                {(!reportData.aggregates || reportData.aggregates.length === 0) ? (
                  <div className="alert-banner info" role="status" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    No records found for selected filters.
                  </div>
                ) : (
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
                          <th>Earliest Expiry</th>
                          <th>Total Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.aggregates.map((row) => (
                          <tr key={row.bloodGroup}>
                            <td><strong>{row.bloodGroup}</strong></td>
                            <td><span className="badge badge-available" data-testid={`stock-available-${row.bloodGroup}`}>{row.available}</span></td>
                            <td><span className="badge badge-reserved">{row.reserved}</span></td>
                            <td><span className="badge badge-issued">{row.issued}</span></td>
                            <td><span className="badge badge-expired">{row.expired}</span></td>
                            <td><span className="badge badge-discarded">{row.discarded}</span></td>
                            <td>{row.earliestExpiry || 'None'}</td>
                            <td><strong>{row.total}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* DONATION REPORT */}
            {reportType === 'donation' && (
              <div>
                {reportData.summary && (
                  <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                      <span className="stat-label">Total Donations</span>
                      <span className="stat-value" style={{ color: 'var(--primary)' }}>{reportData.summary.totalDonations ?? 0}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Total Volume Collected</span>
                      <span className="stat-value" style={{ color: 'var(--success)' }}>{reportData.summary.totalVolumeMl ?? 0} ml</span>
                    </div>
                  </div>
                )}
                {(!reportData.records || reportData.records.length === 0) ? (
                  <div className="alert-banner info" role="status" style={{ textAlign: 'center', padding: '1.5rem' }}>No records found.</div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Donation ID</th>
                          <th>Donor ID</th>
                          <th>Blood Group</th>
                          <th>Volume</th>
                          <th>Collection Date</th>
                          <th>Screening</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.records.map((d) => (
                          <tr key={d.donationId}>
                            <td><code>{d.donationId}</code></td>
                            <td><code>{d.donorId}</code></td>
                            <td><strong>{d.bloodGroup}</strong></td>
                            <td>{d.volumeMl} ml</td>
                            <td>{d.collectionDate}</td>
                            <td>
                              <span className={`badge ${d.screeningResult === 'Passed' ? 'badge-available' : 'badge-expired'}`}>
                                {d.screeningResult}
                              </span>
                            </td>
                            <td>{d.donationStatus}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* REQUEST REPORT */}
            {reportType === 'request' && (
              <div>
                {reportData.summary && (
                  <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                      <span className="stat-label">Total Requisitions</span>
                      <span className="stat-value" style={{ color: 'var(--primary)' }}>{reportData.summary.totalRequests ?? 0}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Units Demanded</span>
                      <span className="stat-value" style={{ color: 'var(--info)' }}>{reportData.summary.totalUnitsRequested ?? 0}</span>
                    </div>
                  </div>
                )}
                {(!reportData.records || reportData.records.length === 0) ? (
                  <div className="alert-banner info" role="status" style={{ textAlign: 'center', padding: '1.5rem' }}>No records found.</div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Request ID</th>
                          <th>Hospital</th>
                          <th>Patient</th>
                          <th>Group</th>
                          <th>Units</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Request Date</th>
                          <th>Decision Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.records.map((r) => (
                          <tr key={r.requestId}>
                            <td><code>{r.requestId}</code></td>
                            <td>{r.hospitalName}</td>
                            <td>{r.patientName}</td>
                            <td><strong>{r.bloodGroup}</strong></td>
                            <td>{r.units}</td>
                            <td>
                              <span className={`badge ${r.priority === 'Urgent' ? 'badge-urgent' : ''}`}>{r.priority}</span>
                            </td>
                            <td><span className="badge">{r.status}</span></td>
                            <td>{r.requestDate}</td>
                            <td>{r.decisionDate || 'Pending'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
