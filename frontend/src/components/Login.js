import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, SecurityScanOutlined, HeartOutlined, CloudServerOutlined, WifiOutlined, GlobalOutlined, EyeInvisibleOutlined, EyeTwoTone, SafetyOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import SSOLogin from './SSOLogin';
import '../styles/animations.css';

const { Title, Text } = Typography;

// Live Monitoring Visualization Component
const LiveMonitoringViz = () => {
  const canvasRef = useRef(null);
  const [metrics, setMetrics] = useState({
    cpuUsage: 0,
    memoryUsage: 0,
    networkActivity: 0,
    activeConnections: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = 800;
    const height = canvas.height = 400;

    // Pulse wave data
    let pulseData = [];
    let networkData = [];
    let time = 0;

    // Initialize data arrays
    for (let i = 0; i < width; i++) {
      pulseData.push(0);
      networkData.push(0);
    }

    const animate = () => {
      // Clear canvas with dark background
      ctx.fillStyle = 'rgba(0, 21, 41, 0.1)';
      ctx.fillRect(0, 0, width, height);

      // Update pulse data (heartbeat pattern)
      time += 0.1;
      const heartbeat = Math.sin(time * 4) * Math.exp(-(Math.pow((time % 2) - 1, 2)) * 10);
      const cpuPulse = Math.sin(time * 2) * 0.3 + 0.5;
      const networkPulse = Math.sin(time * 3 + 1) * 0.4 + 0.6;

      // Shift data arrays
      pulseData.shift();
      pulseData.push(heartbeat * 50 + height/2);

      networkData.shift();
      networkData.push(networkPulse * 30 + height/4);

      // Draw grid
      ctx.strokeStyle = 'rgba(24, 144, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Draw pulse wave (main heartbeat) - contained in center area
      const centerStart = width * 0.2;
      const centerEnd = width * 0.8;
      const centerWidth = centerEnd - centerStart;

      ctx.strokeStyle = '#ff4d4f';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff4d4f';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i < Math.floor(centerWidth); i++) {
        const dataIndex = Math.floor((i / centerWidth) * pulseData.length);
        const x = centerStart + i;
        const y = pulseData[dataIndex];
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw network activity wave - contained in center area
      ctx.strokeStyle = '#52c41a';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#52c41a';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      for (let i = 0; i < Math.floor(centerWidth); i++) {
        const dataIndex = Math.floor((i / centerWidth) * networkData.length);
        const x = centerStart + i;
        const y = networkData[dataIndex];
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw CPU usage bars - contained in right area
      const barsStart = width * 0.85;
      const barsWidth = width * 0.12;
      ctx.fillStyle = '#1890ff';
      ctx.shadowColor = '#1890ff';
      ctx.shadowBlur = 5;
      for (let i = 0; i < 8; i++) {
        const barHeight = (Math.sin(time + i * 0.5) * 0.5 + 0.5) * 50;
        const barWidth = barsWidth / 10;
        ctx.fillRect(barsStart + i * barWidth, height - barHeight - 20, barWidth - 1, barHeight);
      }
      ctx.shadowBlur = 0;

      // Update metrics
      setMetrics({
        cpuUsage: Math.round((cpuPulse * 100)),
        memoryUsage: Math.round((Math.sin(time * 1.5) * 0.3 + 0.7) * 100),
        networkActivity: Math.round((networkPulse * 100)),
        activeConnections: Math.round(Math.sin(time * 0.8) * 50 + 150)
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, #001529 0%, #002140 50%, #001529 100%)',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(24, 144, 255, 0.2)',
      zIndex: 1
    }}>
      <canvas
        ref={canvasRef}
        className="login-canvas"
        style={{
          width: '100%',
          height: '200px',
          display: 'block',
          zIndex: 1
        }}
      />

      {/* Live Metrics Overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 10,
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '8px',
        borderRadius: '6px',
        backdropFilter: 'blur(5px)'
      }}>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: '#ff4d4f' }}>● </span>
          System Health: {metrics.cpuUsage}%
        </div>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: '#52c41a' }}>● </span>
          Network: {metrics.networkActivity}%
        </div>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: '#1890ff' }}>● </span>
          Memory: {metrics.memoryUsage}%
        </div>
        <div>
          <span style={{ color: '#faad14' }}>● </span>
          Connections: {metrics.activeConnections}
        </div>
      </div>

      {/* Status Indicators */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        gap: '10px',
        zIndex: 10
      }}>
        <div className="pulse-dot" style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#52c41a',
          animation: 'pulse 2s infinite'
        }} />
        <div className="pulse-dot" style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#1890ff',
          animation: 'pulse 2s infinite 0.5s'
        }} />
        <div className="pulse-dot" style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#faad14',
          animation: 'pulse 2s infinite 1s'
        }} />
      </div>
    </div>
  );
};

