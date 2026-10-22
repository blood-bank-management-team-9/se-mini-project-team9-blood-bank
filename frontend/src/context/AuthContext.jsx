import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

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
  },
  'Hospital/Patient': {
    id: 'USR-HSP01',
    name: 'City General Hospital',
    email: 'hospital@citygen.org',
    role: 'Hospital/Patient',
    phone: '9876543213',
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('bbms_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_USERS.Staff;
      }
    }
    return DEFAULT_USERS.Staff;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('bbms_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('bbms_user');
    }
  }, [user]);

  const switchRole = (newRole) => {
    if (DEFAULT_USERS[newRole]) {
      setUser(DEFAULT_USERS[newRole]);
    }
  };

  const logout = () => {
    setUser(null);
  };

  const login = (role = 'Staff') => {
    setUser(DEFAULT_USERS[role] || DEFAULT_USERS.Staff);
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role, switchRole, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
