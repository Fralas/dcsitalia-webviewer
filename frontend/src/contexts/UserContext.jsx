import { createContext, useContext, useState, useEffect } from 'react';
import { getDefaultUserProfile, loadUserProfile, saveUserProfile } from '../utils/userProfile';
import * as api from '../services/api';
import { resolveApiBase } from '../services/api';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const handleUnauthorized = async () => {
      try {
        const response = await fetch(`${resolveApiBase()}/auth/user`, {
          credentials: 'include',
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          return;
        }
      } catch (error) {
        console.warn('Auth re-check failed after unauthorized event:', error);
      }

      setUser(null);
      setProfile(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      const cachedProfile = loadUserProfile(user.id);
      setProfile(cachedProfile);
      api.getUserProfile()
        .then((profileData) => {
          setProfile(profileData);
          saveUserProfile(user.id, profileData);
        })
        .catch((error) => {
          console.warn('Profile fetch failed, using local cache:', error);
        });
    } else {
      setProfile(null);
    }
  }, [user]);

  const checkAuth = async () => {
    const maxAttempts = 40;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${resolveApiBase()}/auth/user`, {
          credentials: 'include',
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          break;
        }

        if (response.status !== 503 && response.status !== 500) {
          break;
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          console.error('Auth check failed:', error);
        }
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, Math.min(250 * attempt, 1500));
      });
    }

    setLoading(false);
  };

  const logout = () => {
    setUser(null);
  };

  const updateProfile = (updater) => {
    if (!user?.id) return;
    setProfile(prev => {
      const baseProfile = prev || getDefaultUserProfile();
      const nextProfile = typeof updater === 'function' ? updater(baseProfile) : updater;
      saveUserProfile(user.id, nextProfile);
      api.saveUserProfile(nextProfile).catch((error) => {
        console.warn('Profile save failed, kept local cache:', error);
      });
      return nextProfile;
    });
  };

  const incrementStats = (increments) => {
    if (!user?.id) return;
    updateProfile(prev => {
      const missionsCompleted = prev.stats.missionsCompleted + (increments.missionsCompleted || 0);
      const ordersCompleted = prev.stats.ordersCompleted + (increments.ordersCompleted || 0);
      return {
        ...prev,
        stats: {
          missionsCompleted,
          ordersCompleted,
        },
      };
    });
  };

  return (
    <UserContext.Provider value={{ user, setUser, loading, logout, profile, updateProfile, incrementStats }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
