import React from 'react';
import { Row, Col, Card, Typography, Progress, List, Tag } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  DatabaseOutlined, 
  ThunderboltOutlined, 
  HddOutlined, 
  CloudOutlined,
  WarningOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Title, Text } = Typography;

const SystemMetrics = ({ data }) => {
  const { instances, systemMetrics } = data;

  const getMetricColor = (value, type) => {
    const val = parseFloat(value) || 0;
    switch (type) {
      case 'cpu':
      case 'memory':
        if (val > 80) return '#f5222d';
        if (val > 60) return '#faad14';
        return '#52c41a';
      default:
        return '#1890ff';
    }
  };

  const getStatusIcon = (value, type) => {
    const val = parseFloat(value) || 0;
    if (type === 'cpu' || type === 'memory') {
      if (val > 80) return <WarningOutlined style={{ color: '#f5222d' }} />;
    }
    return null;
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>System Metrics</Title>

      <Row gutter={[24, 24]}>
        {Object.entries(systemMetrics).map(([instanceId, metrics]) => {
          const instance = instances.find(i => i.InstanceId === instanceId);
          const instanceName = metrics.instanceName || instanceId;

          return (
            <Col xs={24} lg={12} key={instanceId}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text strong>{instanceName}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {moment(metrics.timestamp).format('HH:mm:ss')}
                    </Text>
                  </div>
                }
                size="small"
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <ThunderboltOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                          <Text strong>CPU Usage</Text>
                          {getStatusIcon(metrics.cpu?.current, 'cpu')}
                        </div>
                        <Text style={{ fontSize: '18px', fontWeight: 'bold', color: getMetricColor(metrics.cpu?.current, 'cpu') }}>
                          {metrics.cpu?.current || 0}%
                        </Text>
                      </div>
                      <Progress 
                        percent={parseFloat(metrics.cpu?.current) || 0}
                        strokeColor={getMetricColor(metrics.cpu?.current, 'cpu')}
                        size="small"
                        style={{ marginTop: '8px' }}
                      />
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">Avg: {metrics.cpu?.average || 0}%</Text>
                        <Text type="secondary">Max: {metrics.cpu?.max || 0}%</Text>
                      </div>
                    </Card>
                  </Col>

                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <DatabaseOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                          <Text strong>Memory Usage</Text>
                          {getStatusIcon(metrics.memory?.current, 'memory')}
                        </div>
                        <Text style={{ fontSize: '18px', fontWeight: 'bold', color: getMetricColor(metrics.memory?.current, 'memory') }}>
                          {metrics.memory?.current || 0}%
                        </Text>
                      </div>
                      <Progress 
                        percent={parseFloat(metrics.memory?.current) || 0}
                        strokeColor={getMetricColor(metrics.memory?.current, 'memory')}
                        size="small"
                        style={{ marginTop: '8px' }}
                      />
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">Avg: {metrics.memory?.average || 0}%</Text>
                        <Text type="secondary">Max: {metrics.memory?.max || 0}%</Text>
                      </div>
                    </Card>
                  </Col>

                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <HddOutlined style={{ marginRight: '8px', color: '#faad14' }} />
                          <Text strong>Disk I/O</Text>
                        </div>
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <Text type="secondary">Read:</Text>
                          <Text>{metrics.disk?.readMB || 0} MB</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary">Write:</Text>
                          <Text>{metrics.disk?.writeMB || 0} MB</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>

                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <CloudOutlined style={{ marginRight: '8px', color: '#722ed1' }} />
                          <Text strong>Network I/O</Text>
                        </div>
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <Text type="secondary">In:</Text>
                          <Text>{metrics.network?.inMB || 0} MB</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary">Out:</Text>
                          <Text>{metrics.network?.outMB || 0} MB</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>

                <Card 
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Top 5 Processes</span>
                      {metrics.topProcesses?.method && (
                        <Tag color={metrics.topProcesses.method === 'SSM' ? 'green' : 'blue'} size="small">
                          {metrics.topProcesses.method}
                        </Tag>
                      )}
                    </div>
                  }
                  size="small" 
                  style={{ marginTop: '16px', backgroundColor: '#fafafa' }}
                >
                  {metrics.topProcesses?.note && (
                    <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic', display: 'block', marginBottom: '12px' }}>
                      {metrics.topProcesses.note}
                    </Text>
                  )}
                  
                  {metrics.topProcesses?.processes && metrics.topProcesses.processes.length > 0 ? (
                    <List
                      size="small"
                      dataSource={metrics.topProcesses.processes}
                      renderItem={(process, index) => (
                        <List.Item style={{ padding: '4px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <Tag color={index === 0 ? 'red' : index === 1 ? 'orange' : 'blue'} style={{ minWidth: '24px', textAlign: 'center', margin: '0 8px 0 0' }}>
                                {index + 1}
                              </Tag>
                              <div>
                                <Text strong>{process.name}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '12px' }}>PID: {process.pid}</Text>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div>
                                <Text style={{ color: getMetricColor(process.cpu, 'cpu'), fontWeight: 'bold' }}>
                                  {process.cpu}%
                                </Text>
                                <Text type="secondary"> CPU</Text>
                              </div>
                              <div>
                                <Text style={{ color: getMetricColor(process.memory, 'memory'), fontWeight: 'bold' }}>
                                  {process.memory}%
                                </Text>
                                <Text type="secondary"> RAM</Text>
                              </div>
                            </div>
                          </div>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                      <ThunderboltOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                      <div>No process data available</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        {metrics.topProcesses?.error ? 
                          `Error: ${metrics.topProcesses.error}` : 
                          'Process monitoring requires CloudWatch Agent or SSM Agent'
                        }
                      </div>
                    </div>
                  )}
                </Card>
              </Card>
            </Col>
          );
        })}
      </Row>

      {Object.keys(systemMetrics).length === 0 && (
        <Card style={{ textAlign: 'center', padding: '40px' }}>
          <ThunderboltOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <Title level={4} type="secondary">No metrics data available</Title>
          <Text type="secondary">
            System metrics will be collected automatically for running instances
          </Text>
        </Card>
      )}
    </div>
  );
};

export default SystemMetrics;