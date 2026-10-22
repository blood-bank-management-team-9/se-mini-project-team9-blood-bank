import { describe, it, expect } from 'vitest';
import { getNavigationItems, getRoleBadgeClass } from '../utils/navigation';

describe('Role-Based Navigation Matrix (SAD 4.3 & 4.5)', () => {
  it('provides Admin with user accounts, audit log, and reports', () => {
    const items = getNavigationItems('Admin').map((i) => i.id);
    expect(items).toContain('dashboard');
    expect(items).toContain('users');
    expect(items).toContain('audit');
    expect(items).toContain('reports');
    // Admin should not see request blood
    expect(items).not.toContain('request-blood');
  });

  it('provides Staff with donor registration, stock, requests queue, and discard', () => {
    const items = getNavigationItems('Staff').map((i) => i.id);
    expect(items).toContain('dashboard');
    expect(items).toContain('register-donor');
    expect(items).toContain('record-donation');
    expect(items).toContain('stock');
    expect(items).toContain('requests');
    expect(items).toContain('discard');
    expect(items).toContain('search-donors-stock');
  });

  it('provides Donor with donation history and eligibility check', () => {
    const items = getNavigationItems('Donor').map((i) => i.id);
    expect(items).toContain('dashboard');
    expect(items).toContain('history');
    expect(items).toContain('eligibility');
    expect(items).not.toContain('users');
  });

  it('provides Hospital with search stock, new blood request, and tracking', () => {
    const items = getNavigationItems('Hospital/Patient').map((i) => i.id);
    expect(items).toContain('dashboard');
    expect(items).toContain('search-stock');
    expect(items).toContain('request-blood');
    expect(items).toContain('track-requests');
  });

  it('correctly maps Hospital/Patient role to hospital class name', () => {
    expect(getRoleBadgeClass('Hospital/Patient')).toBe('hospital');
    expect(getRoleBadgeClass('Admin')).toBe('admin');
    expect(getRoleBadgeClass('Staff')).toBe('staff');
    expect(getRoleBadgeClass('Donor')).toBe('donor');
  });
});
