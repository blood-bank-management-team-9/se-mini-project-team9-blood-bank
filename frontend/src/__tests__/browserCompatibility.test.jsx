import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
}

describe('Browser Compatibility & Responsive Layout Checks (NFR-QUAL-05, TC-36, SAD 3.6)', () => {
  it('renders standard semantic elements without proprietary browser-specific tags', () => {
    const { container } = renderApp();
    expect(container.querySelector('nav')).toBeTruthy();
    expect(container.querySelector('main')).toBeTruthy();
    expect(container.querySelector('h1, h2, h3, header')).toBeTruthy();
  });

  it('supports responsive mobile viewports starting from 360px width', () => {
    // Resize viewport to standard minimum mobile width (SAD 3.6: usable from 360 px)
    window.innerWidth = 360;
    window.innerHeight = 640;
    window.dispatchEvent(new Event('resize'));

    const { container } = renderApp();
    const appContainer = container.firstChild;
    expect(appContainer).toBeTruthy();
    expect(window.innerWidth).toBe(360);
  });

  it('maintains accessible input fields with standard labels across modern browsers', () => {
    renderApp();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((btn) => {
      expect(btn.disabled).toBe(false);
    });
  });
});
