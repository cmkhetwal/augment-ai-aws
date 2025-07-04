import React from 'react';
import { Row, Col, Card, Typography, Tag, Progress, List, Statistic } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WifiOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Title, Text } = Typography;

const PingMonitor = ({ data }) => {
  const { instances, pingResults } = data;

  const getPingStats = () => {
    const results = Object.values(pingResults);
    const online = results.filter(r => r.alive).length;
    const offline = results.filter(r => !r.alive).length;
    const total = results.length;
    const avgResponseTime = results.filter(r => r.alive && r.avg)
      .reduce((sum, r) => sum + parseFloat(r.avg), 0) / Math.max(1, results.filter(r => r.alive && r.avg).length);
    
    return { online, offline, total, avgResponseTime };
  };

  const stats = getPingStats();

  const getPingQuality = (time) => {
    if (!time || time === 'unknown') return 'unknown';
    const t = parseFloat(time);
    if (t < 50) return 'excellent';
    if (t < 100) return 'good';
    if (t < 200) return 'fair';
    if (t < 500) return 'poor';
    return 'very poor';
  };

  const getQualityColor = (quality) => {
    const colors = {
      excellent: '#52c41a',
      good: '#73d13d',
      fair: '#fadb14',
      poor: '#ff7a45',
      'very poor': '#f5222d',
      unknown: '#d9d9d9'
    };
    return colors[quality] || '#d9d9d9';
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Ping Monitoring</Title>

      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Online Instances"
              value={stats.online}
              suffix={`/ ${stats.total}`}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Offline Instances"
              value={stats.offline}
              prefix={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: stats.offline > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Uptime"
              value={stats.total > 0 ? ((stats.online / stats.total) * 100).toFixed(1) : 0}
              suffix="%"
              prefix={<WifiOutlined />}
              valueStyle={{ color: stats.online === stats.total ? '#52c41a' : '#faad14' }}
            />
            <Progress 
              percent={stats.total > 0 ? (stats.online / stats.total) * 100 : 0}
              size="small"
              style={{ marginTop: '8px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Avg Response"
              value={stats.avgResponseTime.toFixed(1)}
              suffix="ms"
              valueStyle={{ 
                color: stats.avgResponseTime < 100 ? '#52c41a' : 
                       stats.avgResponseTime < 200 ? '#faad14' : '#f5222d'
              }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {Object.entries(pingResults).map(([instanceId, pingResult]) => {
          const instance = instances.find(i => i.InstanceId === instanceId);
          const instanceName = pingResult.instanceName || instanceId;
          const quality = getPingQuality(pingResult.avg);
          
          return (
            <Col xs={24} md={12} lg={8} key={instanceId}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text strong>{instanceName}</Text>
                    <Tag color={pingResult.alive ? 'green' : 'red'}>
                      {pingResult.alive ? 'Online' : 'Offline'}
                    </Tag>
                  </div>
                }
                size="small"
                style={{ 
                  borderLeft: `4px solid ${pingResult.alive ? '#52c41a' : '#f5222d'}` 
                }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <div>
                        <Text type="secondary">Host:</Text>
                        <br />
                        <Text code>{pingResult.host}</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div>
                        <Text type="secondary">Last Check:</Text>
                        <br />
                        <Text>{moment(pingResult.timestamp).format('HH:mm:ss')}</Text>
                      </div>
                    </Col>
                  </Row>
                </div>

                {pingResult.alive ? (
                  <div>
                    <Row gutter={16} style={{ marginBottom: '12px' }}>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
                            {pingResult.avg || 'N/A'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>Avg (ms)</div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                            {pingResult.min || 'N/A'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>Min (ms)</div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f5222d' }}>
                            {pingResult.max || 'N/A'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>Max (ms)</div>
                        </div>
                      </Col>
                    </Row>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <Text type="secondary">Quality: </Text>
                      <Tag color={getQualityColor(quality)}>{quality.toUpperCase()}</Tag>
                    </div>
                    
                    {pingResult.packetLoss !== undefined && (
                      <div>
                        <Text type="secondary">Packet Loss: </Text>
                        <Text style={{ color: pingResult.packetLoss > 0 ? '#f5222d' : '#52c41a' }}>
                          {pingResult.packetLoss}%
                        </Text>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <CloseCircleOutlined style={{ fontSize: '24px', color: '#f5222d', marginBottom: '8px' }} />
                    <div>
                      <Text type="danger">Instance is unreachable</Text>
                      {pingResult.error && (
                        <div style={{ marginTop: '8px' }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Error: {pingResult.error}
                          </Text>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {Object.keys(pingResults).length === 0 && (
        <Card style={{ textAlign: 'center', padding: '40px' }}>
          <WifiOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <Title level={4} type="secondary">No ping data available</Title>
          <Text type="secondary">
            Ping monitoring will start automatically once instances are detected
          </Text>
        </Card>
      )}
    </div>
  );
};

export default PingMonitor;