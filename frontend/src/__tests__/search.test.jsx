import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchModule from '../components/search/SearchModule.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

// Helper to render with a specific mock user and role
function renderWithAuth(ui, role = 'Staff') {
  const mockUser = {
    id: `USR-${role.toUpperCase().slice(0, 3)}`,
    name: `Test ${role}`,
    role,
  };
  return render(
    <AuthContext.Provider value={{ user: mockUser, role, login: vi.fn(), logout: vi.fn() }}>
      {ui}
    </AuthContext.Provider>
  );
}

describe('Frontend SearchModule (FR-SRCH-01 to FR-SRCH-06, TC-09, TC-12, TC-26)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders stock search form by default for Hospital/Patient (FR-SRCH-01)', () => {
    renderWithAuth(<SearchModule />, 'Hospital/Patient');
    expect(screen.getByText(/Blood Stock Search/i)).toBeDefined();
    expect(screen.getByLabelText(/Select Blood Group/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Search Stock/i })).toBeDefined();

    // Hospital user should NOT see the tab button to switch to donor search
    expect(screen.queryByRole('button', { name: /Eligible Donors/i })).toBeNull();
  });

  it('allows Hospital/Patient to search stock and displays count + earliest expiry without unit IDs (FR-SRCH-02, TC-12)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        bloodGroup: 'O+',
        availableUnits: 3,
        earliestExpiry: '2026-11-05',
        criteria: { bloodGroup: 'O+' },
      }),
    });

    renderWithAuth(<SearchModule />, 'Hospital/Patient');

    fireEvent.change(screen.getByLabelText(/Select Blood Group/i), { target: { value: 'O+' } });
    fireEvent.click(screen.getByRole('button', { name: /Search Stock/i }));

    await waitFor(() => {
      expect(screen.getByTestId('stat-available-units').textContent).toBe('3');
      expect(screen.getByText('2026-11-05')).toBeDefined();
    });

    // Asserts no unit IDs or breakdown table shown to Hospital/Patient
    expect(screen.queryByText(/Available Unit Breakdown/i)).toBeNull();
    expect(screen.getByText(/individual unit barcodes and donor identities are withheld/i)).toBeDefined();
  });

  it('allows Staff to view unit IDs and expiry dates in stock search (FR-SRCH-02, TC-12)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        bloodGroup: 'O+',
        availableUnits: 1,
        earliestExpiry: '2026-11-05',
        criteria: { bloodGroup: 'O+' },
        units: [{ unitId: 'UNT-00000001', expiryDate: '2026-11-05' }],
      }),
    });

    renderWithAuth(<SearchModule />, 'Staff');

    fireEvent.click(screen.getByRole('button', { name: /Search Stock/i }));

    await waitFor(() => {
      expect(screen.getByText('UNT-00000001')).toBeDefined();
      expect(screen.getByText(/Available Unit Breakdown \(Staff View\)/i)).toBeDefined();
    });
  });

  it('displays "No matching results found" with criteria when 0 units found (FR-SRCH-05, TC-12)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        bloodGroup: 'AB-',
        availableUnits: 0,
        earliestExpiry: null,
        criteria: { bloodGroup: 'AB-' },
        message: 'No matching results found',
      }),
    });

    renderWithAuth(<SearchModule />, 'Staff');

    fireEvent.change(screen.getByLabelText(/Select Blood Group/i), { target: { value: 'AB-' } });
    fireEvent.click(screen.getByRole('button', { name: /Search Stock/i }));

    await waitFor(() => {
      expect(screen.getByText('No matching results found')).toBeDefined();
      expect(screen.getByText(/Criteria searched: Blood Group/i)).toBeDefined();
      expect(screen.getAllByText('AB-').length).toBeGreaterThan(0);
    });
  });

  it('allows Staff to search eligible donors with pagination controls (FR-SRCH-03, FR-SRCH-06, TC-26)', async () => {
    const mockDonors = Array.from({ length: 20 }, (_, i) => ({
      donorId: `DNR-000${i + 1}`,
      name: `Eligible Donor ${i + 1}`,
      bloodGroup: 'O+',
      city: 'Bangalore',
      phone: `987654320${i % 10}`,
      lastDonationDate: '2026-05-01',
    }));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        donors: mockDonors,
        total: 45,
        page: 1,
        limit: 20,
        totalPages: 3,
        criteria: { bloodGroup: 'O+' },
      }),
    });

    renderWithAuth(<SearchModule defaultTab="donors" />, 'Staff');

    expect(screen.getByText(/Eligible Donor Search/i)).toBeDefined();
    expect(screen.getByLabelText(/City \/ Region/i)).toBeDefined();

    // Submit filter form
    const filterBtn = screen.getByRole('button', { name: /Filter Donors/i });
    fireEvent.click(filterBtn);

    expect(await screen.findByText('DNR-0001')).toBeDefined();
    expect(await screen.findByText('Eligible Donor 1')).toBeDefined();
    expect(screen.getByText(/eligible donors \(FR-SRCH-06\)/i)).toBeDefined();
    expect(screen.getByText(/Page 1 of 3/i)).toBeDefined();

    // Pagination buttons exist and Previous is disabled on page 1
    const prevBtn = screen.getByRole('button', { name: /Previous/i });
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
  });

  it('blocks non-staff users from accessing donor search with 403 banner (FR-SRCH-04, TC-09)', () => {
    renderWithAuth(<SearchModule defaultTab="donors" />, 'Hospital/Patient');

    expect(screen.getByText(/Access Denied \(HTTP 403\)/i)).toBeDefined();
    expect(screen.getByText(/Donor search and personal donor details are restricted to authorized Blood Bank Staff only/i)).toBeDefined();
  });
});
