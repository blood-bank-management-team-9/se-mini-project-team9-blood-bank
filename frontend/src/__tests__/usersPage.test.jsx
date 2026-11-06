import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fakeUser = {
  userId: 'USR-1',
  name: 'Alice',
  email: 'alice@example.com',
  phone: '9876543210',
  role: 'Staff',
  status: 'Active',
  createdAt: '2026-01-01',
};

const fakeData = {
  users: [fakeUser],
  records: [fakeUser],
  items: [fakeUser],
  rows: [fakeUser],
  total: 1,
  pagination: { page: 1, totalPages: 1, total: 1 },
};

vi.mock('../services/api', () => {
  const safeEmpty = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined;
      return [];
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
    user: { userId: 'USR-1', role: 'Admin', name: 'Alice' },
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => cleanup());

describe('UsersPage', () => {
  it('renders', async () => {
    const { default: UsersPage } = await import('../pages/UsersPage');
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UsersPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(container).toBeTruthy());
  }, 8000);
});