import React, { createContext, useContext, useState, useEffect } from 'react';
import { notification } from 'antd';
import { API_ENDPOINTS } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!token && !!user;
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    return user?.permissions?.includes(permission) || false;
  };

  // Check if user is admin
  const isAdmin = () => {
    return user?.role === 'admin' || hasPermission('admin');
  };

  // Login function
  const login = async (identifier, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setMustChangePassword(data.mustChangePassword || false);

      notification.success({
        message: 'Login Successful',
        description: `Welcome back, ${data.user.firstName}!`,
      });

      return { success: true, mustChangePassword: data.mustChangePassword };
    } catch (error) {
      notification.error({
        message: 'Login Failed',
        description: error.message,
      });
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    notification.info({
      message: 'Logged Out',
      description: 'You have been successfully logged out.',
    });
  };

  // Change password function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await fetch(API_ENDPOINTS.CHANGE_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Password change failed');
      }

      setMustChangePassword(false);
      notification.success({
        message: 'Password Changed',
        description: 'Your password has been successfully updated.',
      });

      return { success: true };
    } catch (error) {
      notification.error({
        message: 'Password Change Failed',
        description: error.message,
      });
      return { success: false, error: error.message };
    }
  };

  // Get current user info
  const getCurrentUser = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.CURRENT_USER, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      const data = await response.json();
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Error getting current user:', error);
      logout();
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          await getCurrentUser();
        } catch (error) {
          console.error('Auth initialization failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const value = {
    user,
    token,
    loading,
    mustChangePassword,
    isAuthenticated,
    hasPermission,
    isAdmin,
    login,
    logout,
    changePassword,
    getCurrentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
