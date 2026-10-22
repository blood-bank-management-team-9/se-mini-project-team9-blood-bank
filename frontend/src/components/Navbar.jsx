import React from 'react';
import { useAuth } from '../context/AuthContext';
import { getNavigationItems, getRoleBadgeClass } from '../utils/navigation';

export default function Navbar({ activeTab, onSelectTab }) {
  const { user, role, switchRole, logout, login } = useAuth();
  const navItems = getNavigationItems(role);

  return (
    <header className="app-header">
      <div className="header-inner">
        <button
          type="button"
          className="brand"
          onClick={() => onSelectTab('dashboard')}
          aria-label="Blood Bank Management System Home"
        >
          <div className="brand-icon">🩸</div>
          <div className="brand-text">
            <span className="brand-title">BBMS Blood Bank</span>
            <span className="brand-sub">Management System</span>
          </div>
        </button>

        <div className="header-controls">
          {/* Dev-only role preview switcher (clearly labeled) */}
          <div className="role-switcher-wrap" title="Dev Preview: switch roles to inspect SAD 4.5 role dashboards">
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--slate-500)' }}>[DEV PREVIEW]:</span>
            <select
              className="role-select"
              value={role || 'Staff'}
              onChange={(e) => {
                switchRole(e.target.value);
                onSelectTab('dashboard');
              }}
              aria-label="Switch active preview role"
            >
              <option value="Staff">Staff</option>
              <option value="Admin">Admin</option>
              <option value="Donor">Donor</option>
              <option value="Hospital/Patient">Hospital/Patient</option>
            </select>
          </div>

          {/* User Profile Pill & Logout */}
          {user ? (
            <>
              <div className="user-pill">
                <span>{user.name}</span>
                <span className={`role-badge ${getRoleBadgeClass(role)}`}>{role}</span>
              </div>
              <button
                type="button"
                className="btn-logout"
                onClick={() => {
                  logout();
                  onSelectTab('dashboard');
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={() => login('Staff')}>
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Nav Menu dynamically filtered by role as mandated by SAD 4.3 & 4.5 */}
      {user && (
        <nav className="role-nav" aria-label="Role Navigation">
          <div className="nav-inner">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
