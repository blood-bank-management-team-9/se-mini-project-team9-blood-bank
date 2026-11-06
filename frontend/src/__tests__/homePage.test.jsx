import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => {
  const safeEmpty = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'then') return undefined;
      return [];
    },
  });
  const emptyFn = vi.fn().mockResolvedValue(safeEmpty);
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
    user: { userId: 'USR-1', role: 'Donor', name: 'Alice' },
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => cleanup());

describe('Home', () => {
  it('renders', async () => {
    const { default: Home } = await import('../pages/Home');
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>
    );
    await waitFor(() => expect(container).toBeTruthy());
  }, 8000);
});