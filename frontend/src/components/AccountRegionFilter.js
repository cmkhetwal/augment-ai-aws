import React, { useState, useEffect } from 'react';
import { Select, Row, Col, Button, Space, Typography } from 'antd';
import { ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import { API_ENDPOINTS } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;
const { Text } = Typography;

const AccountRegionFilter = ({ 
  selectedAccount, 
  selectedRegion, 
  onAccountChange, 
  onRegionChange, 
  onRefresh, 
  style = {},
  showClear = true,
  loading = false,
  monitoringData = null // Add prop for monitoring data 
}) => {
  const [accounts, setAccounts] = useState([]);
  const [regions, setRegions] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    loadAccounts();
    loadRegions();
  }, []);
  
  // Reload regions when monitoring data changes
  useEffect(() => {
    if (monitoringData) {
      loadRegions(selectedAccount);
    }
  }, [monitoringData, selectedAccount]);
  
  // Clear selected region when account changes (if region not available in new account)
  useEffect(() => {
    if (selectedAccount && selectedRegion && monitoringData && monitoringData.instances) {
      const accountInstances = monitoringData.instances.filter(instance => 
        instance.AccountKey === selectedAccount || instance.accountKey === selectedAccount
      );
      const availableRegions = [...new Set(accountInstances.map(i => i.Region || i.region))];
      
      if (!availableRegions.includes(selectedRegion)) {
        console.log(`Region ${selectedRegion} not available for account ${selectedAccount}, clearing region filter`);
        onRegionChange && onRegionChange(null);
      }
    }
  }, [selectedAccount, monitoringData]);

  const loadAccounts = async () => {
    try {
      setAccountsLoading(true);
      const response = await fetch(API_ENDPOINTS.ACCOUNTS, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadRegions = async (accountFilter = null) => {
    try {
      setRegionsLoading(true);
      
      // If we have monitoring data with instances, extract regions from there
      if (monitoringData && monitoringData.instances && monitoringData.instances.length > 0) {
        let instances = monitoringData.instances;
        
        // Filter instances by account if specified
        if (accountFilter) {
          instances = instances.filter(instance => 
            instance.AccountKey === accountFilter || instance.accountKey === accountFilter
          );
        }
        
        // Extract unique regions from instances
        const regionSet = new Set();
        instances.forEach(instance => {
          if (instance.Region) regionSet.add(instance.Region);
          if (instance.region) regionSet.add(instance.region);
        });
        
        const regionNames = Array.from(regionSet).sort();
        console.log(`Regions for account ${accountFilter || 'all'}:`, regionNames);
        setRegions(regionNames);
        setRegionsLoading(false);
        return;
      }
      
      // Fallback to API if no monitoring data
      const response = await fetch(API_ENDPOINTS.REGIONS, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data && data.enabledRegions) {
        setRegions(data.enabledRegions);
      }
    } catch (error) {
      console.error('Error loading regions:', error);
    } finally {
      setRegionsLoading(false);
    }
  };

  const handleClearFilters = () => {
    onAccountChange && onAccountChange(null);
    onRegionChange && onRegionChange(null);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      loadAccounts();
      loadRegions();
    }
  };

  return (
    <div style={{ 
      padding: '16px', 
      background: '#fafafa', 
      borderRadius: '6px', 
      marginBottom: '16px',
      ...style 
    }}>
      <Row gutter={16} align="middle">
        <Col xs={24} sm={12} md={6}>
          <Text strong>Account:</Text>
          <Select
            placeholder="All Accounts"
            style={{ width: '100%', marginTop: '4px' }}
            value={selectedAccount}
            onChange={onAccountChange}
            loading={accountsLoading}
            allowClear
          >
            {accounts.map(account => (
              <Option key={account.key} value={account.key}>
                {account.name}
              </Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Text strong>Region:</Text>
          <Select
            placeholder="All Regions"
            style={{ width: '100%', marginTop: '4px' }}
            value={selectedRegion}
            onChange={onRegionChange}
            loading={regionsLoading}
            allowClear
          >
            {regions.map(region => (
              <Option key={region} value={region}>
                {region}
              </Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} sm={24} md={12}>
          <div style={{ marginTop: xs => xs ? '8px' : '20px' }}>
            <Space>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                Refresh Data
              </Button>
              {showClear && (
                <Button
                  icon={<ClearOutlined />}
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </Space>
          </div>
        </Col>
      </Row>

      {(selectedAccount || selectedRegion) && (
        <Row style={{ marginTop: '8px' }}>
          <Col span={24}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Active filters: 
              {selectedAccount && ` Account: ${accounts.find(a => a.key === selectedAccount)?.name || selectedAccount}`}
              {selectedAccount && selectedRegion && ', '}
              {selectedRegion && ` Region: ${selectedRegion}`}
            </Text>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default AccountRegionFilter;