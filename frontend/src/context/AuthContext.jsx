import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('infra_token') || null);
  const [loading, setLoading] = useState(true);
  const { success, error: showError } = useToast();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data?.success) {
          setUser(res.data.user);
          localStorage.setItem('infra_user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        console.error('Session validation failed:', err);
        logout(false);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.success) {
        const { token: newToken, user: userData } = res.data;
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('infra_token', newToken);
        localStorage.setItem('infra_user', JSON.stringify(userData));
        success(`Welcome back, ${userData.name}!`);
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Authentication failed. Please verify your credentials.';
      showError(msg);
      return { success: false, error: msg };
    }
  };

  const register = async (name, email, password, role) => {
    try {
      const res = await api.post('/auth/register', { name, email, password, role });
      if (res.data?.success) {
        const { token: newToken, user: userData } = res.data;
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('infra_token', newToken);
        localStorage.setItem('infra_user', JSON.stringify(userData));
        success('Account created successfully!');
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed.';
      showError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = (notify = true) => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('infra_token');
    localStorage.removeItem('infra_user');
    if (notify) {
      success('Logged out successfully');
    }
  };

  const updateUserProfile = (updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
    localStorage.setItem('infra_user', JSON.stringify({ ...user, ...updatedUser }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        logout,
        updateUserProfile,
      }}
    >
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
