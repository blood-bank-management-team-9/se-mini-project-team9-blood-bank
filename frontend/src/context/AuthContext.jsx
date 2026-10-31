import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { apiGet, apiPost, setUnauthenticatedCallback } from '../services/api';

export const AuthContext = createContext();

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef(null);

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    idleTimerRef.current = setInterval(() => {
      if (user && Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        apiPost('/api/auth/logout').catch(() => {});
        setUser(false);
      }
    }, 30_000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(idleTimerRef.current);
    };
  }, [user, handleActivity]);

  useEffect(() => {
    setUnauthenticatedCallback(() => setUser(false));
  }, []);

  // Restore session on mount. /me returns 403 for Staff and Admin (FR-AUTH-06
  // restricts it to Donor / Hospital-Patient). Fall back to a lightweight
  // session probe so Staff/Admin are not logged out on refresh.
  useEffect(() => {
    let cancelled = false;

    apiGet('/api/auth/me')
      .then((profile) => {
        if (!cancelled) {
          setUser(profile);
          setAuthLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.type === 'forbidden') {
          // Staff or Admin: /me is forbidden. Try a Staff-only probe.
          apiGet('/api/auth/staff-only')
            .then((staffData) => {
              if (!cancelled) {
                setUser({
                  ...(staffData.user || {}),
                  userId: staffData.user?.userId,
                  name: staffData.user?.name,
                  role: staffData.user?.role,
                });
                setAuthLoading(false);
              }
            })
            .catch(() => {
              if (!cancelled) {
                setUser(false);
                setAuthLoading(false);
              }
            });
        } else {
          setUser(false);
          setAuthLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const data = await apiPost('/api/auth/login', { email, password });
    // Backend returns { userId, name, role } directly, not wrapped.
    const loggedIn = data.user || data;
    setUser(loggedIn);
    lastActivityRef.current = Date.now();
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout');
    } catch {
      // clear client state regardless
    }
    setUser(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await apiGet('/api/auth/me');
    setUser(profile);
    return profile;
  }, []);

  const value = {
    user,
    role: user?.role ?? null,
    authLoading,
    login,
    logout,
    refreshProfile,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}