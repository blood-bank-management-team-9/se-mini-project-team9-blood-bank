import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import StaffDashboard from '../components/dashboards/StaffDashboard';
import AdminDashboard from '../components/dashboards/AdminDashboard';
import DonorDashboard from '../components/dashboards/DonorDashboard';
import HospitalDashboard from '../components/dashboards/HospitalDashboard';
import DonorRegistrationForm from '../components/forms/DonorRegistrationForm';
import BloodRequestForm from '../components/forms/BloodRequestForm';
import { getNavigationItems } from '../utils/navigation';
import { getHealth } from '../services/api';

export default function Home() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [healthStatus, setHealthStatus] = useState('Checking API...');

  useEffect(() => {
    getHealth()
      .then((data) => setHealthStatus(`Online (${data.status || 'healthy'})`))
      .catch(() => setHealthStatus('Offline / Standalone Preview'));
  }, []);

  // Guard: if current active tab is not accessible by the new role, reset to dashboard
  useEffect(() => {
    const allowed = getNavigationItems(role).map((i) => i.id);
    if (!allowed.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [role, activeTab]);

  const renderContent = () => {
    if (!user) {
      return (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--slate-900)' }}>
            Blood Bank Management System
          </h1>
          <p style={{ color: 'var(--slate-600)', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
            Mission-critical blood inventory and donor management platform.
            Please sign in using your authorized account.
          </p>
        </div>
      );
    }

    // Forms
    if (activeTab === 'register-donor') {
      return (
        <DonorRegistrationForm
          onSuccess={() => setActiveTab('dashboard')}
          onCancel={() => setActiveTab('dashboard')}
        />
      );
    }

    if (activeTab === 'request-blood') {
      return (
        <BloodRequestForm
          onSuccess={() => setActiveTab('dashboard')}
          onCancel={() => setActiveTab('dashboard')}
        />
      );
    }

    // Role Dashboards (SAD 4.5)
    if (activeTab === 'dashboard') {
      switch (role) {
        case 'Admin':
          return <AdminDashboard onNavigate={setActiveTab} />;
        case 'Staff':
          return <StaffDashboard onNavigate={setActiveTab} />;
        case 'Donor':
          return <DonorDashboard onNavigate={setActiveTab} />;
        case 'Hospital/Patient':
          return <HospitalDashboard onNavigate={setActiveTab} />;
        default:
          return <StaffDashboard onNavigate={setActiveTab} />;
      }
    }

    // Specific Views or Stubbed Modules for Sprint 2
    const currentItem = getNavigationItems(role).find((i) => i.id === activeTab);
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <h2 className="panel-title" style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          {currentItem ? currentItem.label : 'Module Overview'}
        </h2>
        <p style={{ color: 'var(--slate-600)', maxWidth: '540px', margin: '0 auto 1.5rem auto' }}>
          This module is assigned under <strong>Sprint 2</strong> (scheduled for October 24–30 as per the team backlog). The interface shell and navigation routing are fully mapped.
        </p>
        <button type="button" className="btn-primary" onClick={() => setActiveTab('dashboard')}>
          ← Return to Dashboard
        </button>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />
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
        gap: '0.5rem'
      }}>
        <span>BBMS Blood Bank Management System — Team 9</span>
        <span>API Status: <strong style={{ color: healthStatus.includes('Online') ? 'var(--success)' : 'var(--slate-600)' }}>{healthStatus}</strong></span>
      </footer>
    </div>
  );
}
