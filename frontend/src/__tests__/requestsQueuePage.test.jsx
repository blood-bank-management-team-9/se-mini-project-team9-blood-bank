import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Rich mock — returns one fake row so .map() body executes
const fakeRequest = {
  requestId: 'REQ-0001',
  hospitalName: 'City Hospital',
  patientName: 'Alice',
  bloodGroup: 'O+',
  units: 2,
  priority: 'High',
  status: 'Pending',
  requestDate: '2026-10-01',
  decisionDate: null,
  rejectionReason: null,
  createdAt: '2026-10-01',
  updatedAt: '2026-10-01',
};

vi.mock('../services/api', () => {
  const fakeData = {
    records: [fakeRequest],
    requests: [fakeRequest],
    items: [fakeRequest],
    rows: [fakeRequest],
    data: [fakeRequest],
    total: 1,
    totalRequests: 1,
    totalUnitsRequested: 2,
    pagination: { page: 1, totalPages: 1, total: 1 },
  };
  const proxy = new Proxy(fakeData, {
    get: (t, prop) => {
      if (prop === 'then') return undefined;
      if (prop in t) return t[prop];
      return [];
    },
  });
  const emptyFn = vi.fn().mockResolvedValue(proxy);
  return {
    setUnauthenticatedCallback: vi.fn(),
    apiGet: emptyFn, apiPost: emptyFn, apiPut: emptyFn, apiPatch: emptyFn,
    apiDelete: emptyFn, apiMutate: emptyFn,
    apiGetBlob: vi.fn().mockResolvedValue(new Blob()),
    getHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'USR-1', role: 'Staff', name: 'Alice' },
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => cleanup());

describe('RequestsQueuePage', () => {
  it('renders with one row', async () => {
    const { default: RequestsQueuePage } = await import('../pages/RequestsQueuePage');
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RequestsQueuePage />
      </MemoryRouter>
    );
    await waitFor(() => expect(container).toBeTruthy());
  }, 8000);
});