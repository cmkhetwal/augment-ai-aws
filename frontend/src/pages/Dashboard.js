import React from 'react';
import { Row, Col, Card, Statistic, Progress, Tag, List, Typography } from 'antd';
import { 
  CloudServerOutlined, 
  WifiOutlined, 
  BarChartOutlined, 
  SecurityScanOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Dashboard = ({ data }) => {
  const { instances, pingResults, systemMetrics, openPorts } = data;

  const getInstanceStats = () => {
    const running = instances.filter(i => i.State.Name === 'running').length;
    const stopped = instances.filter(i => i.State.Name === 'stopped').length;
    const total = instances.length;
    
    return { running, stopped, total };
  };

  const getPingStats = () => {
    const results = Object.values(pingResults);
    const online = results.filter(r => r.alive).length;
    const offline = results.filter(r => !r.alive).length;
    const total = results.length;
    
    return { online, offline, total };
  };

  const getHighCPUInstances = () => {
    return Object.entries(systemMetrics)
      .filter(([id, metrics]) => parseFloat(metrics.cpu?.current || 0) > 80)
      .map(([id, metrics]) => ({
        instanceId: id,
        instanceName: metrics.instanceName,
        cpu: metrics.cpu?.current || 0
      }));
  };

  const getHighRiskPorts = () => {
    const highRiskPorts = [];
    Object.entries(openPorts).forEach(([instanceId, portData]) => {
      if (portData.ports && portData.ports.openPorts) {
        const highRisk = portData.ports.openPorts.filter(port => 
          [21, 23, 135, 139, 445, 1433, 3389].includes(port.port)
        );
        if (highRisk.length > 0) {
          highRiskPorts.push({
            instanceId,
            instanceName: portData.instanceName,
            riskCount: highRisk.length,
            ports: highRisk
          });
        }
      }
    });
    return highRiskPorts;
  };

  const instanceStats = getInstanceStats();
  const pingStats = getPingStats();
  const highCPUInstances = getHighCPUInstances();
  const highRiskPorts = getHighRiskPorts();

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Dashboard Overview</Title>
      
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Instances"
              value={instanceStats.total}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: '16px' }}>
              <Text type="success">Running: {instanceStats.running}</Text>
              <br />
              <Text type="secondary">Stopped: {instanceStats.stopped}</Text>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Ping Status"
              value={pingStats.online}
              suffix={`/ ${pingStats.total}`}
              prefix={<WifiOutlined />}
              valueStyle={{ color: pingStats.online === pingStats.total ? '#52c41a' : '#faad14' }}
            />
            <Progress 
              percent={pingStats.total > 0 ? (pingStats.online / pingStats.total) * 100 : 0}
              size="small"
              style={{ marginTop: '16px' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="High CPU Alerts"
              value={highCPUInstances.length}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: highCPUInstances.length > 0 ? '#f5222d' : '#52c41a' }}
            />
            <div style={{ marginTop: '16px' }}>
              <Text type={highCPUInstances.length > 0 ? 'danger' : 'success'}>
                {highCPUInstances.length > 0 ? 'Action Required' : 'All Normal'}
              </Text>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Security Risks"
              value={highRiskPorts.length}
              prefix={<SecurityScanOutlined />}
              valueStyle={{ color: highRiskPorts.length > 0 ? '#f5222d' : '#52c41a' }}
            />
            <div style={{ marginTop: '16px' }}>
              <Text type={highRiskPorts.length > 0 ? 'danger' : 'success'}>
                {highRiskPorts.length > 0 ? 'High Risk Ports' : 'No Risks Detected'}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Instance Status" size="small">
            <List
              size="small"
              dataSource={instances.slice(0, 10)}
              renderItem={instance => {
                const instanceName = instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId;
                const pingResult = pingResults[instance.InstanceId];
                const isOnline = pingResult?.alive;
                
                return (
                  <List.Item>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {isOnline ? (
                          <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                        ) : (
                          <CloseCircleOutlined style={{ color: '#f5222d', marginRight: '8px' }} />
                        )}
                        <Text strong>{instanceName}</Text>
                      </div>
                      <div>
                        <Tag color={instance.State.Name === 'running' ? 'green' : 'orange'}>
                          {instance.State.Name}
                        </Tag>
                        {isOnline !== undefined && (
                          <Tag color={isOnline ? 'green' : 'red'}>
                            {isOnline ? 'Online' : 'Offline'}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="System Alerts" size="small">
            <List
              size="small"
              dataSource={[
                ...highCPUInstances.map(instance => ({
                  type: 'cpu',
                  title: `High CPU Usage`,
                  description: `${instance.instanceName}: ${instance.cpu}%`,
                  level: 'error'
                })),
                ...highRiskPorts.map(instance => ({
                  type: 'security',
                  title: `Security Risk Detected`,
                  description: `${instance.instanceName}: ${instance.riskCount} high-risk ports`,
                  level: 'warning'
                }))
              ]}
              renderItem={alert => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <ExclamationCircleOutlined 
                      style={{ 
                        color: alert.level === 'error' ? '#f5222d' : '#faad14',
                        marginRight: '8px'
                      }} 
                    />
                    <div>
                      <Text strong>{alert.title}</Text>
                      <br />
                      <Text type="secondary">{alert.description}</Text>
                    </div>
                  </div>
                </List.Item>
              )}
            />
            {highCPUInstances.length === 0 && highRiskPorts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '24px' }} />
                <br />
                <Text type="secondary">No alerts at this time</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
        <Col span={24}>
          <Card title="Recent Activity">
            <List
              size="small"
              dataSource={[
                { 
                  time: new Date().toLocaleTimeString(),
                  action: 'System scan completed',
                  status: 'success'
                },
                { 
                  time: new Date(Date.now() - 60000).toLocaleTimeString(),
                  action: 'Ping monitoring updated',
                  status: 'info'
                },
                { 
                  time: new Date(Date.now() - 120000).toLocaleTimeString(),
                  action: 'Port scan initiated',
                  status: 'info'
                }
              ]}
              renderItem={activity => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Text>{activity.action}</Text>
                    <Text type="secondary">{activity.time}</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;