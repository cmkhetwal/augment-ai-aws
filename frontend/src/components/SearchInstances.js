import React, { useState, useEffect } from 'react';
import {
  Input, Card, List, Typography, Tag, Empty, Spin, Button, Space,
  Tooltip, Row, Col, AutoComplete
} from 'antd';
import {
  SearchOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { API_ENDPOINTS } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

const { Search } = Input;
const { Text, Title } = Typography;

const SearchInstances = ({ onInstanceSelect, showMetrics = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const [searchHistory, setSearchHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [allInstances, setAllInstances] = useState([]);

  // Load search history from localStorage and fetch all instances for autocomplete
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }

    // Fetch all instances for autocomplete suggestions
    fetchAllInstances();
  }, []);

  // Fetch all instances for autocomplete
  const fetchAllInstances = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.INSTANCES}?pageSize=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      console.log('Fetched instances for autocomplete:', data); // Debug logging

      if (data.instances) {
        setAllInstances(data.instances);
      } else {
        console.warn('No instances property in response:', data);
      }
    } catch (error) {
      console.error('Error fetching instances for autocomplete:', error);
    }
  };

  // Save search history to localStorage
  const saveSearchHistory = (term) => {
    if (!term.trim()) return;

    const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  // Enhanced autocomplete suggestions with fuzzy matching and categorization
  const generateSuggestions = (searchValue) => {
    if (!searchValue || searchValue.length < 1) {
      setSuggestions([]);
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const searchTerm = searchValue.trim();
    const suggestionMap = new Map();

    allInstances.forEach(instance => {
      const instanceName = instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId;
      const instanceState = instance.State?.Name || 'unknown';
      const stateColor = instanceState === 'running' ? '#52c41a' : instanceState === 'stopped' ? '#f5222d' : '#faad14';

      // Enhanced IP matching - supports partial IPs like "10.0", "192.168", etc.
      const matchesIP = (ip, search) => {
        if (!ip) return false;
        const ipParts = ip.split('.');
        const searchParts = search.split('.');

        // Exact match
        if (ip.includes(search)) return true;

        // Partial IP matching (e.g., "10.0" matches "10.0.1.2")
        if (searchParts.length <= ipParts.length) {
          return searchParts.every((part, index) =>
            ipParts[index] && ipParts[index].startsWith(part)
          );
        }

        return false;
      };

      // Match instance name with fuzzy search
      if (instanceName.toLowerCase().includes(searchLower)) {
        const key = `name_${instanceName}`;
        suggestionMap.set(key, {
          value: instanceName,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{instanceName}</strong> <small style={{ color: '#666' }}>({instance.InstanceId})</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          type: 'instance',
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
              <span><strong>{instance.InstanceId}</strong> <small style={{ color: '#666' }}>({instanceName})</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          type: 'instance',
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
              <span><strong>{instance.PublicIpAddress}</strong> <small style={{ color: '#666' }}>Public - {instanceName}</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          type: 'instance',
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
              <span><strong>{instance.PrivateIpAddress}</strong> <small style={{ color: '#666' }}>Private - {instanceName}</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          type: 'instance',
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
              <span><strong>{instance.InstanceType}</strong> <small style={{ color: '#666' }}>{instanceName}</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          type: 'instance',
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
              <span><strong>{instance.Region}</strong> <small style={{ color: '#666' }}>{instanceName}</small></span>
              <span style={{ color: stateColor, fontSize: '12px' }}>{instanceState}</span>
            </div>
          ),
          type: 'instance',
          instance: instance,
          searchType: 'region'
        });
      }
    });

    // Convert to array and limit to 15 suggestions, prioritize by relevance
    const suggestionArray = Array.from(suggestionMap.values())
      .sort((a, b) => {
        // Prioritize exact matches and running instances
        const aRunning = a.instance.State?.Name === 'running' ? 1 : 0;
        const bRunning = b.instance.State?.Name === 'running' ? 1 : 0;
        const aExact = a.value.toLowerCase() === searchLower ? 1 : 0;
        const bExact = b.value.toLowerCase() === searchLower ? 1 : 0;

        return (bExact - aExact) || (bRunning - aRunning);
      })
      .slice(0, 15);

    setSuggestions(suggestionArray);
  };

  // Perform search using enhanced search API
  const performSearch = async (searchValue) => {
    if (!searchValue || searchValue.length < 1) {
      setSearchResults([]);
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.SEARCH}?q=${encodeURIComponent(searchValue)}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      console.log('Enhanced search API response:', data);

      if (data.success && data.results) {
        setSearchResults(data.results);
        saveSearchHistory(searchValue);

        // Update suggestions from search results
        if (data.suggestions) {
          const formattedSuggestions = data.suggestions.map(suggestion => ({
            value: suggestion.value,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <strong>{suggestion.value}</strong>
                  <small style={{ color: '#666', marginLeft: 8 }}>
                    {suggestion.category} - {suggestion.instance.Tags?.find(tag => tag.Key === 'Name')?.Value || suggestion.instance.InstanceId}
                  </small>
                </span>
                <span style={{ color: suggestion.stateColor, fontSize: '12px' }}>
                  {suggestion.state}
                </span>
              </div>
            ),
            instance: suggestion.instance,
            category: suggestion.category
          }));
          setSuggestions(formattedSuggestions);
        }
      } else {
        console.warn('Search failed or no results:', data);
        setSearchResults([]);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Enhanced search error:', error);
      setSearchResults([]);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Generate suggestions using the new API
  const generateSuggestionsFromAPI = async (searchValue) => {
    if (!searchValue || searchValue.length < 1) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`${API_ENDPOINTS.SEARCH}/suggestions?q=${encodeURIComponent(searchValue)}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (data.success && data.suggestions) {
        const formattedSuggestions = data.suggestions.map(suggestion => ({
          value: suggestion.value,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <strong>{suggestion.value}</strong>
                <small style={{ color: '#666', marginLeft: 8 }}>
                  {suggestion.category}
                </small>
              </span>
              <span style={{ color: suggestion.stateColor, fontSize: '12px' }}>
                {suggestion.state}
              </span>
            </div>
          ),
          instance: suggestion.instance,
          category: suggestion.category
        }));
        setSuggestions(formattedSuggestions);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    }
  };

  // Handle search input change with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm && searchTerm.length >= 1) {
        generateSuggestionsFromAPI(searchTerm);
        if (searchTerm.length >= 2) {
          performSearch(searchTerm);
        }
      } else {
        setSuggestions([]);
        setSearchResults([]);
      }
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
    // Handle new enhanced search result format
    const instanceType = result.InstanceType || 'Unknown';
    const state = result.State?.Name || 'unknown';
    const region = result.Region || 'Unknown';

    const details = [`${instanceType} - ${state} (${region})`];

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
        <AutoComplete
          options={suggestions}
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
          onSelect={(value, option) => {
            setSearchTerm(value);
            performSearch(value);

            // If user selected a suggestion with instance data, trigger navigation
            if (option && option.instance && onInstanceSelect) {
              onInstanceSelect(option.instance);
            }
          }}
          style={{ width: '100%' }}
        >
          <Input.Search
            placeholder="Search by name, ID, type, or IP address..."
            onSearch={(value) => performSearch(value)}
            prefix={<SearchOutlined />}
            allowClear
            size="large"
            loading={loading}
          />
        </AutoComplete>

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
                            <Text strong>{result.instanceName}</Text>
                            {result.InstanceId !== result.instanceName && (
                              <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                                ({result.InstanceId})
                              </Text>
                            )}
                            {result.searchScore && (
                              <Text type="secondary" style={{ marginLeft: '8px', fontSize: '10px' }}>
                                Score: {Math.round(result.searchScore)}
                              </Text>
                            )}
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {formatInstanceDetails(result)}
                            </Text>
                            {result.matchedFields && result.matchedFields.length > 0 && (
                              <div style={{ marginTop: '4px' }}>
                                {result.matchedFields.slice(0, 3).map((match, index) => (
                                  <Tag key={index} size="small" color="blue" style={{ fontSize: '10px' }}>
                                    {match.field}: {match.value}
                                  </Tag>
                                ))}
                              </div>
                            )}
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