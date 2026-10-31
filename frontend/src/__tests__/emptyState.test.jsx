import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DonorDashboard from '../components/dashboards/DonorDashboard.jsx';
import BloodRequestForm from '../components/forms/BloodRequestForm.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * Helper to render a component with a specific mocked auth session.
 * Now that AuthContext uses real API calls, we inject a mock context value directly.
 */
function renderWithAuth(ui, user = null) {
  const mockCtx = {
    user,
    role: user?.role ?? null,
    authLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    setUser: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={mockCtx}>
      {ui}
    </AuthContext.Provider>
  );
}

describe('App & Component DOM Rendering Tests (TC-07, TC-13, TC-24, SAD 4.4, SAD 4.5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock fetch to return empty donor data so DonorDashboard doesn't hang
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders DonorDashboard empty state "No donations recorded yet" when donations list is empty (TC-24, SAD 4.5)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ donations: [] }),
    });

    const mockDonor = { userId: 'USR-001', name: 'John Doe', role: 'Donor', email: 'john@test.com' };
    renderWithAuth(<DonorDashboard />, mockDonor);

    // The component fetches data and eventually shows the empty state
    await waitFor(() => {
      expect(screen.getByText('No donations recorded yet')).toBeDefined();
    });
    expect(screen.getByText(/Your future donations will appear here/i)).toBeDefined();
  });

  it('renders DonorDashboard table rows when donations exist and does not show empty state', async () => {
    const mockDonations = [
      {
        donationId: 'DON-00000001',
        collectionDate: '2026-10-15',
        bloodGroup: 'O+',
        volumeMl: 450,
        screeningStatus: 'Passed',
        unitId: 'UNT-00000001',
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ donations: mockDonations }),
    });

    const mockDonor = { userId: 'USR-001', name: 'John Doe', role: 'Donor', email: 'john@test.com' };
    renderWithAuth(<DonorDashboard />, mockDonor);

    await waitFor(() => {
      expect(screen.queryByText('No donations recorded yet')).toBeNull();
      expect(screen.getByText('DON-00000001')).toBeDefined();
    });
  });

  it('handles SAD 4.4 server error response in BloodRequestForm without redirecting (TC-13)', async () => {
    const onSuccessMock = vi.fn();
    const onCancelMock = vi.fn();

    // Mock CSRF fetch then the POST failure
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'test-token' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Requested units exceeds available inventory for O+',
            fields: [
              { field: 'units', message: 'Maximum 5 units can be requested at one time' },
              { field: 'hospitalName', message: 'Hospital license verification pending' },
            ],
          },
        }),
      });

    const mockUser = { userId: 'USR-HSP01', name: 'City Hospital', role: 'Hospital/Patient' };
    renderWithAuth(<BloodRequestForm onSuccess={onSuccessMock} onCancel={onCancelMock} />, mockUser);

    // Fill valid client fields
    fireEvent.change(screen.getByLabelText(/Patient Full Name/i), { target: { name: 'patientName', value: 'Alice Smith' } });
    fireEvent.change(screen.getByLabelText(/Required By Date/i), { target: { name: 'requiredByDate', value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText(/Emergency Contact Number/i), { target: { name: 'contactNumber', value: '9876543210' } });
    fireEvent.change(screen.getByLabelText(/Hospital \/ Clinic Name/i), { target: { name: 'hospitalName', value: 'Test Hospital' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Submit Requisition/i });
    fireEvent.click(submitBtn);

    // Assert that data.error.message is displayed
    await waitFor(() => {
      expect(screen.getByText('Requested units exceeds available inventory for O+')).toBeDefined();
    });

    // Assert inline field errors from SAD 4.4 fields[]
    expect(screen.getByText('Maximum 5 units can be requested at one time')).toBeDefined();
    expect(screen.getByText('Hospital license verification pending')).toBeDefined();

    // Crucial: ensure it did NOT redirect on failure
    expect(onSuccessMock).not.toHaveBeenCalled();
  });

  it('redirects only on successful blood request submission (201 Created)', async () => {
    vi.useFakeTimers();
    const onSuccessMock = vi.fn();

    // Mock CSRF fetch then successful POST
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'test-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          requestId: 'REQ-00000001',
          status: 'Pending',
        }),
      });

    const mockUser = { userId: 'USR-HSP01', name: 'City Hospital', role: 'Hospital/Patient' };
    renderWithAuth(<BloodRequestForm onSuccess={onSuccessMock} onCancel={() => {}} />, mockUser);

    fireEvent.change(screen.getByLabelText(/Patient Full Name/i), { target: { name: 'patientName', value: 'Bob Jones' } });
    fireEvent.change(screen.getByLabelText(/Required By Date/i), { target: { name: 'requiredByDate', value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText(/Emergency Contact Number/i), { target: { name: 'contactNumber', value: '9876543210' } });
    fireEvent.change(screen.getByLabelText(/Hospital \/ Clinic Name/i), { target: { name: 'hospitalName', value: 'Test Hospital' } });

    fireEvent.click(screen.getByRole('button', { name: /Submit Requisition/i }));

    await vi.waitFor(() => {
      expect(screen.getByText(/Blood requisition submitted!/i)).toBeDefined();
    });

    // Before timer expires, onSuccess is not called
    expect(onSuccessMock).not.toHaveBeenCalled();

    // Fast forward timer 2000ms
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onSuccessMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
