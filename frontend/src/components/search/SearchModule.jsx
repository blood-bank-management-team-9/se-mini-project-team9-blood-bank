import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../services/api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function SearchModule({ defaultTab = 'stock' }) {
  const { user } = useAuth();
  const role = user?.role || '';
  const isStaffOrAdmin = role === 'Staff' || role === 'Admin';

  const [activeSearchType, setActiveSearchType] = useState(defaultTab || 'stock');

  // Stock search state
  const [stockBloodGroup, setStockBloodGroup] = useState('O+');
  const [stockResult, setStockResult] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');
  const [stockSearched, setStockSearched] = useState(false);

  // Donor search state
  const [donorFilters, setDonorFilters] = useState({ bloodGroup: '', city: '', pin: '' });
  const [donorPage, setDonorPage] = useState(1);
  const [donorResult, setDonorResult] = useState(null);
  const [donorLoading, setDonorLoading] = useState(false);
  const [donorError, setDonorError] = useState('');
  const [donorSearched, setDonorSearched] = useState(false);

  // Stock Search — uses GET /api/search/stock?bloodGroup=O%2B
  const handleStockSearch = async (e) => {
    if (e) e.preventDefault();
    setStockLoading(true);
    setStockSearched(true);
    setStockError('');
    try {
      // encodeURIComponent converts O+ → O%2B
      const data = await apiGet(`/api/search/stock?bloodGroup=${encodeURIComponent(stockBloodGroup)}`);
      setStockResult(data);
    } catch (err) {
      setStockError(err.message || 'Search failed');
      setStockResult(null);
    } finally {
      setStockLoading(false);
    }
  };

  // Donor Search — uses GET /api/search/donors
  const handleDonorSearch = async (page = 1) => {
    if (!isStaffOrAdmin) return;
    setDonorLoading(true);
    setDonorSearched(true);
    setDonorPage(page);
    setDonorError('');

    const queryParams = new URLSearchParams();
    if (donorFilters.bloodGroup) queryParams.append('bloodGroup', donorFilters.bloodGroup);
    if (donorFilters.city) queryParams.append('city', donorFilters.city);
    if (donorFilters.pin) queryParams.append('pin', donorFilters.pin);
    queryParams.append('page', page);
    queryParams.append('limit', 20);

    try {
      const data = await apiGet(`/api/search/donors?${queryParams.toString()}`);
      setDonorResult(data);
    } catch (err) {
      setDonorError(err.message || 'Search failed');
      setDonorResult(null);
    } finally {
      setDonorLoading(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="panel-title" style={{ fontSize: '1.5rem' }}>
            {activeSearchType === 'stock' ? 'Blood Stock Search (FR-SRCH-01, 02)' : 'Eligible Donor Search (FR-SRCH-03, 06)'}
          </h1>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
            {activeSearchType === 'stock'
              ? 'Query unreserved, available and unexpired blood units across all 8 ABO/Rh groups.'
              : 'Find active donors currently eligible for voluntary blood donation.'}
          </p>
        </div>

        {isStaffOrAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={activeSearchType === 'stock' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveSearchType('stock')}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
            >
              🩸 Blood Stock
            </button>
            <button
              type="button"
              className={activeSearchType === 'donors' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveSearchType('donors')}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
            >
              👥 Eligible Donors
            </button>
          </div>
        )}
      </div>

      {/* RBAC Warning */}
      {!isStaffOrAdmin && activeSearchType === 'donors' && (
        <div className="alert-banner danger" role="alert" style={{ margin: '1.5rem 0' }}>
          <strong>Access Denied (HTTP 403):</strong> Donor search is restricted to authorized Blood Bank Staff only.
        </div>
      )}

      {/* ── STOCK SEARCH ─────────────────────────────────────────────────── */}
      {activeSearchType === 'stock' && (
        <div style={{ marginTop: '1.5rem' }}>
          <form onSubmit={handleStockSearch} className="form-grid" style={{ alignItems: 'flex-end', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="stockBloodGroup">
                Select Blood Group <span className="req">*</span>
              </label>
              <select
                id="stockBloodGroup"
                value={stockBloodGroup}
                onChange={(e) => setStockBloodGroup(e.target.value)}
                className="form-select"
              >
                {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <button type="submit" className="btn-primary" disabled={stockLoading} style={{ width: '100%', padding: '0.65rem 1rem' }}>
                {stockLoading ? 'Searching…' : '🔍 Search Stock'}
              </button>
            </div>
          </form>

          {stockError && (
            <div className="alert-banner danger" role="alert" style={{ marginTop: '1rem' }}>{stockError}</div>
          )}

          {stockSearched && !stockError && stockResult && (
            <div style={{ marginTop: '2rem' }}>
              {(stockResult.availableUnits === 0 || (stockResult.units && stockResult.units.length === 0)) ? (
                <div className="alert-banner info" role="status" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--slate-800)' }}>
                    No matching results found
                  </h3>
                  <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem' }}>
                    No unreserved, unexpired units of blood group <strong>{stockBloodGroup}</strong> are currently in stock.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                      <span className="stat-label">Blood Group</span>
                      <span className="stat-value" style={{ color: 'var(--primary)' }}>{stockResult.bloodGroup}</span>
                      <span className="stat-desc">ABO / Rh D group</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Available Units</span>
                      <span className="stat-value" data-testid="stat-available-units" style={{ color: 'var(--success)' }}>
                        {stockResult.availableUnits}
                      </span>
                      <span className="stat-desc">Ready for allocation</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Earliest Expiry Date</span>
                      <span className="stat-value" style={{ fontSize: '1.25rem' }}>
                        {stockResult.earliestExpiry || 'N/A'}
                      </span>
                      <span className="stat-desc">FEFO allocation order</span>
                    </div>
                  </div>

                  {isStaffOrAdmin && Array.isArray(stockResult.units) && stockResult.units.length > 0 && (
                    <div className="table-wrap">
                      <div style={{ padding: '0.75rem 1rem', background: 'var(--slate-100)', borderBottom: '1px solid var(--slate-200)', fontSize: '0.85rem', color: 'var(--slate-700)', fontWeight: 600 }}>
                        Available Unit Breakdown (Staff View)
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Unit ID</th>
                            <th>Blood Group</th>
                            <th>Expiry Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockResult.units.map((u) => (
                            <tr key={u.unitId}>
                              <td><code>{u.unitId}</code></td>
                              <td><strong>{stockResult.bloodGroup}</strong></td>
                              <td>{u.expiryDate ?? u.expiry_date}</td>
                              <td><span className="badge badge-available">Available</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!isStaffOrAdmin && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.75rem' }}>
                      ℹ️ Individual unit barcodes and donor identities are withheld from requester results (FR-SRCH-02).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DONOR SEARCH ─────────────────────────────────────────────────── */}
      {activeSearchType === 'donors' && isStaffOrAdmin && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="form-guidance" style={{ marginBottom: '1.25rem' }}>
            💡 <strong>Eligibility Search (FR-SRCH-03, BR-03):</strong> Filters Active donors meeting age, weight, and rest period requirements.
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); handleDonorSearch(1); }}
            className="form-grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'flex-end' }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="donorBloodGroup">Blood Group</label>
              <select
                id="donorBloodGroup" value={donorFilters.bloodGroup} className="form-select"
                onChange={(e) => setDonorFilters((prev) => ({ ...prev, bloodGroup: e.target.value }))}
              >
                <option value="">All Blood Groups</option>
                {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="donorCity">City / Region</label>
              <input
                id="donorCity" type="text" className="form-input"
                placeholder="e.g. Bangalore"
                value={donorFilters.city}
                onChange={(e) => setDonorFilters((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="donorPin">Postal PIN Code</label>
              <input
                id="donorPin" type="text" className="form-input"
                placeholder="e.g. 560001" maxLength={6}
                value={donorFilters.pin}
                onChange={(e) => setDonorFilters((prev) => ({ ...prev, pin: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <button type="submit" className="btn-primary" disabled={donorLoading} style={{ width: '100%', padding: '0.65rem 1rem' }}>
                {donorLoading ? 'Filtering…' : '🔍 Filter Donors'}
              </button>
            </div>
          </form>

          {donorError && (
            <div className="alert-banner danger" role="alert" style={{ marginTop: '1rem' }}>{donorError}</div>
          )}

          {donorSearched && !donorError && donorResult && (
            <div style={{ marginTop: '2rem' }}>
              {!donorResult.donors || donorResult.donors.length === 0 ? (
                <div className="alert-banner info" role="status" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--slate-800)' }}>
                    No matching results found
                  </h3>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                      Showing <strong>{((donorResult.page - 1) * donorResult.limit) + 1}</strong>–
                      <strong>{Math.min(donorResult.page * donorResult.limit, donorResult.total)}</strong> of{' '}
                      <strong>{donorResult.total}</strong> eligible donors
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Donor ID</th>
                          <th>Full Name</th>
                          <th>Blood Group</th>
                          <th>City</th>
                          <th>Phone Number</th>
                          <th>Last Donated</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {donorResult.donors.map((d) => (
                          <tr key={d.donorId}>
                            <td><code>{d.donorId}</code></td>
                            <td><strong>{d.name ?? d.fullName}</strong></td>
                            <td><span className="badge badge-issued">{d.bloodGroup}</span></td>
                            <td>{d.city ?? '—'}</td>
                            <td>{d.phone}</td>
                            <td>{d.lastDonationDate || 'First-time donor'}</td>
                            <td><span className="badge badge-available">Eligible</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
                      Page {donorResult.page} of {donorResult.totalPages}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button" className="btn-secondary"
                        disabled={donorResult.page <= 1 || donorLoading}
                        onClick={() => handleDonorSearch(donorResult.page - 1)}
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                      >
                        ← Previous
                      </button>
                      <button
                        type="button" className="btn-secondary"
                        disabled={donorResult.page >= donorResult.totalPages || donorLoading}
                        onClick={() => handleDonorSearch(donorResult.page + 1)}
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
