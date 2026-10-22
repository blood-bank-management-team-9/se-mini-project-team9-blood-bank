import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ activeTab, onSelectTab }) {
  const { user, role, switchRole, logout, login } = useAuth();

  // Navigation menu items strictly filtered by role as specified in SAD 4.5
  const getRoleNavItems = () => {
    switch (role) {
      case 'Admin':
        return [
          { id: 'dashboard', label: 'Admin Dashboard' },
          { id: 'users', label: 'User Accounts' },
          { id: 'audit', label: 'System Audit Log' },
          { id: 'config', label: 'System Settings' },
        ];
      case 'Staff':
        return [
          { id: 'dashboard', label: 'Staff Dashboard' },
          { id: 'register-donor', label: 'Register Donor' },
          { id: 'record-donation', label: 'Record Donation' },
          { id: 'stock', label: 'Blood Inventory' },
          { id: 'requests', label: 'Process Requests' },
          { id: 'discard', label: 'Discard Unit' },
        ];
      case 'Donor':
        return [
          { id: 'dashboard', label: 'Donor Dashboard' },
          { id: 'history', label: 'My Donation History' },
          { id: 'eligibility', label: 'Check Eligibility' },
        ];
      case 'Hospital/Patient':
        return [
          { id: 'dashboard', label: 'Hospital Dashboard' },
          { id: 'request-blood', label: 'New Blood Request' },
          { id: 'track-requests', label: 'Track Requests' },
        ];
      default:
        return [{ id: 'dashboard', label: 'Overview' }];
    }
  };

  const navItems = getRoleNavItems();

  const getRoleClass = (r) => {
    switch (r) {
      case 'Admin':
        return 'admin';
      case 'Staff':
        return 'staff';
      case 'Donor':
        return 'donor';
      case 'Hospital/Patient':
        return 'hospital';
      default:
        return 'staff';
    }
  };

  return (
    <header className="app-header">
      <div className="header-inner">
        <a href="#home" className="brand" onClick={(e) => { e.preventDefault(); onSelectTab('dashboard'); }}>
          <div className="brand-icon">🩸</div>
          <div className="brand-text">
            <span className="brand-title">BBMS Blood Bank</span>
            <span className="brand-sub">Management System</span>
          </div>
        </a>

        <div className="header-controls">
          {/* Role Switcher for seamless testing and demonstration */}
          <div className="role-switcher-wrap" title="Switch active role for testing role dashboards">
            <span>Role:</span>
            <select
              className="role-select"
              value={role || 'Staff'}
              onChange={(e) => {
                switchRole(e.target.value);
                onSelectTab('dashboard');
              }}
              aria-label="Switch active role"
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
                <span className={`role-badge ${getRoleClass(role)}`}>{role}</span>
              </div>
              <button
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
            <button className="btn-primary" onClick={() => login('Staff')}>
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Nav Menu dynamically filtered by role (SAD 4.5) */}
      {user && (
        <nav className="role-nav" aria-label="Role Navigation">
          <div className="nav-inner">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onSelectTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
