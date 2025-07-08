import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import SSOLogin from './SSOLogin';

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await login(values.identifier, values.password);
      if (result.success) {
        // Login successful - AuthContext will handle navigation
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fillDefaultCredentials = () => {
    form.setFieldsValue({
      identifier: 'admin',
      password: 'admin'
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          borderRadius: '12px'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <Title level={2} style={{ color: '#1890ff', marginBottom: '8px' }}>
            AWS EC2 Monitor
          </Title>
          <Text type="secondary">
            Sign in to access your monitoring dashboard
          </Text>
        </div>

        <Alert
          message="Default Admin Credentials"
          description={
            <div>
              <Text>Username: <strong>admin</strong></Text><br />
              <Text>Password: <strong>admin</strong></Text><br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                You will be required to change the password on first login
              </Text>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: '20px' }}
          action={
            <Button size="small" type="link" onClick={fillDefaultCredentials}>
              Fill Form
            </Button>
          }
        />

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="identifier"
            label="Username or Email"
            rules={[
              {
                required: true,
                message: 'Please input your username or email!',
              },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter username or email"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              {
                required: true,
                message: 'Please input your password!',
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: '16px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              icon={<LoginOutlined />}
              style={{
                height: '48px',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Form.Item>
        </Form>

        {/* SSO Login Options */}
        <SSOLogin loading={loading} />

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical" size="small">
            <Text type="secondary" style={{ fontSize: '12px' }}>
              AWS EC2 Monitoring Dashboard v1.0
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Secure access to your infrastructure monitoring
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default Login;
