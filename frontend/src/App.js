import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, notification } from 'antd';
import { 
  DashboardOutlined, 
  CloudServerOutlined, 
  WifiOutlined, 
  BarChartOutlined,
  SecurityScanOutlined,
  BellOutlined,
  SearchOutlined
} from '@ant-design/icons';
import DashboardEnhanced from './pages/DashboardEnhanced';
import Instances from './pages/Instances';
import PingMonitor from './pages/PingMonitor';
import SystemMetrics from './pages/SystemMetrics';
import PortScanner from './pages/PortScanner';
import NotificationConfig from './components/NotificationConfig';
import SearchInstances from './components/SearchInstances';
import WebSocketService from './services/WebSocketService';
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
    openPorts: {}
  });
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Function to load data directly from API as fallback
  const loadDataFromAPI = async () => {
    try {
      console.log('Loading data from API...');
      const [dashboardResponse, regionsResponse] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/regions')
      ]);
      
      const dashboardData = await dashboardResponse.json();
      const regionsData = await regionsResponse.json();
      
      console.log('Dashboard data loaded:', dashboardData);
      console.log('Regions data loaded:', regionsData);
      console.log('Total instances found:', dashboardData.instances?.length);
      
      setMonitoringData(dashboardData);
    } catch (error) {
      console.error('Error loading data from API:', error);
    }
  };

  useEffect(() => {
    const wsService = new WebSocketService();
    
    // Load initial data from API immediately
    loadDataFromAPI();
    
    wsService.connect();
    
    wsService.onMessage((data) => {
      console.log('WebSocket message received:', data.type, data);
      switch (data.type) {
        case 'initial_data':
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
  }, []);

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      path: '/'
    },
    {
      key: 'search',
      icon: <SearchOutlined />,
      label: 'Search Instances',
      path: '/search'
    },
    {
      key: 'instances',
      icon: <CloudServerOutlined />,
      label: 'EC2 Instances',
      path: '/instances'
    },
    {
      key: 'ping',
      icon: <WifiOutlined />,
      label: 'Ping Monitor',
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
      key: 'notifications',
      icon: <BellOutlined />,
      label: 'Notifications',
      path: '/notifications'
    }
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
          {collapsed ? 'EM' : 'EC2 Monitor'}
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
            AWS EC2 Monitoring Dashboard
          </Title>
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
        </Header>
        <Content style={{ padding: 24, background: '#f0f2f5', overflow: 'initial' }}>
          <Routes>
            <Route 
              path="/" 
              element={<DashboardEnhanced data={monitoringData} />} 
            />
            <Route 
              path="/search" 
              element={<SearchInstances showMetrics={true} />} 
            />
            <Route 
              path="/instances" 
              element={<Instances data={monitoringData} />} 
            />
            <Route 
              path="/ping" 
              element={<PingMonitor data={monitoringData} />} 
            />
            <Route 
              path="/metrics" 
              element={<SystemMetrics data={monitoringData} />} 
            />
            <Route 
              path="/ports" 
              element={<PortScanner data={monitoringData} />} 
            />
            <Route 
              path="/notifications" 
              element={<NotificationConfig />} 
            />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;