import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Progress } from 'antd';
import { LockOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const ChangePassword = ({ isFirstLogin = false }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const { changePassword, user } = useAuth();

  // Calculate password strength
  const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    
    let strength = 0;
    const checks = [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password)
    ];
    
    strength = (checks.filter(Boolean).length / checks.length) * 100;
    return strength;
  };

  const getPasswordStrengthColor = (strength) => {
    if (strength < 40) return '#ff4d4f';
    if (strength < 70) return '#faad14';
    return '#52c41a';
  };

  const getPasswordStrengthText = (strength) => {
    if (strength < 40) return 'Weak';
    if (strength < 70) return 'Medium';
    return 'Strong';
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await changePassword(
        isFirstLogin ? 'admin' : values.currentPassword,
        values.newPassword
      );
      
      if (result.success) {
        form.resetFields();
      }
    } catch (error) {
      console.error('Password change error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const password = e.target.value;
    setPasswordStrength(calculatePasswordStrength(password));
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
          maxWidth: 500,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          borderRadius: '12px'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <Title level={2} style={{ color: '#1890ff', marginBottom: '8px' }}>
            {isFirstLogin ? 'Welcome!' : 'Change Password'}
          </Title>
          <Text type="secondary">
            {isFirstLogin 
              ? 'Please change your password to continue'
              : 'Update your account password'
            }
          </Text>
        </div>

        {isFirstLogin && (
          <Alert
            message="Password Change Required"
            description="For security reasons, you must change your password before accessing the dashboard."
            type="warning"
            showIcon
            style={{ marginBottom: '20px' }}
          />
        )}

        <Form
          form={form}
          name="changePassword"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          {!isFirstLogin && (
            <Form.Item
              name="currentPassword"
              label="Current Password"
              rules={[
                {
                  required: true,
                  message: 'Please input your current password!',
                },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Enter current password"
              />
            </Form.Item>
          )}

          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              {
                required: true,
                message: 'Please input your new password!',
              },
              {
                min: 6,
                message: 'Password must be at least 6 characters long!',
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter new password"
              onChange={handlePasswordChange}
            />
          </Form.Item>

          {passwordStrength > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Password Strength: {getPasswordStrengthText(passwordStrength)}
              </Text>
              <Progress
                percent={passwordStrength}
                strokeColor={getPasswordStrengthColor(passwordStrength)}
                showInfo={false}
                size="small"
                style={{ marginTop: '4px' }}
              />
            </div>
          )}

          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            dependencies={['newPassword']}
            rules={[
              {
                required: true,
                message: 'Please confirm your new password!',
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirm new password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: '16px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              icon={<CheckOutlined />}
              style={{
                height: '48px',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              {loading ? 'Updating Password...' : 'Update Password'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Password Requirements: Minimum 6 characters
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default ChangePassword;
