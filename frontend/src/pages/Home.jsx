import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import StaffDashboard from '../components/dashboards/StaffDashboard';
import AdminDashboard from '../components/dashboards/AdminDashboard';
import DonorDashboard from '../components/dashboards/DonorDashboard';
import HospitalDashboard from '../components/dashboards/HospitalDashboard';
import DonorRegistrationForm from '../components/forms/DonorRegistrationForm';
import BloodRequestForm from '../components/forms/BloodRequestForm';
import { getHealth } from '../services/api';

export default function Home() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [healthStatus, setHealthStatus] = useState('Checking API...');

  useEffect(() => {
    getHealth()
      .then((data) => setHealthStatus(`Online (${data.status || 'healthy'})`))
      .catch(() => setHealthStatus('API Service Unreachable'));
  }, []);

  // Reset tab to dashboard if active tab is not valid for current role
  useEffect(() => {
    setActiveTab('dashboard');
  }, [role]);

  const renderContent = () => {
    if (!user) {
      return (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--slate-900)' }}>
            Welcome to Blood Bank Management System
          </h1>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
            A mission-critical transfusion inventory and voluntary donor management platform.
            Please sign in using your authorized role.
          </p>
        </div>
      );
    }

    // Interactive Forms
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

    // Role-specific Dashboards (SAD 4.5)
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
        <span>© 2026 Blood Bank Management System (Team 9). Compliant with SAD 4.5 & SRS 3.1.</span>
        <span>Backend Status: <strong style={{ color: healthStatus.includes('Online') ? 'var(--success)' : 'var(--danger)' }}>{healthStatus}</strong></span>
      </footer>
    </div>
  );
}
