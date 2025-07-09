import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Button, Table, Tag, Typography, Space,
  Modal, Form, Input, InputNumber, message, Tooltip, Progress, Alert
} from 'antd';
import {
  GlobalOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined, PlusOutlined, ReloadOutlined,
  DeleteOutlined, EyeOutlined, SecurityScanOutlined,
  ClockCircleOutlined, ThunderboltOutlined, SortAscendingOutlined,
  EditOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const WebsiteMonitoring = () => {
  const [websites, setWebsites] = useState([]);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [editingWebsite, setEditingWebsite] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const { token } = useAuth();

  // Fetch data on component mount
  useEffect(() => {
    fetchWebsites();
    fetchResults();
    fetchStats();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchResults();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // API calls
  const fetchWebsites = async () => {
    try {
      const response = await fetch('/api/website-monitoring/websites', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setWebsites(data.websites);
      }
    } catch (error) {
      console.error('Error fetching websites:', error);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch('/api/website-monitoring/results', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setResults(data.results);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/website-monitoring/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const addWebsite = async (values) => {
    try {
      setLoading(true);
      const response = await fetch('/api/website-monitoring/websites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...values,
          checkInterval: values.checkInterval * 60000, // Convert minutes to milliseconds
          alertThreshold: values.alertThreshold * 1000  // Convert seconds to milliseconds
        })
      });

      const data = await response.json();
      if (data.success) {
        message.success('Website added successfully');
        setAddModalVisible(false);
        form.resetFields();
        fetchWebsites();
        fetchResults();
      } else {
        message.error(data.error || 'Failed to add website');
      }
    } catch (error) {
      message.error('Error adding website');
    } finally {
      setLoading(false);
    }
  };

  const editWebsite = async (values) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/website-monitoring/websites/${editingWebsite.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...values,
          checkInterval: values.checkInterval * 60000, // Convert minutes to milliseconds
          alertThreshold: values.alertThreshold * 1000  // Convert seconds to milliseconds
        })
      });

      const data = await response.json();
      if (data.success) {
        message.success('Website updated successfully');
        setEditModalVisible(false);
        setEditingWebsite(null);
        editForm.resetFields();
        fetchWebsites();
        fetchResults();
      } else {
        message.error(data.error || 'Failed to update website');
      }
    } catch (error) {
      message.error('Error updating website');
    } finally {
      setLoading(false);
    }
  };

  const removeWebsite = async (websiteId) => {
    try {
      const response = await fetch(`/api/website-monitoring/websites/${websiteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Website removed successfully');
        fetchWebsites();
        fetchResults();
      } else {
        message.error(data.error || 'Failed to remove website');
      }
    } catch (error) {
      message.error('Error removing website');
    }
  };

  const checkWebsite = async (websiteId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/website-monitoring/check/${websiteId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Website check completed');
        fetchResults();
      } else {
        message.error(data.error || 'Failed to check website');
      }
    } catch (error) {
      message.error('Error checking website');
    } finally {
      setLoading(false);
    }
  };

  const showDetails = (website) => {
    const result = results.find(r => r.websiteId === website.id);
    setSelectedWebsite({ ...website, result });
    setDetailsModalVisible(true);
  };

  const showEdit = (website) => {
    setEditingWebsite(website);
    editForm.setFieldsValue({
      name: website.name,
      url: website.url,
      checkInterval: Math.floor(website.checkInterval / 60000), // Convert milliseconds to minutes
      alertThreshold: Math.floor(website.alertThreshold / 1000)  // Convert milliseconds to seconds
    });
    setEditModalVisible(true);
  };

  // Helper functions
  const getStatusColor = (status) => {
    switch (status) {
      case 'up': return 'green';
      case 'down': return 'red';
      case 'checking': return 'orange';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'up': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'down': return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      case 'checking': return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      default: return <ExclamationCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const formatResponseTime = (time) => {
    if (!time) return 'N/A';
    return time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(2)}s`;
  };

  // Prepare websites with results for table
  const getWebsitesWithResults = () => {
    return websites.map(website => {
      const result = results.find(r => r.websiteId === website.id);
      return { ...website, result };
    });
  };

  // Table columns
  const columns = [
    {
      title: 'Website',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.url}</div>
        </div>
      )
    },
    {
      title: 'Status',
      key: 'status',
      sorter: (a, b) => {
        const statusA = a.result?.status || 'pending';
        const statusB = b.result?.status || 'pending';
        const statusOrder = { 'down': 0, 'checking': 1, 'pending': 2, 'up': 3 };
        return (statusOrder[statusA] || 2) - (statusOrder[statusB] || 2);
      },
      render: (_, record) => {
        const result = record.result || results.find(r => r.websiteId === record.id);
        const status = result?.status || 'pending';
        return (
          <Space>
            {getStatusIcon(status)}
            <Tag color={getStatusColor(status)}>
              {status.toUpperCase()}
            </Tag>
          </Space>
        );
      }
    },
    {
      title: 'Response Time',
      key: 'responseTime',
      sorter: (a, b) => {
        const responseTimeA = a.result?.responseTime || 0;
        const responseTimeB = b.result?.responseTime || 0;
        return responseTimeA - responseTimeB;
      },
      render: (_, record) => {
        const result = record.result || results.find(r => r.websiteId === record.id);
        const responseTime = result?.responseTime || 0;
        return (
          <Text style={{
            color: responseTime > 3000 ? '#f5222d' : responseTime > 1000 ? '#faad14' : '#52c41a'
          }}>
            {formatResponseTime(responseTime)}
          </Text>
        );
      }
    },
    {
      title: 'Uptime',
      key: 'uptime',
      sorter: (a, b) => {
        const uptimeA = a.result?.uptime || 100;
        const uptimeB = b.result?.uptime || 100;
        return uptimeA - uptimeB;
      },
      render: (_, record) => {
        const result = record.result || results.find(r => r.websiteId === record.id);
        const uptime = result?.uptime || 100;
        return (
          <div style={{ width: '80px' }}>
            <Progress
              percent={uptime}
              size="small"
              status={uptime < 95 ? 'exception' : uptime < 99 ? 'active' : 'success'}
              format={percent => `${percent}%`}
            />
          </div>
        );
      }
    },
    {
      title: 'SSL',
      key: 'ssl',
      sorter: (a, b) => {
        const sslA = a.result?.sslInfo?.daysUntilExpiry || 999;
        const sslB = b.result?.sslInfo?.daysUntilExpiry || 999;
        return sslA - sslB;
      },
      render: (_, record) => {
        const result = record.result || results.find(r => r.websiteId === record.id);
        const sslInfo = result?.sslInfo;

        if (!record.url.startsWith('https://')) {
          return <Text type="secondary">N/A</Text>;
        }

        if (!sslInfo) {
          return <Tag color="default">Unknown</Tag>;
        }

        if (!sslInfo.valid) {
          return <Tag color="red">Invalid</Tag>;
        }

        const daysUntilExpiry = sslInfo.daysUntilExpiry;
        const color = daysUntilExpiry < 30 ? 'red' : daysUntilExpiry < 90 ? 'orange' : 'green';

        return (
          <Tooltip title={`Expires: ${new Date(sslInfo.validTo).toLocaleDateString()}`}>
            <Tag color={color}>
              {daysUntilExpiry}d left
            </Tag>
          </Tooltip>
        );
      }
    },
    {
      title: 'Last Check',
      key: 'lastCheck',
      sorter: (a, b) => {
        const lastCheckA = a.result?.lastCheck ? new Date(a.result.lastCheck).getTime() : 0;
        const lastCheckB = b.result?.lastCheck ? new Date(b.result.lastCheck).getTime() : 0;
        return lastCheckB - lastCheckA; // Most recent first
      },
      render: (_, record) => {
        const result = record.result || results.find(r => r.websiteId === record.id);
        const lastCheck = result?.lastCheck;
        return lastCheck ? new Date(lastCheck).toLocaleString() : 'Never';
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Check Now">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => checkWebsite(record.id)}
              loading={loading}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => showEdit(record)}
            />
          </Tooltip>
          <Tooltip title="View Details">
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => showDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Remove">
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={() => {
                Modal.confirm({
                  title: 'Remove Website',
                  content: `Are you sure you want to remove "${record.name}"?`,
                  onOk: () => removeWebsite(record.id)
                });
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>Website Monitoring</Title>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
          >
            Add Website
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchResults();
              fetchStats();
            }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Websites"
              value={stats.totalSites || 0}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Online"
              value={stats.upSites || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Offline"
              value={stats.downSites || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg Response"
              value={formatResponseTime(stats.averageResponseTime || 0)}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ 
                color: (stats.averageResponseTime || 0) > 3000 ? '#f5222d' : 
                       (stats.averageResponseTime || 0) > 1000 ? '#faad14' : '#52c41a'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Websites Table */}
      <Card title="Monitored Websites">
        <Table
          columns={columns}
          dataSource={getWebsitesWithResults()}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} websites`,
            pageSizeOptions: ['5', '10', '20', '50']
          }}
          loading={loading}
        />
      </Card>

      {/* Add Website Modal */}
      <Modal
        title="Add Website"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={addWebsite}
        >
          <Form.Item
            name="name"
            label="Website Name"
            rules={[{ required: true, message: 'Please enter website name' }]}
          >
            <Input placeholder="My Website" />
          </Form.Item>
          
          <Form.Item
            name="url"
            label="URL"
            rules={[
              { required: true, message: 'Please enter URL' },
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>
          
          <Form.Item
            name="checkInterval"
            label="Check Interval (minutes)"
            initialValue={5}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="alertThreshold"
            label="Alert Threshold (seconds)"
            initialValue={5}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setAddModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Add Website
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Website Modal */}
      <Modal
        title="Edit Website"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingWebsite(null);
          editForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={editWebsite}
        >
          <Form.Item
            name="name"
            label="Website Name"
            rules={[{ required: true, message: 'Please enter website name' }]}
          >
            <Input placeholder="My Website" />
          </Form.Item>

          <Form.Item
            name="url"
            label="URL"
            rules={[
              { required: true, message: 'Please enter URL' },
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>

          <Form.Item
            name="checkInterval"
            label="Check Interval (minutes)"
            rules={[{ required: true, message: 'Please enter check interval' }]}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="alertThreshold"
            label="Alert Threshold (seconds)"
            rules={[{ required: true, message: 'Please enter alert threshold' }]}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setEditModalVisible(false);
                setEditingWebsite(null);
                editForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Update Website
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Website Details Modal */}
      <Modal
        title={selectedWebsite ? `Website Details - ${selectedWebsite.name}` : 'Website Details'}
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            Close
          </Button>
        ]}
        width={900}
      >
        {selectedWebsite && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" title="Basic Information">
                  <p><strong>Name:</strong> {selectedWebsite.name}</p>
                  <p><strong>URL:</strong> <a href={selectedWebsite.url} target="_blank" rel="noopener noreferrer">{selectedWebsite.url}</a></p>
                  <p><strong>Check Interval:</strong> {Math.floor(selectedWebsite.checkInterval / 60000)} minutes</p>
                  <p><strong>Alert Threshold:</strong> {selectedWebsite.alertThreshold / 1000} seconds</p>
                  <p><strong>Status:</strong>
                    <Tag color={getStatusColor(selectedWebsite.result?.status)} style={{ marginLeft: 8 }}>
                      {selectedWebsite.result?.status?.toUpperCase() || 'UNKNOWN'}
                    </Tag>
                  </p>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="Performance Metrics">
                  <p><strong>Response Time:</strong>
                    <span style={{ marginLeft: 8, color: (selectedWebsite.result?.responseTime || 0) > 3000 ? '#f5222d' : '#52c41a' }}>
                      {formatResponseTime(selectedWebsite.result?.responseTime)}
                    </span>
                  </p>
                  <p><strong>Status Code:</strong>
                    <Tag color={selectedWebsite.result?.statusCode >= 200 && selectedWebsite.result?.statusCode < 400 ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                      {selectedWebsite.result?.statusCode || 'N/A'}
                    </Tag>
                  </p>
                  <p><strong>Uptime:</strong>
                    <Progress
                      percent={selectedWebsite.result?.uptime || 100}
                      size="small"
                      style={{ marginLeft: 8, width: '100px' }}
                    />
                  </p>
                  <p><strong>Last Check:</strong> {selectedWebsite.result?.lastCheck ? new Date(selectedWebsite.result.lastCheck).toLocaleString() : 'Never'}</p>
                </Card>
              </Col>
            </Row>

            {selectedWebsite.result?.sslInfo && (
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Card size="small" title="SSL Certificate Information">
                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <p><strong>Valid:</strong>
                          <Tag color={selectedWebsite.result.sslInfo.valid ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                            {selectedWebsite.result.sslInfo.valid ? 'Yes' : 'No'}
                          </Tag>
                        </p>
                        <p><strong>Issuer:</strong> {selectedWebsite.result.sslInfo.issuer?.CN || 'N/A'}</p>
                        <p><strong>Subject:</strong> {selectedWebsite.result.sslInfo.subject?.CN || 'N/A'}</p>
                      </Col>
                      <Col span={12}>
                        <p><strong>Valid From:</strong> {selectedWebsite.result.sslInfo.validFrom ? new Date(selectedWebsite.result.sslInfo.validFrom).toLocaleDateString() : 'N/A'}</p>
                        <p><strong>Valid To:</strong> {selectedWebsite.result.sslInfo.validTo ? new Date(selectedWebsite.result.sslInfo.validTo).toLocaleDateString() : 'N/A'}</p>
                        <p><strong>Days Until Expiry:</strong>
                          <span style={{
                            marginLeft: 8,
                            color: selectedWebsite.result.sslInfo.daysUntilExpiry < 30 ? '#f5222d' :
                                   selectedWebsite.result.sslInfo.daysUntilExpiry < 90 ? '#faad14' : '#52c41a'
                          }}>
                            {selectedWebsite.result.sslInfo.daysUntilExpiry || 'N/A'} days
                          </span>
                        </p>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            )}

            {selectedWebsite.result?.securityHeaders && (
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Card size="small" title="Security Headers">
                    <Row gutter={[16, 16]}>
                      {Object.entries(selectedWebsite.result.securityHeaders).map(([header, info]) => (
                        <Col span={8} key={header}>
                          <div style={{ marginBottom: 8 }}>
                            <strong>{header}:</strong>
                            <Tag color={info.present ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                              {info.present ? 'Present' : 'Missing'}
                            </Tag>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                </Col>
              </Row>
            )}

            {selectedWebsite.result?.dnsInfo && (
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Card size="small" title="DNS Information">
                    <p><strong>Resolved:</strong>
                      <Tag color={selectedWebsite.result.dnsInfo.resolved ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                        {selectedWebsite.result.dnsInfo.resolved ? 'Yes' : 'No'}
                      </Tag>
                    </p>
                    <p><strong>Response Time:</strong> {formatResponseTime(selectedWebsite.result.dnsInfo.responseTime)}</p>
                    {selectedWebsite.result.dnsInfo.addresses && selectedWebsite.result.dnsInfo.addresses.length > 0 && (
                      <div>
                        <strong>IP Addresses:</strong>
                        <div style={{ marginTop: 8 }}>
                          {selectedWebsite.result.dnsInfo.addresses.map(ip => (
                            <Tag key={ip} style={{ marginBottom: 4 }}>{ip}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WebsiteMonitoring;
