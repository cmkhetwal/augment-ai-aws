import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Tag, List, Typography,
  Input, Select, Button, Space, Switch, Alert, Tooltip, Modal, message, AutoComplete
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

const DashboardEnhanced = ({ data, onRefresh }) => {
  const [sortBy, setSortBy] = useState('usage');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [sortedInstances, setSortedInstances] = useState([]);
  const [filteredInstances, setFilteredInstances] = useState([]);
  const [instanceCounts, setInstanceCounts] = useState({});
  const [debugMode, setDebugMode] = useState(false);
  const [highUsageModalVisible, setHighUsageModalVisible] = useState(false);
  const [securityRiskModalVisible, setSecurityRiskModalVisible] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [instanceDetailsModalVisible, setInstanceDetailsModalVisible] = useState(false);

  const { instances = [], pingResults = {}, systemMetrics = {}, openPorts = {}, stats = {} } = data;

  // Handler functions for clickable cards
  const handleHighUsageClick = () => {
    const highUsageInstances = sortedInstances.filter(instance =>
      instance.hasHighCpu || instance.hasHighMemory
    );

    if (highUsageInstances.length === 0) {
      message.info('No high usage instances found');
      return;
    }

    // Set filters to show only high usage instances
    setShowOnlyProblems(true);
    setSortBy('usage');
    setSearchTerm('');

    // Show modal with details
    setHighUsageModalVisible(true);
  };

  const handleSecurityRiskClick = () => {
    const securityRiskInstances = sortedInstances.filter(instance => instance.securityRisk > 0);

    if (securityRiskInstances.length === 0) {
      message.info('No security risks detected');
      return;
    }

    // Set filters to show only security risk instances
    setShowOnlyProblems(true);
    setSortBy('usage');
    setSearchTerm('');

    // Show modal with details
    setSecurityRiskModalVisible(true);
  };

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
      const problemInstances = filtered.filter(instance => instance.hasProblems);
      console.log('Problem filter applied:', {
        beforeFilter: filtered.length,
        afterFilter: problemInstances.length,
        problemInstances: problemInstances.map(i => ({
          name: i.instanceName,
          hasHighCpu: i.hasHighCpu,
          hasHighMemory: i.hasHighMemory,
          isOffline: i.isOffline,
          securityRisk: i.securityRisk,
          hasProblems: i.hasProblems
        }))
      });
      filtered = problemInstances;
    }

    console.log('Final filtered instances:', filtered.length);
    setFilteredInstances(filtered);
  }, [sortedInstances, searchTerm, showOnlyProblems]);

  // Generate enhanced search suggestions
  const generateSearchSuggestions = (searchValue) => {
    if (!searchValue || searchValue.length < 1) {
      setSearchSuggestions([]);
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const searchTerm = searchValue.trim();
    const suggestionMap = new Map();

    // Enhanced IP matching function
    const matchesIP = (ip, search) => {
      if (!ip) return false;
      const ipParts = ip.split('.');
      const searchParts = search.split('.');

      if (ip.includes(search)) return true;

      if (searchParts.length <= ipParts.length) {
        return searchParts.every((part, index) =>
          ipParts[index] && ipParts[index].startsWith(part)
        );
      }

      return false;
    };

    sortedInstances.forEach(instance => {
      const instanceState = instance.State?.Name || 'unknown';
      const stateColor = instanceState === 'running' ? '#52c41a' : instanceState === 'stopped' ? '#f5222d' : '#faad14';

      // Match instance name
      if (instance.instanceName.toLowerCase().includes(searchLower)) {
        const key = `name_${instance.instanceName}`;
        suggestionMap.set(key, {
          value: instance.instanceName,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{instance.instanceName}</strong> <small style={{ color: '#666' }}>({instance.InstanceId})</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          instance: instance,
          searchType: 'name'
        });
      }

      // Match instance ID
      if (instance.InstanceId.toLowerCase().includes(searchLower)) {
        const key = `id_${instance.InstanceId}`;
        suggestionMap.set(key, {
          value: instance.InstanceId,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{instance.InstanceId}</strong> <small style={{ color: '#666' }}>({instance.instanceName})</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          instance: instance,
          searchType: 'id'
        });
      }

      // Enhanced IP address matching
      if (matchesIP(instance.PublicIpAddress, searchTerm)) {
        const key = `public_ip_${instance.PublicIpAddress}`;
        suggestionMap.set(key, {
          value: instance.PublicIpAddress,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{instance.PublicIpAddress}</strong> <small style={{ color: '#666' }}>Public - {instance.instanceName}</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          instance: instance,
          searchType: 'public_ip'
        });
      }

      if (matchesIP(instance.PrivateIpAddress, searchTerm)) {
        const key = `private_ip_${instance.PrivateIpAddress}`;
        suggestionMap.set(key, {
          value: instance.PrivateIpAddress,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{instance.PrivateIpAddress}</strong> <small style={{ color: '#666' }}>Private - {instance.instanceName}</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          instance: instance,
          searchType: 'private_ip'
        });
      }

      // Match instance type
      if (instance.InstanceType.toLowerCase().includes(searchLower)) {
        const key = `type_${instance.InstanceType}_${instance.InstanceId}`;
        suggestionMap.set(key, {
          value: instance.InstanceType,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{instance.InstanceType}</strong> <small style={{ color: '#666' }}>{instance.instanceName}</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          instance: instance,
          searchType: 'type'
        });
      }

      // Match region
      if (instance.Region && instance.Region.toLowerCase().includes(searchLower)) {
        const key = `region_${instance.Region}_${instance.InstanceId}`;
        suggestionMap.set(key, {
          value: instance.Region,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{instance.Region}</strong> <small style={{ color: '#666' }}>{instance.instanceName}</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          instance: instance,
          searchType: 'region'
        });
      }
    });

    // Convert to array and sort by relevance
    const suggestionArray = Array.from(suggestionMap.values())
      .sort((a, b) => {
        const aRunning = a.instance.State?.Name === 'running' ? 1 : 0;
        const bRunning = b.instance.State?.Name === 'running' ? 1 : 0;
        const aExact = a.value.toLowerCase() === searchLower ? 1 : 0;
        const bExact = b.value.toLowerCase() === searchLower ? 1 : 0;

        return (bExact - aExact) || (bRunning - aRunning);
      })
      .slice(0, 10);

    setSearchSuggestions(suggestionArray);
  };

  // Handle search suggestion selection
  const handleSearchSelect = (value, option) => {
    setSearchTerm(value);

    if (option && option.instance) {
      setSelectedInstance(option.instance);
      setInstanceDetailsModalVisible(true);
    }
  };

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
            onClick={() => {
              if (onRefresh) {
                onRefresh();
              } else {
                window.location.reload();
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
          <Card
            hoverable
            style={{ cursor: 'pointer' }}
            onClick={() => handleHighUsageClick()}
          >
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
              {highUsageCount > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Click to view details
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{ cursor: 'pointer' }}
            onClick={() => handleSecurityRiskClick()}
          >
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
              {highRiskCount > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Click to view details
                  </Text>
                </div>
              )}
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
                <AutoComplete
                  options={searchSuggestions}
                  value={searchTerm}
                  onChange={(value) => {
                    setSearchTerm(value);
                    generateSearchSuggestions(value);
                  }}
                  onSelect={handleSearchSelect}
                  style={{ width: '100%' }}
                  placeholder="Search instances by name, ID, IP, type..."
                >
                  <Input.Search
                    prefix={<SearchOutlined />}
                    allowClear
                    enterButton="Search"
                    onSearch={(value) => {
                      console.log('Dashboard search triggered:', value);
                      setSearchTerm(value);
                    }}
                  />
                </AutoComplete>
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
              dataSource={filteredInstances}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} instances`,
                size: 'small',
                pageSizeOptions: ['5', '10', '20', '50', '100'],
                style: {
                  marginTop: '16px',
                  textAlign: 'center',
                  padding: '8px 0'
                }
              }}
              style={{
                minHeight: '400px',
                border: '1px solid #f0f0f0',
                borderRadius: '6px',
                padding: '8px'
              }}
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

      {/* High Usage Modal */}
      <Modal
        title="High Usage Instances"
        open={highUsageModalVisible}
        onCancel={() => setHighUsageModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHighUsageModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        <List
          dataSource={sortedInstances.filter(instance => instance.hasHighCpu || instance.hasHighMemory)}
          renderItem={instance => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>{instance.instanceName}</Text>
                    <br />
                    <Text type="secondary">{instance.InstanceId} • {instance.InstanceType}</Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {instance.hasHighCpu && (
                      <Tag color="red">CPU: {instance.currentCpu.toFixed(1)}%</Tag>
                    )}
                    {instance.hasHighMemory && (
                      <Tag color="orange">Memory: {instance.currentMemory.toFixed(1)}%</Tag>
                    )}
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
      </Modal>

      {/* Security Risk Modal */}
      <Modal
        title="Security Risk Instances"
        open={securityRiskModalVisible}
        onCancel={() => setSecurityRiskModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSecurityRiskModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        <List
          dataSource={sortedInstances.filter(instance => instance.securityRisk > 0)}
          renderItem={instance => (
            <List.Item>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>{instance.instanceName}</Text>
                    <br />
                    <Text type="secondary">{instance.InstanceId} • {instance.InstanceType}</Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Tag color="red">
                      {instance.securityRisk} High-Risk Port{instance.securityRisk > 1 ? 's' : ''}
                    </Tag>
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
      </Modal>

      {/* Instance Details Modal */}
      <Modal
        title={selectedInstance ? `Instance Details - ${selectedInstance.instanceName}` : 'Instance Details'}
        open={instanceDetailsModalVisible}
        onCancel={() => setInstanceDetailsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setInstanceDetailsModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {selectedInstance && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" title="Basic Information">
                  <p><strong>Instance ID:</strong> {selectedInstance.InstanceId}</p>
                  <p><strong>Name:</strong> {selectedInstance.instanceName}</p>
                  <p><strong>Type:</strong> {selectedInstance.InstanceType}</p>
                  <p><strong>State:</strong>
                    <Tag color={selectedInstance.State?.Name === 'running' ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                      {selectedInstance.State?.Name || 'unknown'}
                    </Tag>
                  </p>
                  <p><strong>Region:</strong> {selectedInstance.Region}</p>
                  <p><strong>Availability Zone:</strong> {selectedInstance.Placement?.AvailabilityZone}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="Network Information">
                  <p><strong>Public IP:</strong> {selectedInstance.PublicIpAddress || 'N/A'}</p>
                  <p><strong>Private IP:</strong> {selectedInstance.PrivateIpAddress || 'N/A'}</p>
                  <p><strong>VPC ID:</strong> {selectedInstance.VpcId || 'N/A'}</p>
                  <p><strong>Subnet ID:</strong> {selectedInstance.SubnetId || 'N/A'}</p>
                  <p><strong>Security Groups:</strong></p>
                  <div style={{ marginLeft: 16 }}>
                    {selectedInstance.SecurityGroups?.map(sg => (
                      <Tag key={sg.GroupId} style={{ marginBottom: 4 }}>
                        {sg.GroupName} ({sg.GroupId})
                      </Tag>
                    )) || 'N/A'}
                  </div>
                </Card>
              </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Card size="small" title="Performance Metrics">
                  <p><strong>CPU Usage:</strong>
                    <span style={{ color: selectedInstance.currentCpu > 80 ? '#f5222d' : '#52c41a', marginLeft: 8 }}>
                      {selectedInstance.currentCpu ? `${selectedInstance.currentCpu.toFixed(1)}%` : 'N/A'}
                    </span>
                  </p>
                  <p><strong>Memory Usage:</strong>
                    <span style={{ color: selectedInstance.currentMemory > 80 ? '#f5222d' : '#52c41a', marginLeft: 8 }}>
                      {selectedInstance.currentMemory ? `${selectedInstance.currentMemory.toFixed(1)}%` : 'N/A'}
                    </span>
                  </p>
                  <p><strong>Ping Status:</strong>
                    <Tag color={selectedInstance.isOnline ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                      {selectedInstance.isOnline ? 'Online' : 'Offline'}
                    </Tag>
                  </p>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="Tags">
                  <div>
                    {selectedInstance.Tags?.map(tag => (
                      <Tag key={tag.Key} style={{ marginBottom: 4 }}>
                        <strong>{tag.Key}:</strong> {tag.Value}
                      </Tag>
                    )) || 'No tags'}
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DashboardEnhanced;