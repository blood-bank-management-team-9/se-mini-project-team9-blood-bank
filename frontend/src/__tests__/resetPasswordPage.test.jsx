import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
    apiGet: emptyFn,
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
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => cleanup());

describe('ResetPasswordPage', () => {
  it('renders', async () => {
    const { default: ResetPasswordPage } = await import('../pages/ResetPasswordPage');
    const { container } = render(
      <MemoryRouter
        initialEntries={['/reset-password?token=test-token']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ResetPasswordPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(container).toBeTruthy());
  }, 8000);
});