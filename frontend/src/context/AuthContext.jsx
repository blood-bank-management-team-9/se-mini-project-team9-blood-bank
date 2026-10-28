import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export const AuthContext = createContext();

// Seed user accounts aligned with ADR-04 and SAD 3.6
export const DEFAULT_USERS = {
  Staff: {
    id: 'USR-STF01',
    name: 'Nurse Joy',
    email: 'staff@bloodbank.org',
    role: 'Staff',
    phone: '9876543211',
  },
  Admin: {
    id: 'USR-ADM01',
    name: 'System Administrator',
    email: 'admin@bloodbank.org',
    role: 'Admin',
    phone: '9876543210',
  },
  Donor: {
    id: 'USR-DNR01',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'Donor',
    phone: '9876543212',
    bloodGroup: 'O+',
    lastDonationDate: '2026-10-01',
    gender: 'Male',
  },
  'Hospital/Patient': {
    id: 'USR-HSP01',
    name: 'City General Hospital',
    email: 'hospital@citygen.org',
    role: 'Hospital/Patient',
    phone: '9876543213',
  },
};

// 15-minute idle timeout in milliseconds per ADR-04 (15 * 60 * 1000)
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // In dev / preview mode, default to Staff; can be switched via preview role selector
    return DEFAULT_USERS.Staff;
  });

  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef(null);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const login = useCallback((role = 'Staff') => {
    setUser(DEFAULT_USERS[role] || DEFAULT_USERS.Staff);
    lastActivityRef.current = Date.now();
  }, []);

  const switchRole = useCallback((newRole) => {
    if (DEFAULT_USERS[newRole]) {
      setUser(DEFAULT_USERS[newRole]);
      lastActivityRef.current = Date.now();
    }
  }, []);

  // Enforce ADR-04: 15-minute idle expiry
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    idleTimerRef.current = setInterval(() => {
      if (user && Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        console.warn('Session expired due to 15 minutes of inactivity (ADR-04).');
        logout();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, role: user?.role, switchRole, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
