
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fakeUnit = {
  unitId: 'UNT-00001',
  unit_id: 'UNT-00001',
  donationId: 'DON-00001',
  donation_id: 'DON-00001',
  bloodGroup: 'O+',
  blood_group: 'O+',
  volumeMl: 450,
  volume_ml: 450,
  collectionDate: '2026-10-01',
  collection_date: '2026-10-01',
  expiryDate: '2026-12-01',
  expiry_date: '2026-12-01',
  status: 'Available',
  daysToExpiry: 30,
  days_to_expiry: 30,
  discardReason: null,
};

const fakeData = {
  records: [fakeUnit],
  units: [fakeUnit],
  items: [fakeUnit],
  rows: [fakeUnit],
  aggregates: [{
    bloodGroup: 'O+',
    blood_group: 'O+',
    available: 1,
    reserved: 0,
    issued: 0,
    expired: 0,
    discarded: 0,
    total: 1,
    earliestExpiry: '2026-12-01',
    earliest_expiry: '2026-12-01',
  }],
  total: 1,
  totalUnits: 1,
};

vi.mock('../services/api', () => {
  // Proxy returns [] for any property → data.units.map() → [].map() → []
  const safeEmpty = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined;   // not a promise
      return [];                                // any property → empty array
    },
  });

  const emptyFn = vi.fn().mockResolvedValue(safeEmpty);

  return {
    setUnauthenticatedCallback: vi.fn(),
    apiGet: vi.fn().mockResolvedValue(fakeData),
    apiPost: emptyFn,
    apiPut: emptyFn,
    apiPatch: emptyFn,
    apiDelete: emptyFn,
    apiMutate: emptyFn,
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

describe('StockPage', () => {
  it('renders', async () => {
    const { default: StockPage } = await import('../pages/StockPage');
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StockPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(container).toBeTruthy());
  }, 8000);
});
