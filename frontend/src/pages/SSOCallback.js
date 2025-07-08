import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Spin, Alert, Typography, Result } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const SSOCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Processing SSO login...');
  const [error, setError] = useState(null);

  useEffect(() => {
    handleSSOCallback();
  }, []);

  const handleSSOCallback = async () => {
    try {
      const token = searchParams.get('token');
      const provider = searchParams.get('provider');
      const error = searchParams.get('error');

      // Check for errors from SSO provider
      if (error) {
        setStatus('error');
        setError(decodeURIComponent(error));
        setMessage('SSO authentication failed');
        return;
      }

      // Check for missing token
      if (!token) {
        setStatus('error');
        setError('No authentication token received');
        setMessage('SSO authentication failed');
        return;
      }

      // Validate the token with our backend
      const response = await fetch('/api/sso/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (data.success && data.valid) {
        // Store token and user data
        localStorage.setItem('token', token);
        
        setStatus('success');
        setMessage(`Successfully signed in with ${provider || 'SSO'}`);
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      } else {
        setStatus('error');
        setError(data.error || 'Token validation failed');
        setMessage('SSO authentication failed');
      }
    } catch (error) {
      console.error('SSO callback error:', error);
      setStatus('error');
      setError(error.message);
      setMessage('SSO authentication failed');
    }
  };

  const handleRetry = () => {
    navigate('/login', { replace: true });
  };

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <Card style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '24px' }}>
              <Title level={3}>{message}</Title>
              <Text type="secondary">
                Please wait while we complete your sign-in...
              </Text>
            </div>
          </Card>
        );

      case 'success':
        return (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="Sign-in Successful!"
            subTitle={message}
            extra={
              <div>
                <Text type="secondary">
                  Redirecting you to the dashboard...
                </Text>
              </div>
            }
          />
        );

      case 'error':
        return (
          <Result
            icon={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
            title="Sign-in Failed"
            subTitle={message}
            extra={
              <div>
                {error && (
                  <Alert
                    message="Error Details"
                    description={error}
                    type="error"
                    style={{ marginBottom: '16px', textAlign: 'left' }}
                  />
                )}
                <div style={{ marginTop: '16px' }}>
                  <a onClick={handleRetry} style={{ cursor: 'pointer' }}>
                    Try again with different method
                  </a>
                </div>
              </div>
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f0f2f5',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        {renderContent()}
      </div>
    </div>
  );
};

export default SSOCallback;
