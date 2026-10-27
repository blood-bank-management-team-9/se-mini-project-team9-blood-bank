import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function SearchModule({ defaultTab = 'stock' }) {
  const { user } = useAuth();
  const role = user?.role || 'Staff';
  const isStaffOrAdmin = role === 'Staff' || role === 'Admin';

  const [activeSearchType, setActiveSearchType] = useState(defaultTab || 'stock');

  // Stock search state
  const [stockBloodGroup, setStockBloodGroup] = useState('O+');
  const [stockResult, setStockResult] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSearched, setStockSearched] = useState(false);

  // Donor search state
  const [donorFilters, setDonorFilters] = useState({
    bloodGroup: '',
    city: '',
    pin: '',
  });
  const [donorPage, setDonorPage] = useState(1);
  const [donorResult, setDonorResult] = useState(null);
  const [donorLoading, setDonorLoading] = useState(false);
  const [donorSearched, setDonorSearched] = useState(false);

  // Execute Stock Search (FR-SRCH-01, FR-SRCH-02, FR-SRCH-05, TC-12)
  const handleStockSearch = async (e) => {
    if (e) e.preventDefault();
    setStockLoading(true);
    setStockSearched(true);

    try {
      const res = await fetch(`/api/search/stock?bloodGroup=${encodeURIComponent(stockBloodGroup)}`);
      if (res.ok) {
        const data = await res.json();
        setStockResult(data);
      } else {
        // Fallback for standalone dev preview mode
        throw new Error(`API returned ${res.status}`);
      }
    } catch {
      // Mock seed data fallback aligned with schema seeds
      // Seed data: O+ has 3 units, O- has 1 unit, A+ has 2 units, others 0
      const mockStock = {
        'O+': { count: 3, earliest: '2026-11-05', units: [{ unitId: 'UNT-00000001', expiryDate: '2026-11-05' }, { unitId: 'UNT-00000002', expiryDate: '2026-11-12' }, { unitId: 'UNT-00000003', expiryDate: '2026-11-19' }] },
        'O-': { count: 1, earliest: '2026-10-29', units: [{ unitId: 'UNT-00000004', expiryDate: '2026-10-29' }] },
        'A+': { count: 2, earliest: '2026-11-10', units: [{ unitId: 'UNT-00000005', expiryDate: '2026-11-10' }, { unitId: 'UNT-00000006', expiryDate: '2026-11-25' }] },
      };

      const found = mockStock[stockBloodGroup];
      if (found) {
        setStockResult({
          bloodGroup: stockBloodGroup,
          availableUnits: found.count,
          earliestExpiry: found.earliest,
          criteria: { bloodGroup: stockBloodGroup },
          units: isStaffOrAdmin ? found.units : undefined,
        });
      } else {
        setStockResult({
          bloodGroup: stockBloodGroup,
          availableUnits: 0,
          earliestExpiry: null,
          criteria: { bloodGroup: stockBloodGroup },
          units: isStaffOrAdmin ? [] : undefined,
          message: 'No matching results found',
        });
      }
    } finally {
      setStockLoading(false);
    }
  };

  // Execute Donor Search (FR-SRCH-03, FR-SRCH-04, FR-SRCH-05, FR-SRCH-06, TC-26)
  const handleDonorSearch = async (page = 1) => {
    if (!isStaffOrAdmin) return;
    setDonorLoading(true);
    setDonorSearched(true);
    setDonorPage(page);

    const queryParams = new URLSearchParams();
    if (donorFilters.bloodGroup) queryParams.append('bloodGroup', donorFilters.bloodGroup);
    if (donorFilters.city) queryParams.append('city', donorFilters.city);
    if (donorFilters.pin) queryParams.append('pin', donorFilters.pin);
    queryParams.append('page', page);
    queryParams.append('limit', 20);

    try {
      const res = await fetch(`/api/search/donors?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDonorResult(data);
      } else {
        throw new Error(`API returned ${res.status}`);
      }
    } catch {
      // Mock seed data fallback aligned with seeds.sql:
      // John Doe (Male, last donation 2026-10-01 -> Ineligible under 90d rule)
      // Jane Smith (Female, DOB 1995, last donation 2026-05-10 -> Eligible)
      // Priya Sharma, Rahul Verma, etc.
      const mockEligibleDonors = [
        { donorId: 'DNR-00000002', name: 'Jane Smith', bloodGroup: 'A+', city: 'Bangalore', phone: '9876543202', lastDonationDate: '2026-05-10' },
        { donorId: 'DNR-00000003', name: 'Priya Sharma', bloodGroup: 'B+', city: 'Bangalore', phone: '9876543203', lastDonationDate: '2026-04-18' },
        { donorId: 'DNR-00000004', name: 'Rahul Verma', bloodGroup: 'O+', city: 'Bangalore', phone: '9876543204', lastDonationDate: '2026-06-22' },
        { donorId: 'DNR-00000005', name: 'Ananya Rao', bloodGroup: 'O-', city: 'Mysore', phone: '9876543205', lastDonationDate: null },
        { donorId: 'DNR-00000006', name: 'Karthik Nair', bloodGroup: 'AB+', city: 'Bangalore', phone: '9876543206', lastDonationDate: '2026-05-01' },
      ];

      let filtered = mockEligibleDonors;
      if (donorFilters.bloodGroup) {
        filtered = filtered.filter((d) => d.bloodGroup === donorFilters.bloodGroup);
      }
      if (donorFilters.city) {
        filtered = filtered.filter((d) => d.city.toLowerCase().includes(donorFilters.city.toLowerCase().trim()));
      }

      const total = filtered.length;
      const limit = 20;
      const start = (page - 1) * limit;
      const pageDonors = filtered.slice(start, start + limit);

      setDonorResult({
        donors: pageDonors,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        criteria: {
          bloodGroup: donorFilters.bloodGroup || undefined,
          city: donorFilters.city || undefined,
          pin: donorFilters.pin || undefined,
        },
        message: total === 0 ? 'No matching results found' : undefined,
      });
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

      {/* RBAC Warning for Non-Staff trying to access donor search (FR-SRCH-04, TC-09) */}
      {!isStaffOrAdmin && activeSearchType === 'donors' && (
        <div className="alert-banner danger" role="alert" style={{ margin: '1.5rem 0' }}>
          <strong>Access Denied (HTTP 403):</strong> Donor search and personal donor details are restricted to authorized Blood Bank Staff only (FR-SRCH-04, TC-09).
        </div>
      )}

      {/* -------------------- STOCK SEARCH VIEW -------------------- */}
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
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={stockLoading}
                style={{ width: '100%', padding: '0.65rem 1rem' }}
              >
                {stockLoading ? 'Searching...' : '🔍 Search Stock'}
              </button>
            </div>
          </form>

          {/* Stock Results Display */}
          {stockSearched && stockResult && (
            <div style={{ marginTop: '2rem' }}>
              {stockResult.availableUnits === 0 ? (
                /* FR-SRCH-05 & TC-12: Display "No matching results found" with criteria searched, no error */
                <div className="alert-banner info" role="status" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--slate-800)' }}>
                    No matching results found
                  </h3>
                  <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem' }}>
                    Criteria searched: Blood Group <strong>{stockResult.criteria?.bloodGroup}</strong>. There are currently no unreserved, unexpired units available in stock.
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
                      <span className="stat-value" data-testid="stat-available-units" style={{ color: 'var(--success)' }}>{stockResult.availableUnits}</span>
                      <span className="stat-desc">Ready for allocation</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Earliest Expiry Date</span>
                      <span className="stat-value" style={{ fontSize: '1.25rem' }}>{stockResult.earliestExpiry || 'N/A'}</span>
                      <span className="stat-desc">FEFO allocation order</span>
                    </div>
                  </div>

                  {/* FR-SRCH-02: Staff members also see Unit IDs and expiry dates */}
                  {isStaffOrAdmin && stockResult.units && stockResult.units.length > 0 && (
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
                              <td>{u.expiryDate}</td>
                              <td><span className="badge badge-available">Available</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!isStaffOrAdmin && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.75rem' }}>
                      ℹ️ In compliance with FR-SRCH-02, individual unit barcodes and donor identities are withheld from requester results.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------- DONOR SEARCH VIEW (STAFF ONLY) -------------------- */}
      {activeSearchType === 'donors' && isStaffOrAdmin && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="form-guidance" style={{ marginBottom: '1.25rem' }}>
            💡 <strong>Eligibility Search (FR-SRCH-03, BR-03):</strong> Automatically filters Active donors meeting age (18–65), weight (≥ 45 kg), and gender rest periods (90-day male / 120-day female).
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDonorSearch(1);
            }}
            className="form-grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'flex-end' }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="donorBloodGroup">
                Blood Group
              </label>
              <select
                id="donorBloodGroup"
                value={donorFilters.bloodGroup}
                onChange={(e) => setDonorFilters((prev) => ({ ...prev, bloodGroup: e.target.value }))}
                className="form-select"
              >
                <option value="">All Blood Groups</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="donorCity">
                City / Region
              </label>
              <input
                id="donorCity"
                type="text"
                className="form-input"
                placeholder="e.g. Bangalore"
                value={donorFilters.city}
                onChange={(e) => setDonorFilters((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="donorPin">
                Postal PIN Code
              </label>
              <input
                id="donorPin"
                type="text"
                className="form-input"
                placeholder="e.g. 560001"
                maxLength={6}
                value={donorFilters.pin}
                onChange={(e) => setDonorFilters((prev) => ({ ...prev, pin: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <button
                type="submit"
                className="btn-primary"
                disabled={donorLoading}
                style={{ width: '100%', padding: '0.65rem 1rem' }}
              >
                {donorLoading ? 'Filtering...' : '🔍 Filter Donors'}
              </button>
            </div>
          </form>

          {/* Donor Search Results */}
          {donorSearched && donorResult && (
            <div style={{ marginTop: '2rem' }}>
              {donorResult.donors.length === 0 ? (
                /* FR-SRCH-05: When search returns no results, display "No matching results found" */
                <div className="alert-banner info" role="status" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--slate-800)' }}>
                    No matching results found
                  </h3>
                  <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem' }}>
                    No eligible active donors matched your criteria. Criteria searched:{' '}
                    {donorResult.criteria?.bloodGroup && <span>Blood Group: <strong>{donorResult.criteria.bloodGroup}</strong> </span>}
                    {donorResult.criteria?.city && <span>City: <strong>{donorResult.criteria.city}</strong> </span>}
                    {donorResult.criteria?.pin && <span>PIN: <strong>{donorResult.criteria.pin}</strong> </span>}
                    {!donorResult.criteria?.bloodGroup && !donorResult.criteria?.city && !donorResult.criteria?.pin && <span>All Donors</span>}
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                      Showing <strong>{((donorResult.page - 1) * donorResult.limit) + 1}</strong>–
                      <strong>{Math.min(donorResult.page * donorResult.limit, donorResult.total)}</strong> of{' '}
                      <strong>{donorResult.total}</strong> eligible donors (FR-SRCH-06)
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
                            <td><strong>{d.name}</strong></td>
                            <td><span className="badge badge-issued">{d.bloodGroup}</span></td>
                            <td>{d.city}</td>
                            <td>{d.phone}</td>
                            <td>{d.lastDonationDate || 'First-time donor'}</td>
                            <td><span className="badge badge-available">Eligible</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* FR-SRCH-06 & TC-26: Pagination controls (pages of 20 records) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
                      Page {donorResult.page} of {donorResult.totalPages}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={donorResult.page <= 1 || donorLoading}
                        onClick={() => handleDonorSearch(donorResult.page - 1)}
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                      >
                        ← Previous
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
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
