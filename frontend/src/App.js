import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, notification, Button, Dropdown, Avatar } from 'antd';
import {
  DashboardOutlined,
  CloudServerOutlined,
  WifiOutlined,
  BarChartOutlined,
  SecurityScanOutlined,
  BellOutlined,
  SearchOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import UserManagement from './components/UserManagement';
import ChangePassword from './components/ChangePassword';
import DashboardEnhanced from './pages/DashboardEnhanced';
import Instances from './pages/Instances';
import PingMonitor from './pages/PingMonitor';
import SystemMetrics from './pages/SystemMetrics';
import PortScanner from './pages/PortScanner';
import NotificationConfig from './components/NotificationConfig';

import WebsiteMonitoring from './pages/WebsiteMonitoring';
import SSOCallback from './pages/SSOCallback';
import SSOConfiguration from './pages/SSOConfiguration';
import SAMLCallback from './pages/SAMLCallback';
import AccountRegionFilter from './components/AccountRegionFilter';
import PollingService from './services/PollingService';
import { API_ENDPOINTS } from './config/api';
import './styles/animations.css';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function AppContent() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [monitoringData, setMonitoringData] = useState({
    instances: [],
    pingResults: {},
    systemMetrics: {},
    openPorts: {},
    stats: {}
  });
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pollingService, setPollingService] = useState(null);
  const { user, logout, hasPermission, token } = useAuth();

  // Function to load data with account and region filtering
  const loadDataFromAPI = async (account = null, region = null) => {
    try {
      setLoading(true);
      console.log(`Loading data from API (Account: ${account || 'all'}, Region: ${region || 'all'})...`);
      
      // Build query parameters for filtering
      const params = new URLSearchParams();
      if (account) params.append('account', account);
      if (region) params.append('region', region);
      params.append('sortBy', 'usage');
      params.append('useCache', 'true');

      const [dashboardResponse, regionsResponse] = await Promise.all([
        fetch(`${API_ENDPOINTS.DASHBOARD_FILTERED}?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch(API_ENDPOINTS.REGIONS, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      ]);

      const dashboardData = await dashboardResponse.json();
      const regionsData = await regionsResponse.json();

      if (dashboardData.success) {
        console.log('Multi-account API data loaded successfully:', {
          instances: dashboardData.data.instances.length,
          accounts: dashboardData.data.stats.accounts,
          regions: dashboardData.data.stats.regions,
          ssmSuccessRate: dashboardData.data.stats.ssmSuccessRate
        });

        setMonitoringData({
          instances: dashboardData.data.instances || [],
          stats: dashboardData.data.stats || {},
          filters: dashboardData.data.filters || {},
          pingResults: {}, // Populated by individual service calls
          systemMetrics: {}, // Populated by individual service calls  
          openPorts: {}, // Populated by individual service calls
          regions: regionsData || [],
          timestamp: dashboardData.data.timestamp
        });
      } else {
        throw new Error(dashboardData.error || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Error loading data from API:', error);
      notification.error({
        message: 'Data Loading Error',
        description: `Failed to load monitoring data: ${error.message}`,
        duration: 5
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle account filter change
  const handleAccountChange = (account) => {
    console.log('Account filter changed:', account);
    setSelectedAccount(account);
    
    // Update PollingService filters and trigger immediate fetch
    if (pollingService) {
      pollingService.setFilters(account, selectedRegion);
      pollingService.fetchData(); // Trigger immediate fetch with new filters
    }
  };

  // Handle region filter change  
  const handleRegionChange = (region) => {
    console.log('Region filter changed:', region);
    setSelectedRegion(region);
    
    // Update PollingService filters and trigger immediate fetch
    if (pollingService) {
      pollingService.setFilters(selectedAccount, region);
      pollingService.fetchData(); // Trigger immediate fetch with new filters
    }
  };

  // Handle refresh with current filters
  const handleRefresh = () => {
    loadDataFromAPI(selectedAccount, selectedRegion);
  };

  useEffect(() => {
    // Only initialize if user is authenticated
    if (token && user) {
      const wsService = new PollingService();
      setPollingService(wsService);

      // Load initial data from API immediately
      loadDataFromAPI();

      wsService.connect();
    
    wsService.onMessage((data) => {
      console.log('Polling data received:', data.type, data);
      switch (data.type) {
        case 'initial_data':
        case 'dashboard_update':
          console.log('Setting initial data:', data.data);
          setMonitoringData(data.data);
          break;
        case 'instances_update':
          const instances = data.data.instances || data.data;
          console.log('Updating instances:', instances.length);
          setMonitoringData(prev => ({
            ...prev,
            instances: instances
          }));
          break;
        case 'ping_update':
          setMonitoringData(prev => ({
            ...prev,
            pingResults: data.data
          }));
          break;
        case 'metrics_update':
          setMonitoringData(prev => ({
            ...prev,
            systemMetrics: data.data
          }));
          break;
        case 'ports_update':
          setMonitoringData(prev => ({
            ...prev,
            openPorts: data.data
          }));
          break;
        default:
          break;
      }
    });

    wsService.onConnect(() => {
      setConnectionStatus('connected');
      notification.success({
        message: 'Connected',
        description: 'Real-time monitoring connected successfully'
      });
    });

    wsService.onDisconnect(() => {
      setConnectionStatus('disconnected');
      notification.warning({
        message: 'Disconnected',
        description: 'Real-time monitoring disconnected'
      });
    });

    wsService.onError((error) => {
      setConnectionStatus('error');
      notification.error({
        message: 'Connection Error',
        description: 'Failed to connect to monitoring service'
      });
    });

      return () => {
        wsService.disconnect();
      };
    }
  }, [token, user]);

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      path: '/'
    },

    {
      key: 'instances',
      icon: <CloudServerOutlined />,
      label: 'Infrastructure',
      path: '/instances'
    },
    {
      key: 'ping',
      icon: <WifiOutlined />,
      label: 'Network Health',
      path: '/ping'
    },
    {
      key: 'metrics',
      icon: <BarChartOutlined />,
      label: 'System Metrics',
      path: '/metrics'
    },
    {
      key: 'ports',
      icon: <SecurityScanOutlined />,
      label: 'Port Scanner',
      path: '/ports'
    },
    {
      key: 'websites',
      icon: <GlobalOutlined />,
      label: 'Website Health',
      path: '/websites'
    },
    {
      key: 'notifications',
      icon: <BellOutlined />,
      label: 'Notifications',
      path: '/notifications'
    },
    ...(hasPermission('manage_users') ? [{
      key: 'users',
      icon: <TeamOutlined />,
      label: 'User Management',
      path: '/users'
    }, {
      key: 'sso',
      icon: <SettingOutlined />,
      label: 'SSO Configuration',
      path: '/sso'
    }] : [])
  ];

  const handleMenuClick = (e) => {
    const selectedItem = menuItems.find(item => item.key === e.key);
    if (selectedItem) {
      navigate(selectedItem.path);
    }
  };

  const getCurrentPageKey = () => {
    const currentPath = location.pathname;
    const currentItem = menuItems.find(item => item.path === currentPath);
    return currentItem ? currentItem.key : 'dashboard';
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#52c41a';
      case 'connecting': return '#faad14';
      case 'disconnected': return '#f5222d';
      case 'error': return '#f5222d';
      default: return '#d9d9d9';
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{ 
          height: 32, 
          margin: 16, 
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold'
        }}>
          {collapsed ? 'PS' : 'PulseStack'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getCurrentPageKey()]}
          onClick={handleMenuClick}
          items={menuItems.map(item => ({
            key: item.key,
            icon: item.icon,
            label: item.label
          }))}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header style={{ 
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)'
        }}>
          <Title level={3} style={{ margin: 0, color: '#001529' }}>
            PulseStack - Infrastructure Monitor
          </Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: 8 }}>Status:</span>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: getConnectionStatusColor(),
                marginRight: 8
              }} />
              <span style={{ textTransform: 'capitalize' }}>{connectionStatus}</span>
            </div>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'profile',
                    icon: <UserOutlined />,
                    label: 'Profile',
                  },
                  {
                    key: 'change-password',
                    icon: <SettingOutlined />,
                    label: 'Change Password',
                  },
                  {
                    type: 'divider',
                  },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Logout',
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') {
                    logout();
                  } else if (key === 'change-password') {
                    navigate('/change-password');
                  }
                },
              }}
              placement="bottomRight"
            >
              <Button type="text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{user?.firstName} {user?.lastName}</span>
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content style={{
          padding: 24,
          background: '#f0f2f5',
          overflow: 'auto',
          height: 'calc(100vh - 64px)' // Subtract header height
        }}>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <AccountRegionFilter
                    selectedAccount={selectedAccount}
                    selectedRegion={selectedRegion}
                    onAccountChange={handleAccountChange}
                    onRegionChange={handleRegionChange}
                    onRefresh={handleRefresh}
                    loading={loading}
                    monitoringData={monitoringData}
                  />
                  <DashboardEnhanced 
                    data={monitoringData} 
                    onRefresh={handleRefresh}
                    selectedAccount={selectedAccount}
                    selectedRegion={selectedRegion}
                  />
                </>
              }
            />

            <Route
              path="/instances"
              element={
                <>
                  <AccountRegionFilter
                    selectedAccount={selectedAccount}
                    selectedRegion={selectedRegion}
                    onAccountChange={handleAccountChange}
                    onRegionChange={handleRegionChange}
                    onRefresh={handleRefresh}
                    loading={loading}
                    monitoringData={monitoringData}
                  />
                  <Instances 
                    data={{
                      ...monitoringData,
                      instances: monitoringData.instances.filter(instance => {
                        const matchesAccount = !selectedAccount || 
                          instance.AccountKey === selectedAccount || 
                          instance.accountKey === selectedAccount;
                        const matchesRegion = !selectedRegion || 
                          instance.Region === selectedRegion || 
                          instance.region === selectedRegion;
                        return matchesAccount && matchesRegion;
                      })
                    }}
                  />
                </>
              }
            />
            <Route
              path="/ping"
              element={
                <>
                  <AccountRegionFilter
                    selectedAccount={selectedAccount}
                    selectedRegion={selectedRegion}
                    onAccountChange={handleAccountChange}
                    onRegionChange={handleRegionChange}
                    onRefresh={handleRefresh}
                    loading={loading}
                    monitoringData={monitoringData}
                  />
                  <PingMonitor 
                    data={{
                      ...monitoringData,
                      instances: monitoringData.instances.filter(instance => {
                        const matchesAccount = !selectedAccount || 
                          instance.AccountKey === selectedAccount || 
                          instance.accountKey === selectedAccount;
                        const matchesRegion = !selectedRegion || 
                          instance.Region === selectedRegion || 
                          instance.region === selectedRegion;
                        return matchesAccount && matchesRegion;
                      })
                    }}
                  />
                </>
              }
            />
            <Route
              path="/metrics"
              element={
                <>
                  <AccountRegionFilter
                    selectedAccount={selectedAccount}
                    selectedRegion={selectedRegion}
                    onAccountChange={handleAccountChange}
                    onRegionChange={handleRegionChange}
                    onRefresh={handleRefresh}
                    loading={loading}
                    monitoringData={monitoringData}
                  />
                  <SystemMetrics 
                    data={{
                      ...monitoringData,
                      instances: monitoringData.instances.filter(instance => {
                        const matchesAccount = !selectedAccount || 
                          instance.AccountKey === selectedAccount || 
                          instance.accountKey === selectedAccount;
                        const matchesRegion = !selectedRegion || 
                          instance.Region === selectedRegion || 
                          instance.region === selectedRegion;
                        return matchesAccount && matchesRegion;
                      })
                    }}
                  />
                </>
              }
            />
            <Route
              path="/ports"
              element={
                <>
                  <AccountRegionFilter
                    selectedAccount={selectedAccount}
                    selectedRegion={selectedRegion}
                    onAccountChange={handleAccountChange}
                    onRegionChange={handleRegionChange}
                    onRefresh={handleRefresh}
                    loading={loading}
                    monitoringData={monitoringData}
                  />
                  <PortScanner 
                    data={{
                      ...monitoringData,
                      instances: monitoringData.instances.filter(instance => {
                        const matchesAccount = !selectedAccount || 
                          instance.AccountKey === selectedAccount || 
                          instance.accountKey === selectedAccount;
                        const matchesRegion = !selectedRegion || 
                          instance.Region === selectedRegion || 
                          instance.region === selectedRegion;
                        return matchesAccount && matchesRegion;
                      })
                    }}
                  />
                </>
              }
            />
            <Route
              path="/websites"
              element={<WebsiteMonitoring />}
            />
            <Route
              path="/notifications"
              element={<NotificationConfig />}
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredPermission="manage_users">
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sso"
              element={
                <ProtectedRoute requiredPermission="manage_users">
                  <SSOConfiguration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/change-password"
              element={<ChangePassword />}
            />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/sso-callback" element={<SSOCallback />} />
          <Route path="/saml-callback" element={<SAMLCallback />} />

          {/* Protected routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <AppContent />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;