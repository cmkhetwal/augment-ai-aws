import React from 'react';
import { Row, Col, Card, Typography, Tag, List, Badge, Tooltip, Alert } from 'antd';
import { 
  SecurityScanOutlined, 
  WarningOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Title, Text } = Typography;

const PortScanner = ({ data }) => {
  const { instances, openPorts } = data;

  const getRiskColor = (port) => {
    const highRiskPorts = [21, 23, 135, 139, 445, 1433, 3389];
    const mediumRiskPorts = [22, 25, 53, 110, 143, 993, 995];
    const lowRiskPorts = [80, 443, 8080, 8443];

    if (highRiskPorts.includes(port)) return 'red';
    if (mediumRiskPorts.includes(port)) return 'orange';
    if (lowRiskPorts.includes(port)) return 'green';
    return 'blue';
  };

  const getRiskLevel = (port) => {
    const highRiskPorts = [21, 23, 135, 139, 445, 1433, 3389];
    const mediumRiskPorts = [22, 25, 53, 110, 143, 993, 995];
    const lowRiskPorts = [80, 443, 8080, 8443];

    if (highRiskPorts.includes(port)) return 'HIGH';
    if (mediumRiskPorts.includes(port)) return 'MEDIUM';
    if (lowRiskPorts.includes(port)) return 'LOW';
    return 'UNKNOWN';
  };

  const getServiceName = (port) => {
    const serviceMap = {
      21: 'FTP',
      22: 'SSH',
      23: 'Telnet',
      25: 'SMTP',
      53: 'DNS',
      80: 'HTTP',
      110: 'POP3',
      135: 'RPC',
      139: 'NetBIOS',
      143: 'IMAP',
      443: 'HTTPS',
      993: 'IMAPS',
      995: 'POP3S',
      1433: 'SQL Server',
      3306: 'MySQL',
      3389: 'RDP',
      5432: 'PostgreSQL',
      5984: 'CouchDB',
      6379: 'Redis',
      8080: 'HTTP Alt',
      8443: 'HTTPS Alt',
      9200: 'Elasticsearch',
      27017: 'MongoDB'
    };
    return serviceMap[port] || 'Unknown';
  };

  const getOverallRiskAssessment = () => {
    let totalPorts = 0;
    let highRisk = 0;
    let mediumRisk = 0;
    let lowRisk = 0;

    Object.values(openPorts).forEach(portData => {
      if (portData.ports && portData.ports.openPorts) {
        portData.ports.openPorts.forEach(port => {
          totalPorts++;
          const risk = getRiskLevel(port.port);
          if (risk === 'HIGH') highRisk++;
          else if (risk === 'MEDIUM') mediumRisk++;
          else if (risk === 'LOW') lowRisk++;
        });
      }
    });

    return { totalPorts, highRisk, mediumRisk, lowRisk };
  };

  const riskAssessment = getOverallRiskAssessment();

  const getSecurityRecommendations = (ports) => {
    const recommendations = [];
    
    if (ports.some(p => p.port === 22)) {
      recommendations.push({
        type: 'warning',
        message: 'SSH (Port 22) is open. Ensure strong authentication and consider key-based authentication.'
      });
    }
    
    if (ports.some(p => p.port === 3389)) {
      recommendations.push({
        type: 'error',
        message: 'RDP (Port 3389) is open. Consider using VPN or restricting access by IP.'
      });
    }
    
    if (ports.some(p => [21, 23].includes(p.port))) {
      recommendations.push({
        type: 'error',
        message: 'Insecure protocols (FTP/Telnet) detected. Consider using secure alternatives.'
      });
    }
    
    if (ports.some(p => [1433, 3306, 5432, 27017].includes(p.port))) {
      recommendations.push({
        type: 'warning',
        message: 'Database ports are exposed. Ensure proper firewall rules and authentication.'
      });
    }

    return recommendations;
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Port Scanner Results</Title>

      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5222d' }}>
                {riskAssessment.highRisk}
              </div>
              <div style={{ color: '#666', marginTop: '4px' }}>High Risk Ports</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                {riskAssessment.mediumRisk}
              </div>
              <div style={{ color: '#666', marginTop: '4px' }}>Medium Risk Ports</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {riskAssessment.lowRisk}
              </div>
              <div style={{ color: '#666', marginTop: '4px' }}>Low Risk Ports</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                {riskAssessment.totalPorts}
              </div>
              <div style={{ color: '#666', marginTop: '4px' }}>Total Open Ports</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {Object.entries(openPorts).map(([instanceId, portData]) => {
          const instance = instances.find(i => i.InstanceId === instanceId);
          const instanceName = portData.instanceName || instanceId;
          const ports = portData.ports?.openPorts || [];
          const recommendations = getSecurityRecommendations(ports);

          return (
            <Col xs={24} lg={12} key={instanceId}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <SecurityScanOutlined style={{ marginRight: '8px' }} />
                      <Text strong>{instanceName}</Text>
                    </div>
                    <div>
                      <Badge count={ports.length} style={{ backgroundColor: '#1890ff' }} />
                      <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                        {moment(portData.timestamp).format('HH:mm:ss')}
                      </Text>
                    </div>
                  </div>
                }
                size="small"
              >
                <div style={{ marginBottom: '16px' }}>
                  <Text type="secondary">IP Address: </Text>
                  <Text code>{portData.ipAddress}</Text>
                </div>

                {ports.length > 0 ? (
                  <div>
                    <List
                      size="small"
                      dataSource={ports}
                      renderItem={port => (
                        <List.Item style={{ padding: '8px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <Text strong style={{ marginRight: '8px' }}>
                                {port.port}
                              </Text>
                              <Text type="secondary">
                                {getServiceName(port.port)}
                              </Text>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <Tag color={getRiskColor(port.port)}>
                                {getRiskLevel(port.port)}
                              </Tag>
                              {getRiskLevel(port.port) === 'HIGH' && (
                                <Tooltip title="High security risk">
                                  <WarningOutlined style={{ color: '#f5222d', marginLeft: '4px' }} />
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </List.Item>
                      )}
                    />

                    {recommendations.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <Title level={5}>Security Recommendations</Title>
                        {recommendations.map((rec, index) => (
                          <Alert
                            key={index}
                            message={rec.message}
                            type={rec.type}
                            showIcon
                            style={{ marginBottom: '8px' }}
                            size="small"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
                    <div>
                      <Text type="success">No open ports detected</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        All common ports appear to be closed or filtered
                      </Text>
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {Object.keys(openPorts).length === 0 && (
        <Card style={{ textAlign: 'center', padding: '40px' }}>
          <SecurityScanOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <Title level={4} type="secondary">No port scan data available</Title>
          <Text type="secondary">
            Port scanning will start automatically for running instances
          </Text>
        </Card>
      )}

      {riskAssessment.totalPorts > 0 && (
        <Card style={{ marginTop: '24px' }} title="Security Summary">
          <Row gutter={16}>
            <Col span={24}>
              {riskAssessment.highRisk > 0 && (
                <Alert
                  message="High Security Risk Detected"
                  description={`${riskAssessment.highRisk} high-risk ports are open. Immediate attention recommended.`}
                  type="error"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              )}
              {riskAssessment.mediumRisk > 0 && (
                <Alert
                  message="Medium Security Risk"
                  description={`${riskAssessment.mediumRisk} medium-risk ports detected. Review security configurations.`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              )}
              {riskAssessment.highRisk === 0 && riskAssessment.mediumRisk === 0 && (
                <Alert
                  message="Good Security Posture"
                  description="No high or medium risk ports detected. Continue monitoring."
                  type="success"
                  showIcon
                />
              )}
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default PortScanner;