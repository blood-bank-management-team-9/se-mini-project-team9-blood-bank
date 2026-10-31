import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import StaffDashboard from '../components/dashboards/StaffDashboard';
import AdminDashboard from '../components/dashboards/AdminDashboard';
import DonorDashboard from '../components/dashboards/DonorDashboard';
import HospitalDashboard from '../components/dashboards/HospitalDashboard';
import DonorRegistrationForm from '../components/forms/DonorRegistrationForm';
import BloodRequestForm from '../components/forms/BloodRequestForm';
import SearchModule from '../components/search/SearchModule';
import ReportsModule from '../components/reports/ReportsModule';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';
import ProfilePage from './ProfilePage';
import RecordDonationPage from './RecordDonationPage';
import RequestsQueuePage from './RequestsQueuePage';
import StockPage from './StockPage';
import DonorsPage from './DonorsPage';
import UsersPage from './UsersPage';
import AuditLogPage from './AuditLogPage';
import { getNavigationItems } from '../utils/navigation';
import { getHealth } from '../services/api';

export default function Home() {
  const { user, role, authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [healthStatus, setHealthStatus] = useState('Checking API…');
  const [resetToken, setResetToken] = useState('');

  // Navigate helper — handles special params
  const handleNavigate = (tab, params = {}) => {
    if (params.token) setResetToken(params.token);
    setActiveTab(tab);
  };

  // Once auth resolves, redirect appropriately
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      // Logged in — go to dashboard if on an auth page
      if (['login', 'register', 'forgot-password', 'reset-password'].includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else {
      // Not logged in — only allow public pages
      const publicTabs = ['login', 'register', 'forgot-password', 'reset-password'];
      if (!publicTabs.includes(activeTab)) {
        setActiveTab('login');
      }
    }
  }, [user, authLoading]); // eslint-disable-line

  // Guard: if current tab is not in role's nav, reset to dashboard
  useEffect(() => {
    if (!user || authLoading) return;
    const allowed = getNavigationItems(role).map((i) => i.id);
    // Add pages that are always accessible when logged in
    const alwaysAllowed = ['dashboard', 'profile', 'register-donor', 'request-blood',
      'search-stock', 'search-donors-stock', 'reports', 'record-donation',
      'requests', 'stock', 'donors', 'users', 'audit'];
    if (!allowed.includes(activeTab) && !alwaysAllowed.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [role, activeTab, user, authLoading]);

  // Health check
  useEffect(() => {
    getHealth()
      .then((data) => setHealthStatus(`Online (${data.status || 'healthy'})`))
      .catch(() => setHealthStatus('Offline'));
  }, []);

  const renderContent = () => {
    if (authLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <p style={{ color: 'var(--slate-500)' }}>Restoring session…</p>
        </div>
      );
    }

    // ── Public auth pages ──────────────────────────────────────────────────────
    if (activeTab === 'login') return <LoginPage onNavigate={handleNavigate} />;
    if (activeTab === 'register') return <RegisterPage onNavigate={handleNavigate} />;
    if (activeTab === 'forgot-password') return <ForgotPasswordPage onNavigate={handleNavigate} />;
    if (activeTab === 'reset-password') return <ResetPasswordPage token={resetToken} onNavigate={handleNavigate} />;

    // ── If not logged in after auth pages, redirect to login ──────────────────
    if (!user) {
      return <LoginPage onNavigate={handleNavigate} />;
    }

    // ── Profile (all roles) ───────────────────────────────────────────────────
    if (activeTab === 'profile') return <ProfilePage />;

    // ── Search ────────────────────────────────────────────────────────────────
    if (activeTab === 'search-stock') return <SearchModule defaultTab="stock" />;
    if (activeTab === 'search-donors-stock') return <SearchModule defaultTab="donors" />;

    // ── Reports ───────────────────────────────────────────────────────────────
    if (activeTab === 'reports') return <ReportsModule />;

    // ── Staff forms & pages ────────────────────────────────────────────────────
    if (activeTab === 'register-donor') {
      return (
        <DonorRegistrationForm
          onSuccess={() => setActiveTab('donors')}
          onCancel={() => setActiveTab('dashboard')}
        />
      );
    }
    if (activeTab === 'record-donation') {
      return (
        <RecordDonationPage
          onSuccess={() => setActiveTab('stock')}
          onCancel={() => setActiveTab('dashboard')}
        />
      );
    }
    if (activeTab === 'requests') return <RequestsQueuePage />;
    if (activeTab === 'stock') return <StockPage />;
    if (activeTab === 'donors') return <DonorsPage onNavigate={handleNavigate} />;

    // ── Hospital forms ─────────────────────────────────────────────────────────
    if (activeTab === 'request-blood') {
      return (
        <BloodRequestForm
          onSuccess={() => setActiveTab('dashboard')}
          onCancel={() => setActiveTab('dashboard')}
        />
      );
    }
    if (activeTab === 'track-requests') {
      return <HospitalDashboard onNavigate={handleNavigate} />;
    }

    // ── Admin pages ────────────────────────────────────────────────────────────
    if (activeTab === 'users') return <UsersPage />;
    if (activeTab === 'audit') return <AuditLogPage />;

    // ── Role Dashboards ────────────────────────────────────────────────────────
    if (activeTab === 'dashboard') {
      switch (role) {
        case 'Admin':    return <AdminDashboard onNavigate={handleNavigate} />;
        case 'Staff':    return <StaffDashboard onNavigate={handleNavigate} />;
        case 'Donor':    return <DonorDashboard onNavigate={handleNavigate} />;
        case 'Hospital/Patient': return <HospitalDashboard onNavigate={handleNavigate} />;
        default:         return <StaffDashboard onNavigate={handleNavigate} />;
      }
    }

    // ── Fallback stub for any unimplemented tab ────────────────────────────────
    const currentItem = getNavigationItems(role).find((i) => i.id === activeTab);
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', maxWidth: '600px', margin: '2rem auto' }}>
        <h2 className="panel-title" style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          {currentItem ? currentItem.label : 'Module'}
        </h2>
        <p style={{ color: 'var(--slate-600)', maxWidth: '540px', margin: '0 auto 1.5rem auto' }}>
          Not yet implemented — see <code>backend/README.md</code>
        </p>
        <button type="button" className="btn-primary" onClick={() => setActiveTab('dashboard')}>
          ← Return to Dashboard
        </button>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <Navbar activeTab={activeTab} onSelectTab={handleNavigate} />
      <main className="app-main">
        {renderContent()}
      </main>
      <footer style={{
        textAlign: 'center',
        padding: '1.25rem',
        borderTop: '1px solid var(--slate-200)',
        background: 'var(--white)',
        fontSize: '0.825rem',
        color: 'var(--slate-500)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <span>BBMS Blood Bank Management System — Team 9</span>
        <span>
          API Status:{' '}
          <strong style={{ color: healthStatus.includes('Online') ? 'var(--success)' : 'var(--slate-600)' }}>
            {healthStatus}
          </strong>
        </span>
      </footer>
    </div>
  );
}
