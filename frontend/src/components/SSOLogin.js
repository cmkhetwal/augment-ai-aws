import React, { useState, useEffect } from 'react';
import { Button, Card, Divider, Space, Typography, Alert, Spin } from 'antd';
import { GoogleOutlined, WindowsOutlined, SafetyOutlined, LoginOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const SSOLogin = ({ onSSOLogin, loading = false }) => {
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoadingProviders(true);
      const response = await fetch('/api/sso/providers');
      const data = await response.json();
      
      if (data.success) {
        // Only show enabled providers
        setProviders(data.providers.filter(p => p.enabled));
      } else {
        setError('Failed to load SSO providers');
      }
    } catch (error) {
      console.error('Error fetching SSO providers:', error);
      setError('Failed to load SSO providers');
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleSSOLogin = async (providerId) => {
    try {
      if (onSSOLogin) {
        onSSOLogin(providerId);
        return;
      }

      // Default behavior - redirect to SSO provider
      const response = await fetch(`/api/sso/login/${providerId}`);
      const data = await response.json();
      
      if (data.success && data.loginUrl) {
        window.location.href = data.loginUrl;
      } else {
        setError(data.error || 'Failed to initiate SSO login');
      }
    } catch (error) {
      console.error('SSO login error:', error);
      setError('Failed to initiate SSO login');
    }
  };

  const getProviderIcon = (providerId) => {
    switch (providerId) {
      case 'google':
        return <GoogleOutlined />;
      case 'microsoft':
        return <WindowsOutlined />;
      case 'okta':
        return <SafetyOutlined />;
      default:
        return <LoginOutlined />;
    }
  };

  const getProviderColor = (providerId) => {
    switch (providerId) {
      case 'google':
        return '#4285f4';
      case 'microsoft':
        return '#0078d4';
      case 'okta':
        return '#007dc1';
      default:
        return '#1890ff';
    }
  };

  if (loadingProviders) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>Loading SSO providers...</Text>
        </div>
      </Card>
    );
  }

  if (providers.length === 0) {
    return null; // Don't show SSO section if no providers are enabled
  }

  return (
    <div>
      <Divider>
        <Text type="secondary">Or sign in with</Text>
      </Divider>
      
      {error && (
        <Alert
          message="SSO Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {providers.map(provider => (
          <Button
            key={provider.id}
            type="default"
            size="large"
            icon={getProviderIcon(provider.id)}
            onClick={() => handleSSOLogin(provider.id)}
            loading={loading}
            style={{
              width: '100%',
              height: '48px',
              borderColor: getProviderColor(provider.id),
              color: getProviderColor(provider.id),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = getProviderColor(provider.id);
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = getProviderColor(provider.id);
            }}
          >
            Continue with {provider.name}
          </Button>
        ))}
      </Space>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          By signing in with SSO, you agree to our terms of service and privacy policy.
        </Text>
      </div>
    </div>
  );
};

export default SSOLogin;
