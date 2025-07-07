import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Spin } from 'antd';
import Login from './Login';
import ChangePassword from './ChangePassword';

const ProtectedRoute = ({ children, requiredPermission = null }) => {
  const { isAuthenticated, loading, mustChangePassword, hasPermission } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated()) {
    return <Login />;
  }

  // Show password change if required
  if (mustChangePassword) {
    return <ChangePassword isFirstLogin={true} />;
  }

  // Check permissions if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        flexDirection: 'column'
      }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this resource.</p>
      </div>
    );
  }

  // Render protected content
  return children;
};

export default ProtectedRoute;
