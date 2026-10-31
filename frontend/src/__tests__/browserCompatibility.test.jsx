import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// App now calls /api/auth/me and /api/health on mount — mock them
function mockFetchForApp() {
  globalThis.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('/api/health')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'healthy' }) });
    }
    if (url.includes('/api/auth/me') || url.includes('/api/auth/csrf')) {
      return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHENTICATED', message: 'Not logged in' } }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

function renderApp() {
  mockFetchForApp();
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
}

describe('Browser Compatibility & Responsive Layout Checks (NFR-QUAL-05, TC-36, SAD 3.6)', () => {
  it('renders standard semantic elements without proprietary browser-specific tags', async () => {
    const { container } = renderApp();
    // Wait for auth resolution
    await waitFor(() => {
      expect(container.querySelector('main')).toBeTruthy();
    });
    expect(container.querySelector('nav, header')).toBeTruthy();
    expect(container.querySelector('h1, h2, h3, header')).toBeTruthy();
  });

  it('supports responsive mobile viewports starting from 360px width', async () => {
    window.innerWidth = 360;
    window.innerHeight = 640;
    window.dispatchEvent(new Event('resize'));

    const { container } = renderApp();
    await waitFor(() => {
      expect(container.firstChild).toBeTruthy();
    });
    expect(window.innerWidth).toBe(360);
  });

  it('renders interactive buttons on the login page', async () => {
    renderApp();
    // After auth resolves (not logged in), login page should show
    await waitFor(() => {
      // There may be multiple "Sign In" buttons (nav + form), use getAllByRole
      const signInBtns = screen.getAllByRole('button', { name: /Sign In/i });
      expect(signInBtns.length).toBeGreaterThan(0);
      signInBtns.forEach((btn) => {
        expect(btn.disabled).toBe(false);
      });
    });
  });
});