// AWS Logo Component (using official AWS logo SVG)
const AWSLogo = ({ size = 48 }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px'
  }}>
    <svg
      width={size * 1.5}
      height={size}
      viewBox="0 0 100 60"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
    >
      {/* AWS Logo */}
      <g>
        {/* Orange smile/arrow */}
        <path
          d="M20 45 Q50 35 80 45"
          stroke="#FF9900"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* AWS Text */}
        <text
          x="50"
          y="25"
          textAnchor="middle"
          fill="#232F3E"
          fontSize="14"
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
        >
          AWS
        </text>
        {/* Dots for the smile */}
        <circle cx="20" cy="45" r="1.5" fill="#FF9900" />
        <circle cx="80" cy="45" r="1.5" fill="#FF9900" />
      </g>
    </svg>
  </div>
);

// Heartbeat Pulse Animation - Single glowing red neon heartbeat
const PulseAnimation = ({ size = 24 }) => {
  return (
    <div style={{
      position: 'relative',
      width: size * 2,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1
    }}>
      {/* Single heartbeat pulse line */}
      <svg
        width={size * 2}
        height={size}
        viewBox="0 0 100 40"
        style={{
          filter: 'drop-shadow(0 0 8px #ff4d4f)',
          animation: 'heartbeat-glow 1.5s infinite'
        }}
      >
        {/* Heartbeat line path */}
        <path
          d="M5 20 L15 20 L20 10 L25 30 L30 5 L35 35 L40 20 L95 20"
          stroke="#ff4d4f"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: 'heartbeat-pulse 1.5s infinite'
          }}
        />
        {/* Glowing effect */}
        <path
          d="M5 20 L15 20 L20 10 L25 30 L30 5 L35 35 L40 20 L95 20"
          stroke="#ff6b6b"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
          style={{
            animation: 'heartbeat-pulse 1.5s infinite 0.1s'
          }}
        />
      </svg>
    </div>
  );
};

