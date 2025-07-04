import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Statistic, Progress, Tag, List, Typography, 
  Input, Select, Button, Space, Switch, Alert, Tooltip
} from 'antd';
import { 
  CloudServerOutlined, 
  WifiOutlined, 
  BarChartOutlined, 
  SecurityScanOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  ReloadOutlined,
  SettingOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import RegionSelector from '../components/RegionSelector';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const DashboardEnhanced = ({ data }) => {
  const [sortBy, setSortBy] = useState('usage');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [sortedInstances, setSortedInstances] = useState([]);
  const [filteredInstances, setFilteredInstances] = useState([]);
  const [instanceCounts, setInstanceCounts] = useState({});
  const [debugMode, setDebugMode] = useState(false);

  const { instances = [], pingResults = {}, systemMetrics = {}, openPorts = {}, stats = {} } = data;

  // Debug logging
  useEffect(() => {
    console.log('DashboardEnhanced received data:', {
      instancesCount: instances.length,
      instances: instances.map(i => ({ name: i.Name, region: i.Region, id: i.InstanceId })),
      selectedRegion,
      sortBy
    });
  }, [instances, selectedRegion, sortBy]);

  // Calculate instance counts by region
  useEffect(() => {
    if (!instances.length) return;
    
    const counts = {};
    instances.forEach(instance => {
      const region = instance.Region || 'unknown';
      counts[region] = (counts[region] || 0) + 1;
    });
    setInstanceCounts(counts);
  }, [instances]);

  // Enhanced instance processing with sorting and filtering
  useEffect(() => {
    if (!instances.length) return;

    // Filter by region first
    let regionFilteredInstances = instances;
    if (selectedRegion !== 'all') {
      regionFilteredInstances = instances.filter(instance => instance.Region === selectedRegion);
    }

    // Enrich instances with current metrics
    const enrichedInstances = regionFilteredInstances.map(instance => {
      const metrics = systemMetrics[instance.InstanceId];
      const pingResult = pingResults[instance.InstanceId];
      const portData = openPorts[instance.InstanceId];
      
      const currentCpu = parseFloat(metrics?.cpu?.current || 0);
      const currentMemory = parseFloat(metrics?.memory?.current || 0);
      const isOnline = pingResult?.alive || false;
      const hasHighCpu = currentCpu > 80;
      const hasHighMemory = currentMemory > 80;
      const isOffline = !isOnline && instance.State.Name === 'running';
      
      // Calculate risk score based on high-risk ports
      let securityRisk = 0;
      if (portData?.ports?.openPorts) {
        const highRiskPorts = portData.ports.openPorts.filter(port => 
          [21, 23, 135, 139, 445, 1433, 3389].includes(port.port)
        );
        securityRisk = highRiskPorts.length;
      }

      return {
        ...instance,
        instanceName: instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId,
        currentCpu,
        currentMemory,
        isOnline,
        hasHighCpu,
        hasHighMemory,
        isOffline,
        securityRisk,
        usageScore: (currentCpu + currentMemory) / 2,
        problemScore: (hasHighCpu ? 40 : 0) + (hasHighMemory ? 40 : 0) + (isOffline ? 50 : 0) + (securityRisk * 10),
        hasProblems: hasHighCpu || hasHighMemory || isOffline || securityRisk > 0
      };
    });

    // Sort instances
    let sorted = [...enrichedInstances];
    switch (sortBy) {
      case 'usage':
        sorted.sort((a, b) => {
          if (a.hasProblems && !b.hasProblems) return -1;
          if (!a.hasProblems && b.hasProblems) return 1;
          return b.problemScore - a.problemScore || b.usageScore - a.usageScore;
        });
        break;
      case 'cpu':
        sorted.sort((a, b) => b.currentCpu - a.currentCpu);
        break;
      case 'memory':
        sorted.sort((a, b) => b.currentMemory - a.currentMemory);
        break;
      case 'name':
        sorted.sort((a, b) => a.instanceName.localeCompare(b.instanceName));
        break;
      case 'state':
        sorted.sort((a, b) => {
          if (a.State.Name === 'running' && b.State.Name !== 'running') return -1;
          if (a.State.Name !== 'running' && b.State.Name === 'running') return 1;
          return a.instanceName.localeCompare(b.instanceName);
        });
        break;
      default:
        break;
    }

    setSortedInstances(sorted);
  }, [instances, systemMetrics, pingResults, openPorts, sortBy, selectedRegion]);

  // Filter instances based on search and problem filter
  useEffect(() => {
    let filtered = sortedInstances;

    console.log('Filtering instances:', {
      sortedCount: sortedInstances.length,
      searchTerm,
      showOnlyProblems,
      selectedRegion
    });

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(instance =>
        instance.instanceName.toLowerCase().includes(searchLower) ||
        instance.InstanceId.toLowerCase().includes(searchLower) ||
        instance.InstanceType.toLowerCase().includes(searchLower) ||
        (instance.PublicIpAddress && instance.PublicIpAddress.includes(searchLower)) ||
        (instance.PrivateIpAddress && instance.PrivateIpAddress.includes(searchLower))
      );
    }

    // Apply problem filter
    if (showOnlyProblems) {
      filtered = filtered.filter(instance => instance.hasProblems);
    }

    console.log('Final filtered instances:', filtered.length);
    setFilteredInstances(filtered);
  }, [sortedInstances, searchTerm, showOnlyProblems]);

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

  const getHighUsageInstances = () => {
    return sortedInstances.filter(instance => 
      instance.hasHighCpu || instance.hasHighMemory
    ).length;
  };

  const getHighRiskInstances = () => {
    return sortedInstances.filter(instance => instance.securityRisk > 0).length;
  };

  const instanceStats = getInstanceStats();
  const pingStats = getPingStats();
  const highUsageCount = getHighUsageInstances();
  const highRiskCount = getHighRiskInstances();

  const getInstanceIcon = (instance) => {
    if (instance.isOffline) return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
    if (instance.hasHighCpu || instance.hasHighMemory) return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
    if (instance.isOnline) return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    return <ExclamationCircleOutlined style={{ color: '#d9d9d9' }} />;
  };

  const getInstanceTags = (instance) => {
    const tags = [];
    
    // Region tag (always show)
    if (instance.Region) {
      tags.push(
        <Tag key="region" color="geekblue">
          {instance.Region}
        </Tag>
      );
    }
    
    // State tag
    tags.push(
      <Tag key="state" color={instance.State.Name === 'running' ? 'green' : 'orange'}>
        {instance.State.Name}
      </Tag>
    );

    // Online/Offline tag
    if (instance.State.Name === 'running') {
      tags.push(
        <Tag key="ping" color={instance.isOnline ? 'green' : 'red'}>
          {instance.isOnline ? 'Online' : 'Offline'}
        </Tag>
      );
    }

    // High CPU tag
    if (instance.hasHighCpu) {
      tags.push(
        <Tag key="cpu" color="red">
          High CPU: {instance.currentCpu.toFixed(1)}%
        </Tag>
      );
    }

    // High Memory tag
    if (instance.hasHighMemory) {
      tags.push(
        <Tag key="memory" color="orange">
          High Memory: {instance.currentMemory.toFixed(1)}%
        </Tag>
      );
    }

    // Security risk tag
    if (instance.securityRisk > 0) {
      tags.push(
        <Tag key="security" color="red">
          Security Risk
        </Tag>
      );
    }

    return tags;
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>Enhanced Dashboard</Title>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={async () => {
              try {
                const response = await fetch('/api/dashboard');
                const data = await response.json();
                console.log('Manual refresh - loaded instances:', data.instances?.length);
                window.location.reload();
              } catch (error) {
                console.error('Manual refresh failed:', error);
              }
            }}
          >
            Refresh
          </Button>
          <Button 
            icon={<SettingOutlined />}
            onClick={() => setDebugMode(!debugMode)}
          >
            {debugMode ? 'Hide Debug' : 'Debug Mode'}
          </Button>
        </Space>
      </div>

      {/* Debug Panel */}
      {debugMode && (
        <Alert
          message="Debug Information"
          description={
            <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              <div><strong>Raw instances received:</strong> {instances.length}</div>
              <div><strong>Instances by region:</strong></div>
              {Object.entries(instanceCounts).map(([region, count]) => (
                <div key={region}>  • {region}: {count} instances</div>
              ))}
              <div><strong>Selected region:</strong> {selectedRegion}</div>
              <div><strong>Filtered instances shown:</strong> {filteredInstances.length}</div>
              <div><strong>Search term:</strong> "{searchTerm}"</div>
              <div><strong>Show only problems:</strong> {showOnlyProblems ? 'Yes' : 'No'}</div>
              <div><strong>Sort by:</strong> {sortBy}</div>
              <div style={{ marginTop: '10px' }}>
                <strong>Instance Details:</strong>
                {instances.map(instance => (
                  <div key={instance.InstanceId}>
                    {instance.Name} ({instance.InstanceId}) - {instance.Region}
                  </div>
                ))}
              </div>
            </div>
          }
          type="info"
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Enhanced Stats Cards */}
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
              title="Network Status"
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
              title="High Usage Alerts"
              value={highUsageCount}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: highUsageCount > 0 ? '#f5222d' : '#52c41a' }}
            />
            <div style={{ marginTop: '16px' }}>
              <Text type={highUsageCount > 0 ? 'danger' : 'success'}>
                {highUsageCount > 0 ? 'Action Required' : 'All Normal'}
              </Text>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Security Risks"
              value={highRiskCount}
              prefix={<SecurityScanOutlined />}
              valueStyle={{ color: highRiskCount > 0 ? '#f5222d' : '#52c41a' }}
            />
            <div style={{ marginTop: '16px' }}>
              <Text type={highRiskCount > 0 ? 'danger' : 'success'}>
                {highRiskCount > 0 ? 'High Risk Ports' : 'No Risks Detected'}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Region Selector */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={8}>
          <RegionSelector
            selectedRegion={selectedRegion}
            onRegionChange={setSelectedRegion}
            instanceCounts={instanceCounts}
          />
        </Col>
        <Col xs={24} lg={16}>
          {/* Search and Filter Controls */}
          <Card>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} md={10}>
                <Search
                  placeholder="Search instances..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  prefix={<SearchOutlined />}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  style={{ width: '100%' }}
                  placeholder="Sort by"
                >
                  <Option value="usage">High Usage First</Option>
                  <Option value="cpu">CPU Usage</Option>
                  <Option value="memory">Memory Usage</Option>
                  <Option value="name">Name</Option>
                  <Option value="state">State</Option>
                  <Option value="region">Region</Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Space>
                  <Text>Problems only:</Text>
                  <Switch
                    checked={showOnlyProblems}
                    onChange={setShowOnlyProblems}
                    checkedChildren="Yes"
                    unCheckedChildren="All"
                  />
                </Space>
              </Col>
              <Col xs={24} sm={12} md={3}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {filteredInstances.length} of {instances.length}
                </Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Priority Alerts */}
      {(highUsageCount > 0 || highRiskCount > 0) && (
        <Alert
          message="Priority Issues Detected"
          description={
            <div>
              {highUsageCount > 0 && <Text>• {highUsageCount} instances with high resource usage</Text>}
              {highUsageCount > 0 && highRiskCount > 0 && <br />}
              {highRiskCount > 0 && <Text>• {highRiskCount} instances with security risks</Text>}
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Enhanced Instance List */}
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Instance Status</span>
                <Space>
                  {sortBy === 'usage' && <SortDescendingOutlined />}
                  <Text type="secondary">Sorted by {sortBy}</Text>
                </Space>
              </div>
            }
            size="small"
          >
            <List
              size="small"
              dataSource={filteredInstances.slice(0, 20)} // Show top 20
              renderItem={instance => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      {getInstanceIcon(instance)}
                      <div style={{ marginLeft: '12px', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                          <Text strong>{instance.instanceName}</Text>
                          <Text type="secondary" style={{ marginLeft: '8px' }}>
                            ({instance.InstanceId})
                          </Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Text type="secondary">{instance.InstanceType}</Text>
                          {instance.currentCpu > 0 && (
                            <Tooltip title="CPU Usage">
                              <Text type="secondary">CPU: {instance.currentCpu.toFixed(1)}%</Text>
                            </Tooltip>
                          )}
                          {instance.currentMemory > 0 && (
                            <Tooltip title="Memory Usage">
                              <Text type="secondary">RAM: {instance.currentMemory.toFixed(1)}%</Text>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {getInstanceTags(instance)}
                    </div>
                  </div>
                </List.Item>
              )}
            />
            {filteredInstances.length > 20 && (
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Text type="secondary">
                  Showing first 20 of {filteredInstances.length} instances
                </Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Last Update Info */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Text type="secondary">
          Last updated: {stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleString() : 'Never'} 
          {' • '}
          Auto-refresh enabled
        </Text>
      </div>
    </div>
  );
};

export default DashboardEnhanced;