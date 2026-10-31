import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost } from '../../services/api';

export default function DonorDashboard() {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [notLinked, setNotLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  const fetchDonorData = async (cancelled = false) => {
    try {
      const res = await apiGet('/api/donors/me/donations');
      if (!cancelled) {
        setData(res);
        setNotLinked(false);
        setError('');
      }
    } catch (err) {
      if (!cancelled) {
        if (err.code === 'DONOR_NOT_LINKED' || err.type === 'forbidden') {
          setNotLinked(true);
        } else {
          setError(err.message || 'Failed to load donor data');
        }
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchDonorData(cancelled);
    return () => { cancelled = true; };
  }, [user]);

  const handleLinkAccount = async () => {
    setLinking(true);
    setError('');
    try {
      await apiPost('/api/donors/me/link');
      // Re-fetch data after successful linking
      setLoading(true);
      await fetchDonorData();
    } catch (err) {
      setError(err.message || 'Failed to link donor record. Ensure your phone number matches a record created by Staff.');
      setLinking(false);
    }
  };

  if (loading) {
    return <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>Loading donor portal…</div>;
  }

  // Case A: user has no linked donor record
  if (notLinked) {
    return (
      <div>
        <div className="dashboard-header">
          <h1 className="dashboard-title">Donor Portal</h1>
          <p className="dashboard-subtitle">Track your donation journey, eligibility dates, and personal contribution.</p>
        </div>

        <div className="alert-banner info" style={{ marginBottom: '1.5rem' }} role="region" aria-label="Donor profile incomplete">
          <span className="alert-badge-label">ACTION REQUIRED</span>
          <span>
            <strong>Your donor profile is incomplete.</strong>{' '}
            If Staff has already registered your donor record with your phone number, click the button below to link it to this account.
          </span>
        </div>

        {error && <div className="alert-banner danger" role="alert" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem', color: 'var(--slate-600)' }}>
            Not linked yet? Try linking your account now.
          </p>
          <button className="btn-primary" onClick={handleLinkAccount} disabled={linking}>
            {linking ? 'Linking…' : 'Link My Donor Record'}
          </button>
        </div>

        <div className="stats-grid" style={{ marginTop: '2rem', opacity: 0.5 }}>
          <div className="stat-card">
            <span className="stat-label">Blood Group</span>
            <span className="stat-value" style={{ color: 'var(--slate-400)' }}>—</span>
            <span className="stat-desc">Not set (donor record missing)</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Eligibility Status</span>
            <span className="stat-value" style={{ color: 'var(--slate-500)', fontSize: '1.15rem' }}>Not evaluated</span>
            <span className="stat-desc">Donor record missing</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Donations</span>
            <span className="stat-value">0</span>
            <span className="stat-desc">Lifetime units contributed</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Last Donated</span>
            <span className="stat-value" style={{ fontSize: '1.2rem' }}>None</span>
            <span className="stat-desc">Next eligible: not applicable</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="alert-banner danger" role="alert">{error}</div>;
  }

  // Case B: donor record linked. Show real data.
  const { bloodGroup, eligibility, donations } = data;
  const isEligible = eligibility?.eligible;
  const reasons = eligibility?.ineligibilityReasons || [];
  const nextDate = eligibility?.nextEligibleDate;
  const lastDonationDate = donations.length > 0 ? donations[0].collectionDate : null;

  return (
    <div>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Donor Portal</h1>
        <p className="dashboard-subtitle">Track your donation journey, eligibility dates, and personal contribution.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Blood Group</span>
          <span className="stat-value" style={{ color: 'var(--primary)' }}>{bloodGroup || '—'}</span>
          <span className="stat-desc">From your donor record</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Eligibility Status</span>
          <span
            className="stat-value"
            style={{
              color: isEligible ? 'var(--success)' : 'var(--danger)',
              fontSize: '1.25rem',
            }}
          >
            {isEligible ? 'Eligible' : 'Not Eligible'}
          </span>
          <span className="stat-desc">
            {isEligible ? 'Ready to donate' : (nextDate ? `Next eligible: ${nextDate}` : 'See reasons below')}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Donations</span>
          <span className="stat-value">{donations.length}</span>
          <span className="stat-desc">Lifetime units contributed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Last Donated</span>
          <span className="stat-value" style={{ fontSize: '1.2rem' }}>{lastDonationDate ?? 'None'}</span>
          <span className="stat-desc">Most recent donation</span>
        </div>
      </div>

      {!isEligible && reasons.length > 0 && (
        <div className="alert-banner warning" style={{ marginBottom: '1.5rem' }} role="region">
          <strong>Why you cannot donate right now:</strong>
          <ul>
            {reasons.map((r, i) => <li key={i}>{r.message}</li>)}
          </ul>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">My Donation History</h2>
        </div>

        {donations.length === 0 ? (
          <div className="empty-state">
            <p><strong>No donations recorded yet</strong></p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Your future donations will appear here.
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
                </tr>
              </thead>
              <tbody>
                {donations.map((h) => (
                  <tr key={h.donationId}>
                    <td><code>{h.donationId}</code></td>
                    <td>{h.collectionDate}</td>
                    <td><strong>{h.bloodGroup}</strong></td>
                    <td>{h.volumeMl ? `${h.volumeMl} ml` : '—'}</td>
                    <td>
                      <span className={`badge ${h.screeningStatus === 'Passed' ? 'badge-issued' : 'badge-rejected'}`}>
                        {h.screeningStatus}
                      </span>
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