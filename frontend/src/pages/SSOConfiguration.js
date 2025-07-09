import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Button, Table, Tag, Typography, Space, Modal, Form, Input, Switch,
  message, Tooltip, Alert, Tabs, Divider
} from 'antd';
import {
  SettingOutlined, GoogleOutlined, WindowsOutlined, SafetyOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExperimentOutlined, SaveOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const SSOConfiguration = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [form] = Form.useForm();
  const { token, user } = useAuth();

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchProviders();
    }
  }, [isAdmin]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sso/providers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProviders(data.providers);
      }
    } catch (error) {
      console.error('Error fetching SSO providers:', error);
      message.error('Failed to load SSO providers');
    } finally {
      setLoading(false);
    }
  };

  const configureProvider = async (values) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sso/providers/${selectedProvider.id}/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: values.enabled,
          settings: values
        })
      });

      const data = await response.json();
      if (data.success) {
        message.success('SSO provider configured successfully');
        setConfigModalVisible(false);
        form.resetFields();
        fetchProviders();
      } else {
        message.error(data.error || 'Failed to configure SSO provider');
      }
    } catch (error) {
      console.error('Error configuring SSO provider:', error);
      message.error('Failed to configure SSO provider');
    } finally {
      setLoading(false);
    }
  };

  const testProvider = async (providerId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sso/providers/${providerId}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success && data.testResult.success) {
        message.success('SSO provider connection test successful');
      } else {
        message.error(data.testResult?.error || 'SSO provider connection test failed');
      }
    } catch (error) {
      console.error('Error testing SSO provider:', error);
      message.error('Failed to test SSO provider');
    } finally {
      setLoading(false);
    }
  };

  const openConfigModal = (provider) => {
    setSelectedProvider(provider);
    setConfigModalVisible(true);
    form.resetFields();
  };

  const getProviderIcon = (providerId) => {
    switch (providerId) {
      case 'google':
        return <GoogleOutlined style={{ color: '#4285f4' }} />;
      case 'microsoft':
        return <WindowsOutlined style={{ color: '#0078d4' }} />;
      case 'okta':
        return <SafetyOutlined style={{ color: '#007dc1' }} />;
      default:
        return <SettingOutlined />;
    }
  };

  const columns = [
    {
      title: 'Provider',
      key: 'provider',
      render: (_, record) => (
        <Space>
          {getProviderIcon(record.id)}
          <span style={{ fontWeight: 'bold' }}>{record.name}</span>
        </Space>
      )
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color="blue">{type.toUpperCase()}</Tag>
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Tag color={record.enabled ? 'green' : 'default'} icon={record.enabled ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {record.enabled ? 'Enabled' : 'Disabled'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => openConfigModal(record)}
          >
            Configure
          </Button>
          {record.enabled && (
            <Button
              size="small"
              icon={<ExperimentOutlined />}
              onClick={() => testProvider(record.id)}
              loading={loading}
            >
              Test
            </Button>
          )}
        </Space>
      )
    }
  ];

  if (!isAdmin) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Access Denied"
          description="You need administrator privileges to configure SSO settings."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>SSO Configuration</Title>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card title="Single Sign-On Providers">
            <Paragraph>
              Configure Single Sign-On (SSO) providers to allow users to authenticate using their existing accounts.
              Currently supported providers include Google Workspace, Microsoft Office 365, and Okta.
            </Paragraph>
            
            <Table
              columns={columns}
              dataSource={providers}
              rowKey="id"
              loading={loading}
              pagination={false}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card title="SSO Setup Instructions">
            <Tabs defaultActiveKey="google">
              <TabPane tab="Google Workspace" key="google">
                <div>
                  <Title level={4}>Google Workspace SSO Setup</Title>
                  <Paragraph>
                    To configure Google Workspace SSO for your bamko.net domain:
                  </Paragraph>
                  <ol>
                    <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                    <li>Create a new project or select an existing one</li>
                    <li>Enable the Google+ API</li>
                    <li>Go to "Credentials" and create an OAuth 2.0 Client ID</li>
                    <li>Set the authorized redirect URI to: <code>http://34.229.57.190/api/sso/callback/google</code></li>
                    <li>Copy the Client ID and Client Secret</li>
                    <li>Configure the provider above with these credentials</li>
                    <li>Set the workspace domain to: <code>bamko.net</code></li>
                  </ol>
                </div>
              </TabPane>
              
              <TabPane tab="Microsoft Office 365" key="microsoft">
                <div>
                  <Title level={4}>Microsoft Office 365 SSO Setup</Title>
                  <Paragraph>
                    To configure Office 365 SSO:
                  </Paragraph>
                  <ol>
                    <li>Go to the <a href="https://portal.azure.com/" target="_blank" rel="noopener noreferrer">Azure Portal</a></li>
                    <li>Navigate to "Azure Active Directory" → "App registrations"</li>
                    <li>Click "New registration"</li>
                    <li>Set the redirect URI to: <code>http://34.229.57.190/api/sso/callback/microsoft</code></li>
                    <li>Copy the Application (client) ID</li>
                    <li>Go to "Certificates & secrets" and create a new client secret</li>
                    <li>Configure the provider above with these credentials</li>
                  </ol>
                </div>
              </TabPane>
              
              <TabPane tab="Okta" key="okta">
                <div>
                  <Title level={4}>Okta SSO Setup</Title>
                  <Paragraph>
                    To configure Okta SSO:
                  </Paragraph>
                  <ol>
                    <li>Log in to your Okta Admin Console</li>
                    <li>Go to "Applications" → "Applications"</li>
                    <li>Click "Create App Integration"</li>
                    <li>Select "OIDC - OpenID Connect" and "Web Application"</li>
                    <li>Set the redirect URI to: <code>http://34.229.57.190/api/sso/callback/okta</code></li>
                    <li>Copy the Client ID and Client Secret</li>
                    <li>Configure the provider above with these credentials</li>
                  </ol>
                </div>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>

      {/* Configuration Modal */}
      <Modal
        title={`Configure ${selectedProvider?.name || 'SSO Provider'}`}
        open={configModalVisible}
        onCancel={() => {
          setConfigModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        {selectedProvider && (
          <Form
            form={form}
            layout="vertical"
            onFinish={configureProvider}
            initialValues={{ enabled: selectedProvider.enabled }}
          >
            <Form.Item
              name="enabled"
              label="Enable Provider"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Divider />

            {selectedProvider.id === 'google' && (
              <>
                <Form.Item
                  name="clientId"
                  label="Client ID"
                  rules={[{ required: true, message: 'Please enter Client ID' }]}
                >
                  <Input placeholder="Google OAuth Client ID" />
                </Form.Item>
                
                <Form.Item
                  name="clientSecret"
                  label="Client Secret"
                  rules={[{ required: true, message: 'Please enter Client Secret' }]}
                >
                  <Input.Password placeholder="Google OAuth Client Secret" />
                </Form.Item>
                
                <Form.Item
                  name="domain"
                  label="Workspace Domain"
                  initialValue="bamko.net"
                  rules={[{ required: true, message: 'Please enter workspace domain' }]}
                >
                  <Input placeholder="bamko.net" />
                </Form.Item>
                
                <Form.Item
                  name="redirectUri"
                  label="Redirect URI"
                  initialValue="http://54.172.68.115/api/sso/callback/google"
                >
                  <Input disabled />
                </Form.Item>
              </>
            )}

            {selectedProvider.id === 'microsoft' && (
              <>
                <Form.Item
                  name="clientId"
                  label="Application ID"
                  rules={[{ required: true, message: 'Please enter Application ID' }]}
                >
                  <Input placeholder="Microsoft Application ID" />
                </Form.Item>
                
                <Form.Item
                  name="clientSecret"
                  label="Client Secret"
                  rules={[{ required: true, message: 'Please enter Client Secret' }]}
                >
                  <Input.Password placeholder="Microsoft Client Secret" />
                </Form.Item>
                
                <Form.Item
                  name="tenant"
                  label="Tenant ID"
                  initialValue="common"
                >
                  <Input placeholder="common or your tenant ID" />
                </Form.Item>
                
                <Form.Item
                  name="redirectUri"
                  label="Redirect URI"
                  initialValue="http://54.172.68.115/api/sso/callback/microsoft"
                >
                  <Input disabled />
                </Form.Item>
              </>
            )}

            {selectedProvider.id === 'okta' && (
              <>
                <Form.Item
                  name="clientId"
                  label="Client ID"
                  rules={[{ required: true, message: 'Please enter Client ID' }]}
                >
                  <Input placeholder="Okta Client ID" />
                </Form.Item>
                
                <Form.Item
                  name="clientSecret"
                  label="Client Secret"
                  rules={[{ required: true, message: 'Please enter Client Secret' }]}
                >
                  <Input.Password placeholder="Okta Client Secret" />
                </Form.Item>
                
                <Form.Item
                  name="domain"
                  label="Okta Domain"
                  rules={[{ required: true, message: 'Please enter Okta domain' }]}
                >
                  <Input placeholder="your-domain" />
                </Form.Item>
                
                <Form.Item
                  name="redirectUri"
                  label="Redirect URI"
                  initialValue="http://54.172.68.115/api/sso/callback/okta"
                >
                  <Input disabled />
                </Form.Item>
              </>
            )}

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  setConfigModalVisible(false);
                  form.resetFields();
                }}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                  Save Configuration
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default SSOConfiguration;
