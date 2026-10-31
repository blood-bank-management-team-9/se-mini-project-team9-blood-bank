import React from 'react';
import { useAuth } from '../context/AuthContext';
import { getNavigationItems, getRoleBadgeClass } from '../utils/navigation';

export default function Navbar({ activeTab, onSelectTab }) {
  const { user, role, logout, authLoading } = useAuth();
  const navItems = getNavigationItems(role);

  const handleLogout = async () => {
    await logout();
    onSelectTab('login');
  };

  return (
    <header className="app-header">
      <div className="header-inner">
        <button
          type="button"
          className="brand"
          onClick={() => onSelectTab(user ? 'dashboard' : 'login')}
          aria-label="Blood Bank Management System Home"
        >
          <div className="brand-icon">🩸</div>
          <div className="brand-text">
            <span className="brand-title">BBMS Blood Bank</span>
            <span className="brand-sub">Management System</span>
          </div>
        </button>

        <div className="header-controls">
          {authLoading ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>Loading…</span>
          ) : user ? (
            <>
              <div className="user-pill">
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0 }}
                  onClick={() => onSelectTab('profile')}
                  title="View / edit profile"
                >
                  <span style={{ fontWeight: 600 }}>{user.name}</span>
                  <span className={`role-badge ${getRoleBadgeClass(role)}`}>{role}</span>
                </button>
              </div>
              <button type="button" className="btn-logout" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={() => onSelectTab('register')}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
                Register
              </button>
              <button type="button" className="btn-primary" onClick={() => onSelectTab('login')}>
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Role-filtered nav — only shown when logged in */}
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
            {/* Profile link always available */}
            <button
              type="button"
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => onSelectTab('profile')}
              aria-current={activeTab === 'profile' ? 'page' : undefined}
            >
              My Profile
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
