import { describe, it, expect, vi } from 'vitest';

// Mock react-dom/client so createRoot().render() is a no-op
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

// Mock App so we don't mount the whole tree
vi.mock('../App', () => ({
  default: () => null,
}));

// Mock index.css import
vi.mock('../index.css', () => ({}));

describe('main.jsx', () => {
  it('boots the app without throwing', async () => {
    // Provide a #root element so document.getElementById works
    const rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);

    await expect(import('../main')).resolves.toBeDefined();
  });
});