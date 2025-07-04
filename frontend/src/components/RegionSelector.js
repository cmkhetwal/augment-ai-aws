import React, { useState, useEffect } from 'react';
import { 
  Select, Tag, Space, Typography, Button, Card, Row, Col, 
  Statistic, Tooltip, Alert, Spin 
} from 'antd';
import { 
  GlobalOutlined, 
  ReloadOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { Text, Title } = Typography;

const RegionSelector = ({ selectedRegion, onRegionChange, instanceCounts = {} }) => {
  const [regionStats, setRegionStats] = useState({
    totalRegions: 0,
    enabledRegions: [],
    regionClients: 0,
    lastRegionDetection: null
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load region statistics
  useEffect(() => {
    loadRegionStats();
  }, []);

  const loadRegionStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/regions');
      const data = await response.json();
      setRegionStats(data);
    } catch (error) {
      console.error('Error loading region stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshRegions = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/regions/refresh', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await loadRegionStats();
        // You might want to show a success message here
        console.log('Regions refreshed:', data.message);
      }
    } catch (error) {
      console.error('Error refreshing regions:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getRegionDisplayName = (region) => {
    const regionNames = {
      'us-east-1': 'US East (N. Virginia)',
      'us-east-2': 'US East (Ohio)',
      'us-west-1': 'US West (N. California)',
      'us-west-2': 'US West (Oregon)',
      'eu-west-1': 'Europe (Ireland)',
      'eu-west-2': 'Europe (London)',
      'eu-west-3': 'Europe (Paris)',
      'eu-central-1': 'Europe (Frankfurt)',
      'eu-north-1': 'Europe (Stockholm)',
      'ap-southeast-1': 'Asia Pacific (Singapore)',
      'ap-southeast-2': 'Asia Pacific (Sydney)',
      'ap-northeast-1': 'Asia Pacific (Tokyo)',
      'ap-northeast-2': 'Asia Pacific (Seoul)',
      'ap-south-1': 'Asia Pacific (Mumbai)',
      'ca-central-1': 'Canada (Central)',
      'sa-east-1': 'South America (São Paulo)'
    };
    return regionNames[region] || region;
  };

  const getTotalInstances = () => {
    return Object.values(instanceCounts).reduce((total, count) => total + count, 0);
  };

  if (loading) {
    return (
      <Card size="small">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '8px' }}>
            <Text type="secondary">Loading regions...</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            <GlobalOutlined style={{ marginRight: '8px' }} />
            Region Selection
          </span>
          <Button 
            type="text" 
            icon={<ReloadOutlined />}
            onClick={refreshRegions}
            loading={refreshing}
            size="small"
          >
            Refresh Regions
          </Button>
        </div>
      } size="small">
        
        {/* Region Stats Overview */}
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={8}>
            <Statistic
              title="Active Regions"
              value={regionStats.totalRegions}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: '18px' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Total Instances"
              value={getTotalInstances()}
              prefix={<GlobalOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ fontSize: '18px' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Regions with Instances"
              value={Object.keys(instanceCounts).length}
              prefix={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ fontSize: '18px' }}
            />
          </Col>
        </Row>

        {/* Region Selector */}
        <div style={{ marginBottom: '16px' }}>
          <Text strong style={{ marginBottom: '8px', display: 'block' }}>
            Select Region to Monitor:
          </Text>
          <Select
            value={selectedRegion}
            onChange={onRegionChange}
            style={{ width: '100%' }}
            placeholder="Select a region or view all"
            allowClear
            showSearch
            optionFilterProp="children"
          >
            <Option value="all">
              <Space>
                <GlobalOutlined />
                All Regions ({getTotalInstances()} instances)
              </Space>
            </Option>
            {regionStats.enabledRegions.map(region => (
              <Option key={region} value={region}>
                <Space>
                  <Text>{getRegionDisplayName(region)}</Text>
                  <Tag color="blue" size="small">
                    {instanceCounts[region] || 0} instances
                  </Tag>
                </Space>
              </Option>
            ))}
          </Select>
        </div>

        {/* Active Regions Display */}
        {regionStats.enabledRegions.length > 0 && (
          <div>
            <Text strong style={{ marginBottom: '8px', display: 'block' }}>
              Active Regions:
            </Text>
            <Space size={[4, 8]} wrap>
              {regionStats.enabledRegions.map(region => (
                <Tooltip key={region} title={getRegionDisplayName(region)}>
                  <Tag 
                    color={selectedRegion === region ? 'blue' : 'default'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onRegionChange(region)}
                  >
                    {region}
                    {instanceCounts[region] && (
                      <span style={{ marginLeft: '4px' }}>
                        ({instanceCounts[region]})
                      </span>
                    )}
                  </Tag>
                </Tooltip>
              ))}
            </Space>
          </div>
        )}

        {/* Last Detection Time */}
        {regionStats.lastRegionDetection && (
          <div style={{ marginTop: '12px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Last region detection: {new Date(regionStats.lastRegionDetection).toLocaleString()}
            </Text>
          </div>
        )}

        {/* No Regions Warning */}
        {regionStats.enabledRegions.length === 0 && (
          <Alert
            message="No Active Regions Detected"
            description="No regions with EC2 instances were found. This might be due to permissions or all instances being in regions that require opt-in."
            type="warning"
            showIcon
            style={{ marginTop: '16px' }}
            action={
              <Button size="small" onClick={refreshRegions} loading={refreshing}>
                Retry Detection
              </Button>
            }
          />
        )}
      </Card>

      {/* Region Distribution Chart (if you want to add it later) */}
      {Object.keys(instanceCounts).length > 1 && (
        <Card title="Instance Distribution by Region" size="small" style={{ marginTop: '16px' }}>
          <Row gutter={8}>
            {Object.entries(instanceCounts)
              .sort(([,a], [,b]) => b - a)
              .map(([region, count]) => (
                <Col key={region} span={12} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: '12px' }}>{region}</Text>
                    <Tag color="blue" size="small">{count}</Tag>
                  </div>
                </Col>
              ))}
          </Row>
        </Card>
      )}
    </div>
  );
};

export default RegionSelector;