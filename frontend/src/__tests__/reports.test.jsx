import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportsModule from '../components/reports/ReportsModule.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

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

describe('Frontend ReportsModule (FR-RPT-01 to 04, FR-RPT-06, TC-09, TC-10, TC-32)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Stock Inventory report summary by default for Staff (FR-RPT-01, TC-10)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        reportType: 'stock',
        generatedAt: '2026-10-27T10:00:00Z',
        criteria: {},
        aggregates: [
          { bloodGroup: 'O+', available: 5, reserved: 1, issued: 2, expired: 0, discarded: 0, earliestExpiry: '2026-11-05', total: 8 },
        ],
        totalRecords: 8,
      }),
    });

    renderWithAuth(<ReportsModule />, 'Staff');

    expect(screen.getByText(/Management Reports & Analytics/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Stock Inventory/i })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/Blood Stock Inventory Summary/i)).toBeDefined();
      expect(screen.getByText('2026-11-05')).toBeDefined();
      expect(screen.getByTestId('stock-available-O+').textContent).toBe('5');
    });
  });

  it('allows Staff to switch to Donations Log report (FR-RPT-02)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        reportType: 'donation',
        generatedAt: '2026-10-27T10:00:00Z',
        criteria: {},
        summary: { totalDonations: 1, totalVolumeMl: 450 },
        records: [
          { donationId: 'DON-001', donorId: 'DNR-001', bloodGroup: 'O+', volumeMl: 450, collectionDate: '2026-10-01', screeningResult: 'Passed', donationStatus: 'Recorded' },
        ],
        totalRecords: 1,
      }),
    });

    renderWithAuth(<ReportsModule />, 'Staff');

    fireEvent.click(screen.getByRole('button', { name: /Donations Log/i }));

    await waitFor(() => {
      expect(screen.getByText('DON-001')).toBeDefined();
      expect(screen.getAllByText(/450\s*ml/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Total Volume Collected/i)).toBeDefined();
    });
  });

  it('allows Staff to switch to Requisitions report (FR-RPT-03, TC-32)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        reportType: 'request',
        generatedAt: '2026-10-27T10:00:00Z',
        criteria: {},
        summary: { totalRequests: 1, totalUnitsRequested: 2 },
        records: [
          { requestId: 'REQ-001', hospitalName: 'City Hospital', patientName: 'Arjun Das', bloodGroup: 'O+', units: 2, priority: 'Urgent', status: 'Pending', requestDate: '2026-10-21', decisionDate: null },
        ],
        totalRecords: 1,
      }),
    });

    renderWithAuth(<ReportsModule />, 'Staff');

    fireEvent.click(screen.getByRole('button', { name: /Requisitions/i }));

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeDefined();
      expect(screen.getByText('City Hospital')).toBeDefined();
      expect(screen.getByText('Arjun Das')).toBeDefined();
    });
  });

  it('displays "No records found" when report filters return empty data (FR-RPT-06)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        reportType: 'stock',
        generatedAt: '2026-10-27T10:00:00Z',
        criteria: { bloodGroup: 'AB-' },
        aggregates: [],
        totalRecords: 0,
        message: 'No records found',
      }),
    });

    renderWithAuth(<ReportsModule />, 'Staff');

    await waitFor(() => {
      expect(screen.queryByText('Filtering...')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText(/Blood Group/i), { target: { value: 'AB-' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Filters/i }));

    await waitFor(() => {
      expect(screen.getByText('No records found')).toBeDefined();
      expect(screen.getByText(/No matching records were found for the selected stock report filters/i)).toBeDefined();
    });
  });

  it('blocks unauthorized Hospital/Patient role with 403 banner (FR-RPT-06, TC-09)', () => {
    renderWithAuth(<ReportsModule />, 'Hospital/Patient');

    expect(screen.getByText(/Access Denied \(HTTP 403\)/i)).toBeDefined();
    expect(screen.getByText(/Report generation and analytics are restricted to authorized Blood Bank Staff and Administrators only/i)).toBeDefined();
  });

  it('triggers CSV and PDF export endpoints on button click (FR-RPT-05, TC-10)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        reportType: 'stock',
        generatedAt: '2026-10-27T10:00:00Z',
        aggregates: [{ bloodGroup: 'O+', available: 3 }],
        totalRecords: 3,
      }),
      blob: async () => new Blob(['mock content'], { type: 'text/csv' }),
    });

    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    renderWithAuth(<ReportsModule />, 'Staff');

    const csvBtn = screen.getByRole('button', { name: /Export CSV/i });
    const pdfBtn = screen.getByRole('button', { name: /Export PDF/i });
    expect(csvBtn).toBeDefined();
    expect(pdfBtn).toBeDefined();

    fireEvent.click(csvBtn);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('format=csv'));
    });

    fireEvent.click(pdfBtn);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('format=pdf'));
    });
  });
});
