import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import DonorDashboard from '../components/dashboards/DonorDashboard.jsx';
import StaffDashboard from '../components/dashboards/StaffDashboard.jsx';
import BloodRequestForm from '../components/forms/BloodRequestForm.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

describe('App & Component DOM Rendering Tests (TC-07, TC-13, TC-24, SAD 4.4, SAD 4.5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders full App shell with navigation and default Staff dashboard', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    // Verify app brand and navigation elements render
    await waitFor(() => {
      expect(screen.getByText(/Blood Bank Management System/i)).toBeDefined();
    });
    expect(screen.getByText(/Nurse Joy/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Register Donor/i })).toBeDefined();

    // Verify TC-07 low stock alert renders on staff dashboard
    expect(screen.getByText(/Low Stock Alert: O-/i)).toBeDefined();
  });

  it('renders DonorDashboard empty state "No donations recorded yet" when initialDonations is empty (TC-24, SAD 4.5)', () => {
    render(
      <AuthProvider>
        <DonorDashboard initialDonations={[]} />
      </AuthProvider>
    );

    // Assert the exact SAD 4.5 string is rendered in DOM
    const emptyNotice = screen.getByText('No donations recorded yet');
    expect(emptyNotice).toBeDefined();
    expect(emptyNotice.textContent).toBe('No donations recorded yet');
    expect(screen.getByText(/Your future donations at any certified camp or center will appear here/i)).toBeDefined();
  });

  it('renders DonorDashboard table rows when donations exist and does not show empty state', () => {
    const mockDonations = [
      {
        id: 'DON-001',
        date: '2026-10-15',
        bloodGroup: 'O+',
        volume: '450 ml',
        screening: 'Passed',
        status: 'Recorded',
      },
    ];

    render(
      <AuthProvider>
        <DonorDashboard initialDonations={mockDonations} />
      </AuthProvider>
    );

    expect(screen.queryByText('No donations recorded yet')).toBeNull();
    expect(screen.getByText('DON-001')).toBeDefined();
  });

  it('handles SAD 4.4 server error response in BloodRequestForm without redirecting (TC-13)', async () => {
    const onSuccessMock = vi.fn();
    const onCancelMock = vi.fn();

    // Mock fetch returning SAD 4.4 error contract: { error: { code, message, fields[] } }
    globalThis.fetch = vi.fn().mockResolvedValue({
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

    render(<BloodRequestForm onSuccess={onSuccessMock} onCancel={onCancelMock} />);

    // Fill valid client fields
    fireEvent.change(screen.getByLabelText(/Patient Full Name/i), { target: { name: 'patientName', value: 'Alice Smith' } });
    fireEvent.change(screen.getByLabelText(/Required By Date/i), { target: { name: 'requiredByDate', value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText(/Emergency Contact Number/i), { target: { name: 'contactNumber', value: '9876543210' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Submit Requisition/i });
    fireEvent.click(submitBtn);

    // Assert that data.error.message is displayed in the alert banner
    await waitFor(() => {
      expect(screen.getByText('Requested units exceeds available inventory for O+')).toBeDefined();
    });

    // Assert that fields[] from SAD 4.4 are mapped to inline field errors in the DOM
    expect(screen.getByText('Maximum 5 units can be requested at one time')).toBeDefined();
    expect(screen.getByText('Hospital license verification pending')).toBeDefined();

    // Crucial: ensure it did NOT redirect on failure
    expect(onSuccessMock).not.toHaveBeenCalled();
  });

  it('redirects only on successful blood request submission (200 OK)', async () => {
    vi.useFakeTimers();
    const onSuccessMock = vi.fn();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: { id: 'REQ-0001' },
      }),
    });

    render(<BloodRequestForm onSuccess={onSuccessMock} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(/Patient Full Name/i), { target: { name: 'patientName', value: 'Bob Jones' } });
    fireEvent.change(screen.getByLabelText(/Required By Date/i), { target: { name: 'requiredByDate', value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText(/Emergency Contact Number/i), { target: { name: 'contactNumber', value: '9876543210' } });

    fireEvent.click(screen.getByRole('button', { name: /Submit Requisition/i }));

    await vi.waitFor(() => {
      expect(screen.getByText(/Blood requisition submitted successfully with status Pending/i)).toBeDefined();
    });

    // Before timer expires, onSuccess is not called
    expect(onSuccessMock).not.toHaveBeenCalled();

    // Fast forward timer 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onSuccessMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
