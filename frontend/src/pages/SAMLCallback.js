import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import { useAuth } from '../contexts/AuthContext';

const SAMLCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleSAMLCallback = async () => {
      try {
        const token = searchParams.get('token');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          let errorMessage = 'SAML authentication failed';
          switch (errorParam) {
            case 'saml_error':
              errorMessage = 'SAML authentication error occurred';
              break;
            case 'saml_failed':
              errorMessage = 'SAML authentication failed';
              break;
            default:
              errorMessage = 'Authentication error';
          }
          setError(errorMessage);
          setLoading(false);
          return;
        }

        if (!token) {
          setError('No authentication token received');
          setLoading(false);
          return;
        }

        // Validate token and get user info
        const response = await fetch('/api/auth/verify-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Store token and user info
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Update auth context
            await login(data.user.email, '', token);
            
            // Redirect to dashboard
            navigate('/dashboard', { replace: true });
          } else {
            setError('Invalid authentication token');
          }
        } else {
          setError('Failed to validate authentication token');
        }
      } catch (error) {
        console.error('SAML callback error:', error);
        setError('An error occurred during authentication');
      } finally {
        setLoading(false);
      }
    };

    handleSAMLCallback();
  }, [searchParams, navigate, login]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>Processing SAML authentication...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Result
          status="error"
          title="Authentication Failed"
          subTitle={error}
          extra={[
            <Button type="primary" key="login" onClick={() => navigate('/login')}>
              Back to Login
            </Button>
          ]}
        />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh'
    }}>
      <Result
        status="success"
        title="Authentication Successful"
        subTitle="Redirecting to dashboard..."
      />
    </div>
  );
};

export default SAMLCallback;
