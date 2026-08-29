import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginLocal: (username: string, password: string) => Promise<void>;
  loginSSO: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = localStorage.getItem('sslmate_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const u = await api.getMe();
      setUser(u);
    } catch (err) {
      console.warn('Failed to get current user session:', err);
      localStorage.removeItem('sslmate_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const loginLocal = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    localStorage.setItem('sslmate_token', res.token);
    setUser(res.user);
  };

  const loginSSO = async () => {
    const { authUrl, state } = await api.getSsoUrl();
    sessionStorage.setItem('authmate_sso_state', state);
    window.location.href = authUrl;
  };

  const logout = () => {
    localStorage.removeItem('sslmate_token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginLocal, loginSSO, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
