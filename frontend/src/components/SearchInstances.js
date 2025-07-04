import React, { useState, useEffect } from 'react';
import { 
  Input, Card, List, Typography, Tag, Empty, Spin, Button, Space,
  Tooltip, Row, Col
} from 'antd';
import { 
  SearchOutlined, 
  CloudServerOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';

const { Search } = Input;
const { Text, Title } = Typography;

const SearchInstances = ({ onInstanceSelect, showMetrics = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  // Save search history to localStorage
  const saveSearchHistory = (term) => {
    if (!term.trim()) return;
    
    const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  // Perform search
  const performSearch = async (searchValue) => {
    if (!searchValue || searchValue.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchValue)}&type=instances`);
      const data = await response.json();
      
      if (data.results) {
        setSearchResults(data.results);
        saveSearchHistory(searchValue);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search input change with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const getInstanceIcon = (result) => {
    if (result.isOnline === false) {
      return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
    }
    if (result.metrics && (result.metrics.cpu > 80 || result.metrics.memory > 80)) {
      return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
    }
    if (result.isOnline === true) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
    return <CloudServerOutlined style={{ color: '#d9d9d9' }} />;
  };

  const getInstanceTags = (result) => {
    const tags = [];
    
    if (result.isOnline === true) {
      tags.push(<Tag key="online" color="green">Online</Tag>);
    } else if (result.isOnline === false) {
      tags.push(<Tag key="offline" color="red">Offline</Tag>);
    }

    if (result.metrics) {
      if (result.metrics.cpu > 80) {
        tags.push(<Tag key="cpu" color="red">High CPU</Tag>);
      }
      if (result.metrics.memory > 80) {
        tags.push(<Tag key="memory" color="orange">High Memory</Tag>);
      }
    }

    return tags;
  };

  const formatInstanceDetails = (result) => {
    const details = [result.details];
    
    if (showMetrics && result.metrics) {
      const metricParts = [];
      if (result.metrics.cpu !== undefined) {
        metricParts.push(`CPU: ${result.metrics.cpu.toFixed(1)}%`);
      }
      if (result.metrics.memory !== undefined) {
        metricParts.push(`RAM: ${result.metrics.memory.toFixed(1)}%`);
      }
      
      if (metricParts.length > 0) {
        details.push(metricParts.join(' | '));
      }
    }
    
    return details.join(' • ');
  };

  const handleInstanceClick = (result) => {
    if (onInstanceSelect) {
      onInstanceSelect(result);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleHistoryClick = (term) => {
    setSearchTerm(term);
  };

  return (
    <div style={{ width: '100%' }}>
      <Card title="Search Instances" size="small">
        <Search
          placeholder="Search by name, ID, type, or IP address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onSearch={(value) => performSearch(value)}
          prefix={<SearchOutlined />}
          allowClear
          size="large"
          loading={loading}
        />

        {/* Search History */}
        {!searchTerm && searchHistory.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>Recent searches:</Text>
            <div style={{ marginTop: '8px' }}>
              <Space wrap>
                {searchHistory.map((term, index) => (
                  <Button
                    key={index}
                    type="link"
                    size="small"
                    onClick={() => handleHistoryClick(term)}
                    style={{ padding: '2px 8px', height: 'auto' }}
                  >
                    {term}
                  </Button>
                ))}
              </Space>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '8px' }}>
              <Text type="secondary">Searching...</Text>
            </div>
          </div>
        )}

        {/* Search Results */}
        {!loading && searchTerm && (
          <div style={{ marginTop: '16px' }}>
            {searchResults.length > 0 ? (
              <>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>Found {searchResults.length} instance{searchResults.length !== 1 ? 's' : ''}</Text>
                  <Button type="link" size="small" onClick={clearSearch}>
                    Clear
                  </Button>
                </div>
                <List
                  size="small"
                  dataSource={searchResults}
                  renderItem={result => (
                    <List.Item
                      style={{ 
                        cursor: onInstanceSelect ? 'pointer' : 'default',
                        padding: '12px',
                        border: '1px solid #f0f0f0',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        background: '#fafafa'
                      }}
                      onClick={() => handleInstanceClick(result)}
                    >
                      <Row style={{ width: '100%' }} align="middle">
                        <Col flex="none">
                          {getInstanceIcon(result)}
                        </Col>
                        <Col flex="auto" style={{ marginLeft: '12px' }}>
                          <div>
                            <Text strong>{result.name}</Text>
                            {result.id !== result.name && (
                              <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                                ({result.id})
                              </Text>
                            )}
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {formatInstanceDetails(result)}
                            </Text>
                          </div>
                        </Col>
                        <Col flex="none">
                          <Space size={4}>
                            {getInstanceTags(result)}
                          </Space>
                        </Col>
                      </Row>
                    </List.Item>
                  )}
                />
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text type="secondary">No instances found matching "{searchTerm}"</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Try searching by instance name, ID, type, or IP address
                    </Text>
                  </div>
                }
              />
            )}
          </div>
        )}

        {/* Help Text */}
        {!searchTerm && !loading && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              💡 Search by instance name, ID, type, or IP address. Minimum 2 characters required.
            </Text>
          </div>
        )}
      </Card>

      {/* Quick Stats */}
      {searchResults.length > 0 && (
        <Card size="small" style={{ marginTop: '16px' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: '12px' }}>Online</Text>
              <br />
              <Text strong style={{ color: '#52c41a' }}>
                {searchResults.filter(r => r.isOnline === true).length}
              </Text>
            </Col>
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: '12px' }}>High Usage</Text>
              <br />
              <Text strong style={{ color: '#faad14' }}>
                {searchResults.filter(r => r.metrics && (r.metrics.cpu > 80 || r.metrics.memory > 80)).length}
              </Text>
            </Col>
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: '12px' }}>Offline</Text>
              <br />
              <Text strong style={{ color: '#f5222d' }}>
                {searchResults.filter(r => r.isOnline === false).length}
              </Text>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default SearchInstances;