const Login = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      const result = await login(values.identifier, values.password);
      if (result.success) {
        // Login successful - AuthContext will handle navigation
      } else {
        setError('Invalid username or password. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: `
        linear-gradient(135deg, #1e3a8a 0%, #3730a3 25%, #6366f1 50%, #8b5cf6 75%, #a855f7 100%),
        url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><radialGradient id="a" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23ffffff" stop-opacity="0.1"/><stop offset="100%" stop-color="%23ffffff" stop-opacity="0"/></radialGradient><radialGradient id="b" cx="30%" cy="30%" r="40%"><stop offset="0%" stop-color="%23ffffff" stop-opacity="0.08"/><stop offset="100%" stop-color="%23ffffff" stop-opacity="0"/></radialGradient></defs><rect width="1000" height="1000" fill="url(%23a)"/><circle cx="300" cy="300" r="200" fill="url(%23b)"/><circle cx="700" cy="700" r="150" fill="url(%23b)"/></svg>')
      `,
      backgroundSize: 'cover, 100% 100%',
      backgroundPosition: 'center, center',
      backgroundRepeat: 'no-repeat, no-repeat',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden'
    }}>
      {/* DataDog-style Background Animation */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 40%),
          radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.05) 0%, transparent 40%),
          radial-gradient(circle at 60% 40%, rgba(255, 255, 255, 0.03) 0%, transparent 30%)
        `,
        animation: 'float 25s ease-in-out infinite'
      }} />

      <div className="login-container" style={{
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
        maxWidth: '1200px',
        width: '100%',
        height: '100vh',
        zIndex: 1,
        overflow: 'hidden'
      }}>
        {/* Live Monitoring Visualization */}
        <div className="login-visualization" style={{
          flex: 1,
          maxWidth: '600px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <Text style={{
              color: 'rgba(255, 255, 255, 0.95)',
              fontSize: '16px',
              display: 'block',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>
              Live Infrastructure Monitoring
            </Text>
          </div>

          <LiveMonitoringViz />

          {/* Feature Highlights */}
          <div className="feature-highlights" style={{
            display: 'flex',
            justifyContent: 'space-around',
            marginTop: '20px',
            padding: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)',
            zIndex: 5
          }}>
            <div style={{ textAlign: 'center', color: 'white' }}>
              <CloudServerOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Infrastructure</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>24/7</div>
            </div>
            <div style={{ textAlign: 'center', color: 'white' }}>
              <WifiOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Network</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Real-time</div>
            </div>
            <div style={{ textAlign: 'center', color: 'white' }}>
              <GlobalOutlined style={{ fontSize: '24px', color: '#faad14', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Websites</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Global</div>
            </div>
            <div style={{ textAlign: 'center', color: 'white' }}>
              <HeartOutlined style={{ fontSize: '24px', color: '#ff4d4f', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Health</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Live</div>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <Card
          className="login-card"
          style={{
            width: '380px',
            height: 'auto',
            maxHeight: '90vh',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}
          bodyStyle={{ padding: '24px', overflow: 'hidden' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <AWSLogo size={40} />
              <PulseAnimation size={24} />
            </div>

            <Title level={2} style={{
              margin: '0 0 4px 0',
              color: '#001529',
              fontSize: '24px',
              fontWeight: '600',
              lineHeight: '1.2'
            }}>
              PulseStack
            </Title>
            <Text style={{
              fontSize: '13px',
              color: '#666',
              fontWeight: '500',
              marginBottom: '16px',
              display: 'block',
              lineHeight: '1.3'
            }}>
              Real-time Infrastructure Monitoring
            </Text>

            <div style={{
              padding: '12px 0',
              borderTop: '1px solid #f0f0f0'
            }}>
              <Title level={4} style={{
                margin: '0 0 4px 0',
                color: '#001529',
                fontSize: '16px',
                fontWeight: '500',
                lineHeight: '1.2'
              }}>
                Welcome Back
              </Title>
              <Text style={{
                fontSize: '12px',
                color: '#888',
                lineHeight: '1.3'
              }}>
                Sign in to access your monitoring dashboard
              </Text>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{
                marginBottom: '24px',
                borderRadius: '8px'
              }}
              closable
              onClose={() => setError('')}
            />
          )}

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="identifier"
            label={<span style={{ color: '#333', fontWeight: '500', fontSize: '13px' }}>Username or Email</span>}
            rules={[
              {
                required: true,
                message: 'Please input your username or email!',
              },
            ]}
            style={{ marginBottom: '16px' }}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#666' }} />}
              placeholder="Enter your username or email"
              autoComplete="username"
              style={{
                borderRadius: '6px',
                border: '1px solid #d9d9d9',
                fontSize: '13px',
                height: '38px'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ color: '#333', fontWeight: '500', fontSize: '13px' }}>Password</span>}
            rules={[
              {
                required: true,
                message: 'Please input your password!',
              },
            ]}
            style={{ marginBottom: '12px' }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#666' }} />}
              placeholder="Enter your password"
              autoComplete="current-password"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              style={{
                borderRadius: '6px',
                border: '1px solid #d9d9d9',
                fontSize: '13px',
                height: '38px'
              }}
            />
          </Form.Item>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <a href="#" style={{
              color: '#1890ff',
              fontSize: '12px',
              textDecoration: 'none'
            }}>
              Forgot Password?
            </a>
          </div>

          {/* SAML Login - Primary for Enterprise */}
          <Form.Item style={{ marginBottom: '12px' }}>
            <Button
              type="default"
              block
              icon={<SecurityScanOutlined />}
              onClick={() => window.location.href = '/api/auth/saml/login'}
              style={{
                height: '36px',
                fontSize: '13px',
                fontWeight: '500',
                borderRadius: '6px',
                border: '1px solid #1890ff',
                color: '#1890ff',
                background: 'rgba(24, 144, 255, 0.05)'
              }}
            >
              Sign in with SAML SSO
            </Button>
          </Form.Item>

          <Form.Item style={{ marginBottom: '12px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              icon={<SafetyOutlined />}
              style={{
                height: '36px',
                fontSize: '13px',
                fontWeight: '500',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                border: 'none',
                boxShadow: '0 2px 8px rgba(24, 144, 255, 0.3)'
              }}
            >
              {loading ? 'Signing In...' : 'Secure Sign In'}
            </Button>
          </Form.Item>
        </Form>

        {/* SSO Login Options */}
        <SSOLogin loading={loading} />

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ textAlign: 'center', paddingTop: '2px' }}>
          <Space direction="vertical" size="small">
            <Text style={{
              fontSize: '11px',
              color: '#999',
              fontWeight: '500',
              lineHeight: '1.2'
            }}>
              PulseStack v1.0 - Professional Infrastructure Monitoring
            </Text>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '2px'
            }}>
              <SafetyOutlined style={{ color: '#52c41a', marginRight: '3px', fontSize: '10px' }} />
              <Text style={{
                fontSize: '10px',
                color: '#52c41a',
                fontWeight: '500',
                lineHeight: '1.2'
              }}>
                SSL Secured Connection
              </Text>
            </div>
          </Space>
        </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
