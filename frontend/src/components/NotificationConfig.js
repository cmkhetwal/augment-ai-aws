import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Switch, Button, Space, Typography, Alert,
  Divider, Row, Col, Select, InputNumber, Tabs, message
} from 'antd';
import {
  SlackOutlined,
  MailOutlined,
  GoogleOutlined,
  BellOutlined,
  ExperimentOutlined,
  SaveOutlined,
  SettingOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const NotificationConfig = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [config, setConfig] = useState({
    email: { enabled: false },
    slack: { enabled: false, channel: '#aws-monitoring' },
    googleChat: { enabled: false }
  });
  const [formValues, setFormValues] = useState({});

  // Load current configuration
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const response = await fetch('/api/notifications/config');
      const data = await response.json();
      setConfig(data);
      setFormValues(data);
      form.setFieldsValue(data);
    } catch (error) {
      console.error('Error loading configuration:', error);
      message.error('Failed to load notification configuration');
    }
  };

  // Handle form values change
  const handleFormValuesChange = (changedValues, allValues) => {
    setFormValues(allValues);
  };

  const handleSave = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success('Notification configuration saved successfully');
        setConfig(values);
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      message.error('Failed to save notification configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTestLoading(true);
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        message.success('Test notifications sent! Check your configured channels.');
        console.log('Test results:', data.results);
      } else {
        throw new Error(data.error || 'Failed to send test notifications');
      }
    } catch (error) {
      console.error('Error sending test notifications:', error);
      message.error('Failed to send test notifications: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '24px' }}>
          <Title level={3}>
            <BellOutlined style={{ marginRight: '8px' }} />
            Notification Configuration
          </Title>
          <Paragraph type="secondary">
            Configure notification channels to receive alerts for high CPU usage, memory usage, 
            instance failures, and security risks.
          </Paragraph>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={config}
          onValuesChange={handleFormValuesChange}
        >
          <Tabs defaultActiveKey="slack" type="card">
            {/* Slack Configuration */}
            <TabPane
              tab={
                <span>
                  <SlackOutlined />
                  Slack
                </span>
              }
              key="slack"
            >
              <Card size="small" style={{ marginBottom: '16px' }}>
                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item
                      name={['slack', 'enabled']}
                      label="Enable Slack Notifications"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      name={['slack', 'webhookUrl']}
                      label="Webhook URL"
                      rules={[
                        {
                          type: 'url',
                          message: 'Please enter a valid webhook URL',
                        },
                      ]}
                    >
                      <Input
                        placeholder="https://hooks.slack.com/services/..."
                        disabled={!formValues.slack?.enabled}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name={['slack', 'channel']}
                      label="Channel"
                    >
                      <Input
                        placeholder="#aws-monitoring"
                        disabled={!formValues.slack?.enabled}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name={['slack', 'username']}
                      label="Bot Username"
                    >
                      <Input
                        placeholder="AWS Monitor Bot"
                        disabled={!formValues.slack?.enabled}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Alert
                  message="How to set up Slack webhook"
                  description={
                    <div>
                      <Text>1. Go to your Slack workspace and create a new app</Text><br />
                      <Text>2. Enable Incoming Webhooks</Text><br />
                      <Text>3. Create a webhook for your desired channel</Text><br />
                      <Text>4. Copy the webhook URL and paste it above</Text>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: '16px' }}
                />
              </Card>
            </TabPane>

            {/* Google Chat Configuration */}
            <TabPane
              tab={
                <span>
                  <GoogleOutlined />
                  Google Chat
                </span>
              }
              key="googleChat"
            >
              <Card size="small" style={{ marginBottom: '16px' }}>
                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item
                      name={['googleChat', 'enabled']}
                      label="Enable Google Chat Notifications"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item
                      name={['googleChat', 'webhookUrl']}
                      label="Webhook URL"
                      rules={[
                        {
                          type: 'url',
                          message: 'Please enter a valid webhook URL',
                        },
                      ]}
                    >
                      <Input
                        placeholder="https://chat.googleapis.com/v1/spaces/..."
                        disabled={!formValues.googleChat?.enabled}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Alert
                  message="How to set up Google Chat webhook"
                  description={
                    <div>
                      <Text>1. Open Google Chat and go to the space where you want notifications</Text><br />
                      <Text>2. Click on the space name and select "Manage webhooks"</Text><br />
                      <Text>3. Click "Add webhook" and give it a name</Text><br />
                      <Text>4. Copy the webhook URL and paste it above</Text>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: '16px' }}
                />
              </Card>
            </TabPane>

            {/* Email Configuration */}
            <TabPane
              tab={
                <span>
                  <MailOutlined />
                  Email
                </span>
              }
              key="email"
            >
              <Card size="small" style={{ marginBottom: '16px' }}>
                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item
                      name={['email', 'enabled']}
                      label="Enable Email Notifications"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      name={['email', 'smtpHost']}
                      label="SMTP Host"
                    >
                      <Input
                        placeholder="smtp.gmail.com"
                        disabled={!formValues.email?.enabled}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name={['email', 'smtpPort']}
                      label="SMTP Port"
                    >
                      <InputNumber
                        placeholder="587"
                        style={{ width: '100%' }}
                        disabled={!formValues.email?.enabled}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name={['email', 'smtpSecure']}
                      label="Use SSL/TLS"
                      valuePropName="checked"
                    >
                      <Switch disabled={!formValues.email?.enabled} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      name={['email', 'smtpUser']}
                      label="SMTP Username"
                    >
                      <Input
                        placeholder="your-email@gmail.com"
                        disabled={!formValues.email?.enabled}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['email', 'smtpPass']}
                      label="SMTP Password"
                    >
                      <Input.Password
                        placeholder="Your app password"
                        disabled={!formValues.email?.enabled}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      name={['email', 'fromEmail']}
                      label="From Email"
                    >
                      <Input
                        placeholder="aws-monitor@yourcompany.com"
                        disabled={!formValues.email?.enabled}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['email', 'toEmails']}
                      label="To Emails (comma separated)"
                    >
                      <TextArea
                        placeholder="admin@yourcompany.com, devops@yourcompany.com"
                        rows={2}
                        disabled={!formValues.email?.enabled}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Alert
                  message="Email Configuration Note"
                  description="For Gmail, you'll need to use an App Password instead of your regular password. Enable 2FA first, then generate an App Password in your Google Account settings."
                  type="info"
                  showIcon
                  style={{ marginTop: '16px' }}
                />
              </Card>
            </TabPane>

            {/* Alert Settings */}
            <TabPane
              tab={
                <span>
                  <SettingOutlined />
                  Alert Settings
                </span>
              }
              key="settings"
            >
              <Card size="small" style={{ marginBottom: '16px' }}>
                <Title level={5}>Alert Thresholds</Title>
                
                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item
                      name={['thresholds', 'cpu', 'warning']}
                      label="CPU Warning (%)"
                      initialValue={70}
                    >
                      <InputNumber min={0} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['thresholds', 'cpu', 'critical']}
                      label="CPU Critical (%)"
                      initialValue={90}
                    >
                      <InputNumber min={0} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item
                      name={['thresholds', 'memory', 'warning']}
                      label="Memory Warning (%)"
                      initialValue={80}
                    >
                      <InputNumber min={0} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['thresholds', 'memory', 'critical']}
                      label="Memory Critical (%)"
                      initialValue={95}
                    >
                      <InputNumber min={0} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider />

                <Title level={5}>Notification Frequency</Title>
                
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      name={['frequency', 'alertCooldown']}
                      label="Alert Cooldown (minutes)"
                      initialValue={5}
                      help="Minimum time between identical alerts"
                    >
                      <InputNumber min={1} max={60} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['frequency', 'batchAlerts']}
                      label="Batch Alerts"
                      valuePropName="checked"
                      initialValue={true}
                      help="Group multiple alerts into single notifications"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </TabPane>
          </Tabs>

          <Divider />

          <div style={{ textAlign: 'center' }}>
            <Space size="large">
              <Button
                type="default"
                icon={<ExperimentOutlined />}
                onClick={handleTest}
                loading={testLoading}
                disabled={!config.email?.enabled && !config.slack?.enabled && !config.googleChat?.enabled}
              >
                Send Test Notification
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={loading}
                size="large"
              >
                Save Configuration
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default NotificationConfig;